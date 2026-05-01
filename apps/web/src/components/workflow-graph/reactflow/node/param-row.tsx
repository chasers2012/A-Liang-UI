import type { NodeParamModel } from '@/models/nodes/dto';
import { memo, useCallback, useMemo, useState } from 'react';
import { useStore } from 'reactflow';
import {
  BooleanParamRow,
  DateParamRow,
  DateTimeParamRow,
  NumberParamRow,
  RjsfParamRow,
  SelectParamRow,
  StringParamRow,
  TextareaParamRow,
} from './params';
import { WorkflowHandle } from './workflow-handle';
import { isValueTypeCompatible } from '../../value-type';

// eslint-disable-next-line complexity
function pickSourceValueTypeFromStore(s: unknown): string | null {
  const anyState = s as {
    connectionNodeId?: string | null;
    connectionHandleId?: string | null;
    connection?: {
      source?: string | null;
      sourceHandle?: string | null;
      inProgress?: boolean;
    } | null;
    getNodes?: () => Array<{ id: string; data?: unknown }>;
  };

  const inProgress = Boolean(anyState.connectionNodeId) || Boolean(anyState.connection?.inProgress);
  if (!inProgress) return null;
  if (!anyState.getNodes) return null;

  const sourceNodeId = anyState.connection?.source ?? anyState.connectionNodeId ?? null;
  const sourceHandleId = anyState.connection?.sourceHandle ?? anyState.connectionHandleId ?? null;
  if (!sourceNodeId || !sourceHandleId) return null;

  const nodes = anyState.getNodes();
  const n = nodes.find((x) => x.id === sourceNodeId);
  const outputs = (n?.data as { outputs?: { name: string; value_type: string }[] } | undefined)?.outputs ?? [];
  const hit = outputs.find((o) => o.name === String(sourceHandleId));
  return hit?.value_type ?? null;
}

export function nodeParamEffectiveValue(params: Record<string, unknown>, spec: NodeParamModel): unknown {
  if (Object.prototype.hasOwnProperty.call(params, spec.key)) {
    const v = params[spec.key];
    // Persisted graphs may contain explicit `null` / `undefined` for a param key.
    // In that case, fall back to spec default so schema-driven UI (e.g. RJSF dependencies)
    // can still render correctly.
    if (v === null || v === undefined) {
      return spec.default;
    }
    return v;
  }
  return spec.default;
}

const paramRenderConfig = {
  date: { Component: DateParamRow, supportsHandle: true },
  datetime: { Component: DateTimeParamRow, supportsHandle: true },
  select: { Component: SelectParamRow, supportsHandle: true },
  toggle: { Component: BooleanParamRow, supportsHandle: true },
  number: { Component: NumberParamRow, supportsHandle: true },
  // 后端 `StringNodeParam.render_type` 使用 `input`
  input: { Component: StringParamRow, supportsHandle: true },
  string: { Component: StringParamRow, supportsHandle: true },
  textarea: { Component: TextareaParamRow, supportsHandle: true },
  // rjsf 为复合表单，不提供单字段输入句柄。
  rjsf: { Component: RjsfParamRow, supportsHandle: false },
} as const;

export const ParamRow = memo(function ParamRow(props: {
  nodeId: string;
  spec: NodeParamModel;
  value: unknown;
  readOnly: boolean;
  onChange: (v: unknown) => void;
}) {
  const { nodeId, spec, value, readOnly, onChange } = props;
  const { key, label, type, render_type: rt, ...rest } = spec;
  void type;
  const renderLabel = label?.trim() || key;
  // 避免订阅整份 edges：只订阅“是否连接”这个派生值，减少无关更新导致的重渲染。
  const isConnectedSelector = useCallback(
    (s: unknown) => {
      const anyState = s as { edges?: Array<{ target?: string; targetHandle?: string | null }> };
      const edges = anyState.edges ?? [];
      for (const e of edges) {
        if (e.target !== nodeId) continue;
        if ((e.targetHandle ?? '') === key) return true;
      }
      return false;
    },
    [key, nodeId],
  );
  const isConnected = useStore(isConnectedSelector);
  const inputReadOnly = readOnly || isConnected;
  const isConnecting = useStore((s) => {
    const anyState = s as unknown as {
      connectionNodeId?: string | null;
      connection?: { inProgress?: boolean } | null;
    };
    return Boolean(anyState.connectionNodeId) || Boolean(anyState.connection?.inProgress);
  });
  const sourceValueType = useStore(pickSourceValueTypeFromStore);
  const [isHovering, setIsHovering] = useState(false);
  const showHandle = useMemo(
    () => isConnected || (!readOnly && isConnecting && isHovering),
    [isConnected, isConnecting, isHovering, readOnly],
  );
  const isTypeMismatch = useMemo(() => {
    if (!isConnecting) return false;
    return !isValueTypeCompatible(sourceValueType ?? '', spec.type ?? '');
  }, [isConnecting, sourceValueType, spec.type]);
  if (!rt) {
    return null;
  }
  if (!(rt in paramRenderConfig)) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Component, supportsHandle } = paramRenderConfig[rt as keyof typeof paramRenderConfig] as any;

  return (
    <div
      className="relative"
      onPointerEnter={() => {
        if (!readOnly && isConnecting) setIsHovering(true);
      }}
      onPointerLeave={() => {
        setIsHovering(false);
      }}
    >
      {supportsHandle ? (
        <WorkflowHandle
          isInput
          id={key}
          hidden={!showHandle}
          disabled={readOnly || isTypeMismatch}
          mismatch={isTypeMismatch}
        />
      ) : null}
      <div className="min-w-0">
        <Component label={renderLabel} readOnly={inputReadOnly} value={value} onChange={onChange} {...rest} />
      </div>
    </div>
  );
});
