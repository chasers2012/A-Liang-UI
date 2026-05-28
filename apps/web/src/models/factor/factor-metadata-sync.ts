import type { FactorDetailPublic, FactorParamSpecPublic } from './dto';
import { findCalcFunctionNode, findClassAssignmentNode, findClassBlockNode } from './web-tree-sitter-loader';
import { parsePythonNumberValue, parsePythonStringValue, withPythonTree, type TSNode } from '@/lib/python-parser';

function findTopLevelClassAssignmentValue(classBlock: TSNode, attr: string): TSNode | null {
  const assignment = findClassAssignmentNode(classBlock, attr);
  return assignment?.childForFieldName('right') ?? null;
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
      const key = parsePythonStringValue(keyNode);
      if (!key) continue;
      values.set(key, valueNode);
    }
    const name = parsePythonStringValue(values.get('name'));
    if (!name) continue;
    const label = parsePythonStringValue(values.get('label')) ?? name;
    parsed.push({
      name,
      label,
      default: parsePythonNumberValue(values.get('default')) ?? null,
      min: parsePythonNumberValue(values.get('min')) ?? null,
      max: parsePythonNumberValue(values.get('max')) ?? null,
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

function replaceClassAttrValue(source: string, attr: string, nextValue: string): string {
  try {
    return (
      withPythonTree(source, (root) => {
        const classBlock = findClassBlockNode(root);
        if (!classBlock) throw new Error('class block not found');
        const assignment = findClassAssignmentNode(classBlock, attr);
        if (!assignment) throw new Error(`assignment not found for ${attr}`);
        const right = assignment.childForFieldName('right');
        if (!right) throw new Error(`assignment right value not found for ${attr}`);
        return source.slice(0, right.startIndex) + nextValue + source.slice(right.endIndex);
      }) ?? source
    );
  } catch (e) {
    console.error(e);
    return source;
  }
}

function replaceCalcDependenciesInSource(source: string, deps: string[]): string {
  return (
    withPythonTree(source, (root) => {
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
    }) ?? source
  );
}

export function applyFactorNameToSource(source: string, name: string): string {
  const n = name.trim() || 'my_factor';
  return replaceClassAttrValue(source, 'name', `"${escapePyDoubleQuoted(n)}"`);
}

export function applyFactorGroupToSource(source: string, group: string): string {
  return replaceClassAttrValue(source, 'group', `"${escapePyDoubleQuoted(group.trim())}"`);
}

export function applyFactorDescriptionToSource(source: string, description: string): string {
  return replaceClassAttrValue(source, 'description', `"${escapePyDoubleQuoted(description)}"`);
}

export function applyFactorWindowToSource(source: string, window: number): string {
  if (!Number.isFinite(window) || window < 1) return source;
  return replaceClassAttrValue(source, 'window', String(window));
}

export function applyFactorDependenciesToSource(source: string, deps: string[]): string {
  return replaceCalcDependenciesInSource(source, deps);
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

export function applyFactorParamSpecsToSource(source: string, specs: FactorParamSpecPublic[]): string {
  if (!Array.isArray(specs)) return source;
  return (
    withPythonTree(source, (root) => {
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
    }) ?? source
  );
}

export function parseFactorNameFromSource(source: string): string | undefined {
  return withPythonTree(source, (root) => {
    const classBlock = findClassBlockNode(root);
    if (!classBlock) return;
    const v = findTopLevelClassAssignmentValue(classBlock, 'name');
    return parsePythonStringValue(v);
  });
}

export function parseFactorGroupFromSource(source: string): string | undefined {
  return withPythonTree(source, (root) => {
    const classBlock = findClassBlockNode(root);
    if (!classBlock) return;
    const v = findTopLevelClassAssignmentValue(classBlock, 'group');
    return parsePythonStringValue(v);
  });
}

export function parseFactorDescriptionFromSource(source: string): string | undefined {
  return withPythonTree(source, (root) => {
    const classBlock = findClassBlockNode(root);
    if (!classBlock) return;
    const v = findTopLevelClassAssignmentValue(classBlock, 'description');
    return parsePythonStringValue(v);
  });
}

export function parseFactorWindowFromSource(source: string): number | undefined {
  return withPythonTree(source, (root) => {
    const classBlock = findClassBlockNode(root);
    if (!classBlock) return;
    const v = findTopLevelClassAssignmentValue(classBlock, 'window');
    return parsePythonNumberValue(v);
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
        const v = parsePythonStringValue(name);
        if (v !== undefined) out.name = v;
      }
      const group = findTopLevelClassAssignmentValue(classBlock, 'group');
      if (group) {
        const v = parsePythonStringValue(group);
        if (v !== undefined) out.group = v;
      }
      const description = findTopLevelClassAssignmentValue(classBlock, 'description');
      if (description) {
        const v = parsePythonStringValue(description);
        if (v !== undefined) out.description = v;
      }
      const window = findTopLevelClassAssignmentValue(classBlock, 'window');
      if (window) {
        const v = parsePythonNumberValue(window);
        if (v !== undefined) out.window = v;
      }
      const deps = getCalcParamsFromTree(root);
      if (deps) out.dependencies = deps;
      return out;
    }) ?? {}
  );
}
