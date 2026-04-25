import type { FactorDetailPublic, FactorParamSpecPublic } from './dto';
import {
  findCalcFunctionNode,
  findClassAssignmentNode,
  findClassBlockNode,
  withPythonTree,
  withPythonTreeAsync,
  type TSNode,
} from './web-tree-sitter-loader';

function findTopLevelClassAssignmentValue(classBlock: TSNode, attr: string): TSNode | null {
  const assignment = findClassAssignmentNode(classBlock, attr);
  return assignment?.childForFieldName('right') ?? null;
}

function parsePythonEscapeSequence(raw: string): string {
  if (raw === '\\n') return '\n';
  if (raw === '\\r') return '\r';
  if (raw === '\\t') return '\t';
  if (raw === '\\\\') return '\\';
  if (raw === '\\"') return '"';
  if (raw === "\\'") return "'";
  return raw.startsWith('\\') ? raw.slice(1) : raw;
}

function parseStringValueNode(node: TSNode | null | undefined): string | undefined {
  if (!node || node.type !== 'string') return;
  const chunks: string[] = [];
  const textParts = node.descendantsOfType(['string_content', 'escape_sequence']);
  if (textParts.length === 0) return '';
  for (const part of textParts) {
    if (part.type === 'escape_sequence') {
      chunks.push(parsePythonEscapeSequence(part.text));
    } else {
      chunks.push(part.text);
    }
  }
  return chunks.join('');
}

function parseNumberValueNode(node: TSNode | null | undefined): number | undefined {
  if (!node) return;
  if (node.type === 'none') return;
  if (node.type !== 'integer' && node.type !== 'float') return;
  const n = Number(node.text);
  return Number.isFinite(n) ? n : undefined;
}

type CalcParamsInfo = {
  deps: string[];
  varKeywordRaw: string | null;
};

function extractParameterName(node: TSNode): string | null {
  const byField = node.childForFieldName('name')?.text?.trim();
  if (byField) return byField;
  if (node.type === 'identifier') {
    const id = node.text.trim();
    return id || null;
  }
  const ids = node.descendantsOfType('identifier');
  if (ids.length > 0) {
    const id = ids[0].text.trim();
    return id || null;
  }
  return null;
}

function parseCalcParamsInfo(paramsNode: TSNode | null | undefined): CalcParamsInfo | null {
  if (!paramsNode) return null;
  const deps: string[] = [];
  let varKeywordRaw: string | null = null;
  for (const node of paramsNode.namedChildren) {
    if (node.type === 'keyword_separator') continue;
    const raw = node.text.trim();
    if (!raw || raw === '*' || raw === '/') continue;
    if (raw.startsWith('**')) {
      varKeywordRaw = raw;
      continue;
    }
    const name = extractParameterName(node) ?? '';
    if (!name || name === 'self') continue;
    deps.push(name);
  }
  return { deps, varKeywordRaw };
}

function getCalcParamsFromTree(root: TSNode): string[] | null {
  const calcNode = findCalcFunctionNode(root);
  const info = parseCalcParamsInfo(calcNode?.childForFieldName('parameters'));
  return info?.deps ?? null;
}

function parseParamSpecsFromTree(root: TSNode): FactorParamSpecPublic[] | undefined {
  const classBlock = findClassBlockNode(root);
  if (!classBlock) return;
  const rhs = findTopLevelClassAssignmentValue(classBlock, 'param_specs');
  if (!rhs) return [];
  const dictNodes = rhs.descendantsOfType('dictionary');
  const parsed: FactorParamSpecPublic[] = [];
  for (const dictNode of dictNodes) {
    const pairNodes = dictNode.namedChildren.filter((n) => n.type === 'pair');
    const values = new Map<string, TSNode>();
    for (const pair of pairNodes) {
      const keyNode = pair.childForFieldName('key');
      const valueNode = pair.childForFieldName('value');
      if (!keyNode || !valueNode) continue;
      const key = parseStringValueNode(keyNode);
      if (!key) continue;
      values.set(key, valueNode);
    }
    const name = parseStringValueNode(values.get('name'));
    if (!name) continue;
    const label = parseStringValueNode(values.get('label')) ?? name;
    parsed.push({
      name,
      label,
      default: parseNumberValueNode(values.get('default')) ?? null,
      min: parseNumberValueNode(values.get('min')) ?? null,
      max: parseNumberValueNode(values.get('max')) ?? null,
    });
  }
  return parsed;
}

function escapePyDoubleQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
}

function getLineIndent(source: string, index: number): string {
  const lineStart = source.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
  let i = lineStart;
  while (i < source.length && (source[i] === ' ' || source[i] === '\t')) i++;
  return source.slice(lineStart, i);
}

async function replaceClassAttrValue(source: string, attr: string, nextValue: string): Promise<string> {
  try {
    return (
      (await withPythonTreeAsync(source, (root) => {
        const classBlock = findClassBlockNode(root);
        if (!classBlock) throw new Error('class block not found');
        const assignments = classBlock.namedChildren.filter((n) => n.type === 'assignment');
        console.log('[factor][replaceClassAttrValue] target attr:', attr);
        console.log('[factor][replaceClassAttrValue] class block text preview:', classBlock.text.slice(0, 400));
        console.log(
          '[factor][replaceClassAttrValue] assignments:',
          assignments.map((a) => {
            const left = a.childForFieldName('left')?.text ?? '<missing-left>';
            const right = a.childForFieldName('right')?.text ?? '<missing-right>';
            return { left, right };
          }),
        );
        const assignment = findClassAssignmentNode(classBlock, attr);
        if (!assignment) throw new Error(`assignment not found for ${attr}`);
        const right = assignment.childForFieldName('right');
        if (!right) throw new Error(`assignment right value not found for ${attr}`);
        return source.slice(0, right.startIndex) + nextValue + source.slice(right.endIndex);
      })) ?? source
    );
  } catch (e) {
    console.error(e);
    return source;
  }
}

async function replaceCalcDependenciesInSource(source: string, deps: string[]): Promise<string> {
  return (
    (await withPythonTreeAsync(source, (root) => {
      const calcNode = findCalcFunctionNode(root);
      const paramsNode = calcNode?.childForFieldName('parameters');
      if (!paramsNode) return source;
      const info = parseCalcParamsInfo(paramsNode);
      if (!info) return source;
      const depParams = deps.map((d) => `${d}: pd.DataFrame`);
      const merged = info.varKeywordRaw ? [...depParams, info.varKeywordRaw] : depParams;
      const joined = merged.join(', ');
      const replacement = `(${['self', joined].filter(Boolean).join(', ')})`;
      return source.slice(0, paramsNode.startIndex) + replacement + source.slice(paramsNode.endIndex);
    })) ?? source
  );
}

export async function applyFactorNameToSource(source: string, name: string): Promise<string> {
  const n = name.trim() || 'my_factor';
  return await replaceClassAttrValue(source, 'name', `"${escapePyDoubleQuoted(n)}"`);
}

export async function applyFactorGroupToSource(source: string, group: string): Promise<string> {
  return await replaceClassAttrValue(source, 'group', `"${escapePyDoubleQuoted(group.trim())}"`);
}

export async function applyFactorDescriptionToSource(source: string, description: string): Promise<string> {
  return await replaceClassAttrValue(source, 'description', `"${escapePyDoubleQuoted(description)}"`);
}

export async function applyFactorWindowToSource(source: string, window: number): Promise<string> {
  if (!Number.isFinite(window) || window < 1) return source;
  return await replaceClassAttrValue(source, 'window', String(window));
}

export async function applyFactorDependenciesToSource(source: string, deps: string[]): Promise<string> {
  return await replaceCalcDependenciesInSource(source, deps);
}

export function parseFactorParamSpecsFromSource(source: string): FactorParamSpecPublic[] | undefined {
  return withPythonTree(source, parseParamSpecsFromTree);
}

function formatNumberForPython(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'None';
  return String(n);
}

function renderParamSpecsTuple(specs: FactorParamSpecPublic[], indent: string): string {
  if (specs.length === 0) return `${indent}param_specs = ()`;
  const rows = specs.map(
    (p) =>
      `${indent}    {"name": "${p.name}", "label": "${p.label}", "default": ${formatNumberForPython(p.default)}, "min": ${formatNumberForPython(p.min)}, "max": ${formatNumberForPython(p.max)}},`,
  );
  return [`${indent}param_specs = (`, ...rows, `${indent})`].join('\n');
}

export async function applyFactorParamSpecsToSource(source: string, specs: FactorParamSpecPublic[]): Promise<string> {
  if (!Array.isArray(specs)) return source;
  return (
    (await withPythonTreeAsync(source, (root) => {
      const classBlock = findClassBlockNode(root);
      if (!classBlock) return source;
      const assignment = findClassAssignmentNode(classBlock, 'param_specs');
      const indent = assignment ? getLineIndent(source, assignment.startIndex) : '    ';
      const rendered = renderParamSpecsTuple(specs, indent);
      if (!assignment) {
        const blockText = source.slice(classBlock.startIndex, classBlock.endIndex);
        const leadingNl = blockText.startsWith('\n') ? '' : '\n';
        return (
          source.slice(0, classBlock.startIndex) + `${leadingNl}${rendered}\n` + source.slice(classBlock.startIndex)
        );
      }
      const replaceStart = source.lastIndexOf('\n', Math.max(0, assignment.startIndex - 1)) + 1;
      return source.slice(0, replaceStart) + rendered + source.slice(assignment.endIndex);
    })) ?? source
  );
}

export function parseFactorNameFromSource(source: string): string | undefined {
  return withPythonTree(source, (root) => {
    const classBlock = findClassBlockNode(root);
    if (!classBlock) return;
    const v = findTopLevelClassAssignmentValue(classBlock, 'name');
    return parseStringValueNode(v);
  });
}

export function parseFactorGroupFromSource(source: string): string | undefined {
  return withPythonTree(source, (root) => {
    const classBlock = findClassBlockNode(root);
    if (!classBlock) return;
    const v = findTopLevelClassAssignmentValue(classBlock, 'group');
    return parseStringValueNode(v);
  });
}

export function parseFactorDescriptionFromSource(source: string): string | undefined {
  return withPythonTree(source, (root) => {
    const classBlock = findClassBlockNode(root);
    if (!classBlock) return;
    const v = findTopLevelClassAssignmentValue(classBlock, 'description');
    return parseStringValueNode(v);
  });
}

export function parseFactorWindowFromSource(source: string): number | undefined {
  return withPythonTree(source, (root) => {
    const classBlock = findClassBlockNode(root);
    if (!classBlock) return;
    const v = findTopLevelClassAssignmentValue(classBlock, 'window');
    return parseNumberValueNode(v);
  });
}

export function parseFactorDependenciesFromSource(source: string): string[] | undefined {
  return withPythonTree(source, (root) => getCalcParamsFromTree(root) ?? undefined);
}

/**
 * Read `NewFactor` class attributes from source into form-shaped fields.
 * Only keys that are successfully parsed are set (partial object).
 */
export function parseUserFactorMetadataFromSource(source: string): Partial<FactorDetailPublic> {
  return (
    withPythonTree(source, (root) => {
      const classBlock = findClassBlockNode(root);
      if (!classBlock) return {};

      const out: Partial<FactorDetailPublic> = {};
      const name = findTopLevelClassAssignmentValue(classBlock, 'name');
      if (name) {
        const v = parseStringValueNode(name);
        if (v !== undefined) out.name = v;
      }
      const group = findTopLevelClassAssignmentValue(classBlock, 'group');
      if (group) {
        const v = parseStringValueNode(group);
        if (v !== undefined) out.group = v;
      }
      const description = findTopLevelClassAssignmentValue(classBlock, 'description');
      if (description) {
        const v = parseStringValueNode(description);
        if (v !== undefined) out.description = v;
      }
      const window = findTopLevelClassAssignmentValue(classBlock, 'window');
      if (window) {
        const v = parseNumberValueNode(window);
        if (v !== undefined) out.window = v;
      }
      const deps = getCalcParamsFromTree(root);
      if (deps) out.dependencies = deps;
      return out;
    }) ?? {}
  );
}
