import type { Node } from "reactflow";

export type ResolveCollisionsOptions = {
  /**
   * 发生碰撞时矩形之间至少保留的间距（像素）。
   * 默认 16。
   */
  margin?: number;
  /**
   * 最大迭代次数。默认 60。
   * 值越大越“稳定”，但计算更重（节点多时明显）。
   */
  maxIterations?: number;
  /**
   * 将“重叠量/最小边长” 小于该阈值的情况忽略，避免抖动。
   * 默认 0.15。
   */
  overlapThreshold?: number;
  /**
   * 尽量不移动的节点（例如拖拽停止的那个节点）。
   */
  fixedNodeId?: string;
  /**
   * 当 React Flow 尚未测量节点尺寸时的 fallback。
   */
  fallbackSize?: { width: number; height: number };
};

type Rect = { x: number; y: number; w: number; h: number };
type Pos = { x: number; y: number };

type CollisionState = {
  byId: Map<string, Node>;
  pos: Map<string, Pos>;
  ids: string[];
  margin: number;
  overlapThreshold: number;
  fixedNodeId?: string;
  fallbackSize: { width: number; height: number };
};

function clampFinite(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function rectOfNode(
  n: Node,
  fallback: { width: number; height: number },
): Rect {
  const w = clampFinite((n as unknown as { width?: number }).width, fallback.width);
  const h = clampFinite(
    (n as unknown as { height?: number }).height,
    fallback.height,
  );
  const x = clampFinite(n.position?.x, 0);
  const y = clampFinite(n.position?.y, 0);
  return { x, y, w, h };
}

function overlaps(a: Rect, b: Rect, margin: number) {
  const ax2 = a.x + a.w + margin;
  const ay2 = a.y + a.h + margin;
  const bx2 = b.x + b.w + margin;
  const by2 = b.y + b.h + margin;

  const ox = Math.min(ax2, bx2) - Math.max(a.x, b.x);
  const oy = Math.min(ay2, by2) - Math.max(a.y, b.y);
  return { ox, oy };
}

function overlapRatio(a: Rect, b: Rect, ox: number, oy: number): number {
  const norm = Math.min(a.w, a.h, b.w, b.h);
  return Math.min(ox, oy) / Math.max(1, norm);
}

function centerSign(a: Rect, b: Rect, pushX: boolean): 1 | -1 {
  const aCx = a.x + a.w / 2;
  const aCy = a.y + a.h / 2;
  const bCx = b.x + b.w / 2;
  const bCy = b.y + b.h / 2;
  if (pushX) return aCx <= bCx ? -1 : 1;
  return aCy <= bCy ? -1 : 1;
}

function isFixed(state: CollisionState, id: string): boolean {
  return Boolean(state.fixedNodeId && state.fixedNodeId === id);
}

function applySeparation(
  state: CollisionState,
  aId: string,
  bId: string,
  pushX: boolean,
  sign: 1 | -1,
  sep: number,
): boolean {
  const pA = state.pos.get(aId);
  const pB = state.pos.get(bId);
  if (!pA || !pB) return false;

  const delta = sep + 0.01; // 防止浮点边界卡住

  const aFixed = isFixed(state, aId);
  const bFixed = isFixed(state, bId);

  if (aFixed && !bFixed) {
    if (pushX) pB.x -= sign * delta;
    else pB.y -= sign * delta;
    return true;
  }
  if (!aFixed && bFixed) {
    if (pushX) pA.x += sign * delta;
    else pA.y += sign * delta;
    return true;
  }

  const half = delta / 2;
  if (pushX) {
    pA.x += sign * half;
    pB.x -= sign * half;
  } else {
    pA.y += sign * half;
    pB.y -= sign * half;
  }
  return true;
}

function tryResolvePair(state: CollisionState, aId: string, bId: string): boolean {
  const nA = state.byId.get(aId);
  const nB = state.byId.get(bId);
  if (!nA || !nB) return false;

  const pA = state.pos.get(aId);
  const pB = state.pos.get(bId);
  if (!pA || !pB) return false;

  const rA = rectOfNode({ ...nA, position: pA }, state.fallbackSize);
  const rB = rectOfNode({ ...nB, position: pB }, state.fallbackSize);

  const { ox, oy } = overlaps(rA, rB, state.margin);
  if (ox <= 0 || oy <= 0) return false;

  const pushX = ox < oy;
  const sep = pushX ? ox : oy;
  const sign = centerSign(rA, rB, pushX);

  // overlapThreshold 主要用于“抖动”场景；但在 margin 校正碰撞时，
  // sep 即便在相对体量上很小，也仍可能意味着 margin 没满足（视觉上会显得距离不够）。
  // 因此：只有当 sep 像素级别也极小，才跳过该对碰撞的推开。
  const ratio = overlapRatio(rA, rB, ox, oy);
  if (ratio < state.overlapThreshold && sep < 2) return false;

  return applySeparation(state, aId, bId, pushX, sign, sep);
}

function buildState(nodes: Node[], opts: ResolveCollisionsOptions): CollisionState {
  return {
    byId: new Map(nodes.map((n) => [n.id, n])),
    pos: new Map(nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }])),
    ids: nodes.map((n) => n.id),
    margin: opts.margin ?? 16,
    overlapThreshold: opts.overlapThreshold ?? 0.15,
    fixedNodeId: opts.fixedNodeId,
    // workflowStep 节点宽度最小 220px，且高度会随 ParamRow 数量增长；
    // 默认 fallback 过小会导致“没测量到尺寸时推得不够”。
    fallbackSize: opts.fallbackSize ?? { width: 320, height: 240 },
  };
}

function withUpdatedPositions(nodes: Node[], pos: Map<string, Pos>): Node[] {
  return nodes.map((n) => {
    const p = pos.get(n.id);
    if (!p) return n;
    if (p.x === n.position.x && p.y === n.position.y) return n;
    return { ...n, position: p };
  });
}

/**
 * 参考 React Flow「Node Collisions」示例，做一个轻量的矩形碰撞避让。
 * - 以节点 `position` + 节点测量宽高组成矩形
 * - 迭代地把相交矩形沿最小位移方向推开
 */
export function resolveCollisions(
  nodes: Node[],
  opts: ResolveCollisionsOptions = {},
): Node[] {
  const maxIterations = opts.maxIterations ?? 60;

  if (nodes.length <= 1) return nodes;

  // 只更新 position，其他字段保持引用稳定以减少 React Flow 的重渲染。
  const state = buildState(nodes, opts);
  let changed = false;
  for (let iter = 0; iter < maxIterations; iter++) {
    let iterChanged = false;

    for (let i = 0; i < state.ids.length; i++) {
      const aId = state.ids[i]!;
      for (let j = i + 1; j < state.ids.length; j++) {
        const bId = state.ids[j]!;
        if (tryResolvePair(state, aId, bId)) {
          iterChanged = true;
        }
      }
    }

    if (!iterChanged) break;
    changed = true;
  }

  if (!changed) return nodes;

  return withUpdatedPositions(nodes, state.pos);
}

