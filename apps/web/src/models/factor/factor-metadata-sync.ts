import type { FactorDetailPublic, FactorParamSpecPublic } from './dto';

function escapePyDoubleQuoted(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r\n/g, '\n').replace(/\n/g, '\\n');
}

/** Replace `attr = "..."` or `attr = '...'` on a line (multiline ^). */
function replaceStringAttr(block: string, attr: string, value: string): string {
  const py = `"${escapePyDoubleQuoted(value)}"`;
  const re = new RegExp(`^([ \\t]*)${attr}\\s*=\\s*(?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')`, 'm');
  return re.test(block) ? block.replace(re, `$1${attr} = ${py}`) : block;
}

function replaceNumberAttr(block: string, attr: string, n: number): string {
  const re = new RegExp(`^([ \\t]*)${attr}\\s*=\\s*\\d+`, 'm');
  return re.test(block) ? block.replace(re, `$1${attr} = ${n}`) : block;
}

/** Single-line `dependencies = [...]` in class body. */
function findUserFactorClassBodyRange(source: string): { start: number; end: number } | null {
  const classRe = /^class\s+NewFactor\s*\(\s*Factor\s*\)\s*:\s*/m;
  const m = classRe.exec(source);
  if (!m || m.index === undefined) return null;
  const bodyStart = m.index + m[0].length;
  const after = source.slice(bodyStart);
  const defMatch = /\n[ \t]*def\s+\w+\s*\(/.exec(after);
  const end = defMatch ? bodyStart + defMatch.index : source.length;
  return { start: bodyStart, end };
}

function patchUserFactorClassBody(source: string, patch: (block: string) => string): string {
  const range = findUserFactorClassBodyRange(source);
  if (!range) return source;
  const { start, end } = range;
  const newMid = patch(source.slice(start, end));
  return source.slice(0, start) + newMid + source.slice(end);
}

type CalcParam = {
  raw: string;
  name: string;
  isVarKeyword: boolean;
};

function splitTopLevelParams(s: string): string[] {
  const out: string[] = [];
  let start = 0;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}

function parseCalcParams(rawParams: string): CalcParam[] {
  return splitTopLevelParams(rawParams)
    .map((raw) => {
      const p = raw.trim();
      if (!p) return null;
      const isVarKeyword = p.startsWith('**');
      const core = p.replace(/^\*\*?/, '');
      const name = core.split(':', 1)[0].split('=', 1)[0].trim();
      if (!name || name === 'self') return null;
      return { raw: p, name, isVarKeyword };
    })
    .filter((x): x is CalcParam => x !== null);
}

function findCalcSignatureRange(source: string): { start: number; end: number; indent: string; params: string } | null {
  const re = /^([ \t]*)def\s+calc\s*\(\s*self(?:\s*,\s*([^)]*))?\)\s*(?:->\s*[^:]+)?\s*:/m;
  const m = re.exec(source);
  if (!m || m.index === undefined) return null;
  const full = m[0];
  const start = m.index;
  const end = start + full.length;
  return {
    start,
    end,
    indent: m[1] ?? '',
    params: (m[2] ?? '').trim(),
  };
}

function replaceCalcDependenciesInSource(source: string, deps: string[]): string {
  const sig = findCalcSignatureRange(source);
  if (!sig) return source;

  const existing = parseCalcParams(sig.params);
  const varKeyword = existing.find((p) => p.isVarKeyword);
  const depParams = deps.map((d) => `${d}: pd.DataFrame`);
  const merged = varKeyword ? [...depParams, varKeyword.raw] : depParams;
  const joined = merged.join(', ');
  const replacement = `${sig.indent}def calc(self${joined ? `, ${joined}` : ''}) -> pd.DataFrame:`;
  return source.slice(0, sig.start) + replacement + source.slice(sig.end);
}

export function applyFactorNameToSource(source: string, name: string): string {
  const n = name.trim() || 'my_factor';
  return patchUserFactorClassBody(source, (block) => replaceStringAttr(block, 'name', n));
}

export function applyFactorGroupToSource(source: string, group: string): string {
  return patchUserFactorClassBody(source, (block) => replaceStringAttr(block, 'group', group.trim()));
}

export function applyFactorDescriptionToSource(source: string, description: string): string {
  return patchUserFactorClassBody(source, (block) => replaceStringAttr(block, 'description', description));
}

export function applyFactorWindowToSource(source: string, window: number): string {
  if (!Number.isFinite(window) || window < 1) return source;
  return patchUserFactorClassBody(source, (block) => replaceNumberAttr(block, 'window', window));
}

export function applyFactorDependenciesToSource(source: string, deps: string[]): string {
  return replaceCalcDependenciesInSource(source, deps);
}

function parseNumberOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s === 'None' || s === 'null') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function extractParamSpecsBodyFromClassBlock(block: string): string | null {
  const assignMatch = /^([ \t]*)param_specs\s*=\s*/m.exec(block);
  if (!assignMatch || assignMatch.index === undefined) return null;
  const assignRange = parseParamSpecsAssignRange(block, assignMatch.index);
  if (!assignRange) return null;

  const assignText = block.slice(assignRange.start, assignRange.end);
  const eqPos = assignText.indexOf('=');
  if (eqPos < 0) return null;
  const rhs = assignText.slice(eqPos + 1).trim();

  // Accept tuple/list literal or a one-liner `param_specs = ()`.
  if ((rhs.startsWith('(') && rhs.endsWith(')')) || (rhs.startsWith('[') && rhs.endsWith(']'))) return rhs.slice(1, -1);
  return rhs;
}

export function parseFactorParamSpecsFromSource(source: string): FactorParamSpecPublic[] | undefined {
  const block = getUserFactorClassBody(source);
  if (!block) return;
  const body = extractParamSpecsBodyFromClassBlock(block);
  if (body === null) return [];
  const dicts = body.match(/\{[^{}]*\}/g) ?? [];
  const parsed: FactorParamSpecPublic[] = [];
  for (const d of dicts) {
    const name = d.match(/["']name["']\s*:\s*["']([^"']+)["']/)?.[1] ?? '';
    if (!name) continue;
    const label = d.match(/["']label["']\s*:\s*["']([^"']*)["']/)?.[1] ?? name;
    const defRaw = d.match(/["']default["']\s*:\s*([^,}\n]+)/)?.[1];
    const minRaw = d.match(/["']min["']\s*:\s*([^,}\n]+)/)?.[1];
    const maxRaw = d.match(/["']max["']\s*:\s*([^,}\n]+)/)?.[1];
    parsed.push({
      name,
      label,
      default: parseNumberOrNull(defRaw),
      min: parseNumberOrNull(minRaw),
      max: parseNumberOrNull(maxRaw),
    });
  }
  return parsed;
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

function parseParamSpecsAssignRange(block: string, assignStart: number): { start: number; end: number } | null {
  const eqPos = block.indexOf('=', assignStart);
  if (eqPos < 0) return null;
  let i = eqPos + 1;
  while (i < block.length && /\s/.test(block[i])) i++;
  if (i >= block.length) return null;
  const open = block[i];
  const close = open === '(' ? ')' : open === '[' ? ']' : null;
  if (!close) {
    let end = i;
    while (end < block.length && block[end] !== '\n') end++;
    return { start: assignStart, end };
  }
  let depth = 0;
  let end = i;
  for (; end < block.length; end++) {
    const ch = block[end];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        end++;
        break;
      }
    }
  }
  return { start: assignStart, end };
}

export function applyFactorParamSpecsToSource(source: string, specs: FactorParamSpecPublic[]): string {
  const ret = patchUserFactorClassBody(source, (block) => {
    const lineIndentMatch = block.match(/\n([ \t]+)[A-Za-z_]\w*\s*=/);
    const indent = lineIndentMatch?.[1] ?? '    ';
    const rendered = renderParamSpecsTuple(specs, indent);
    const assignMatch = /^([ \t]*)param_specs\s*=\s*/m.exec(block);
    if (!assignMatch || assignMatch.index === undefined) {
      const leadingNl = block.startsWith('\n') ? '' : '\n';
      return `${leadingNl}${rendered}\n${block}`;
    }
    const assignRange = parseParamSpecsAssignRange(block, assignMatch.index);
    if (!assignRange) return block;
    return `${block.slice(0, assignRange.start)}${rendered}${block.slice(assignRange.end)}`;
  });
  return ret;
}

export function parseFactorNameFromSource(source: string): string | undefined {
  const block = getUserFactorClassBody(source);
  if (!block) return;
  const v = parseStringAttr(block, 'name');
  if (v === null) return;
  return v;
}

export function parseFactorGroupFromSource(source: string): string | undefined {
  const block = getUserFactorClassBody(source);
  if (!block) return;
  const v = parseStringAttr(block, 'group');
  if (v === null) return;
  return v;
}

export function parseFactorDescriptionFromSource(source: string): string | undefined {
  const block = getUserFactorClassBody(source);
  if (!block) return;
  const v = parseStringAttr(block, 'description');
  if (v === null) return;
  return v;
}

export function parseFactorWindowFromSource(source: string): number | undefined {
  const block = getUserFactorClassBody(source);
  if (!block) return;
  const raw = parseWindow(block);
  if (raw === null) return;
  return Number.parseInt(raw, 10);
}

export function parseFactorDependenciesFromSource(source: string): string[] | undefined {
  const deps = parseDependenciesCsvFromCalc(source);
  if (deps === null) return;
  return deps
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getUserFactorClassBody(source: string): string | null {
  const range = findUserFactorClassBodyRange(source);
  if (!range) return null;
  return source.slice(range.start, range.end);
}

function unescapePyString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '\\' && i + 1 < raw.length) {
      const n = raw[++i];
      if (n === 'n') out += '\n';
      else if (n === 'r') out += '\r';
      else if (n === 't') out += '\t';
      else if (n === '\\') out += '\\';
      else if (n === '"') out += '"';
      else if (n === "'") out += "'";
      else out += n;
    } else {
      out += c;
    }
  }
  return out;
}

function parseStringAttr(block: string, attr: string): string | null {
  const reD = new RegExp(`^\\s*${attr}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm');
  let m = reD.exec(block);
  if (m) return unescapePyString(m[1]);
  const reS = new RegExp(`^\\s*${attr}\\s*=\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm');
  m = reS.exec(block);
  if (m) return unescapePyString(m[1]);
  return null;
}

function parseWindow(block: string): string | null {
  const m = block.match(/^\s*window\s*=\s*(\d+)/m);
  return m ? m[1] : null;
}

function parseDependenciesCsvFromCalc(source: string): string | null {
  const sig = findCalcSignatureRange(source);
  if (!sig) return null;
  const deps = parseCalcParams(sig.params)
    .filter((p) => !p.isVarKeyword)
    .map((p) => p.name);
  return deps.join(', ');
}

/**
 * Read `NewFactor` class attributes from source into form-shaped fields.
 * Only keys that are successfully parsed are set (partial object).
 */
export function parseUserFactorMetadataFromSource(source: string): Partial<FactorDetailPublic> {
  const block = getUserFactorClassBody(source);
  if (!block) return {};

  const out: Partial<FactorDetailPublic> = {};
  const n = parseStringAttr(block, 'name');
  if (n !== null) out.name = n;
  const group = parseStringAttr(block, 'group');
  if (group !== null) out.group = group;
  const description = parseStringAttr(block, 'description');
  if (description !== null) out.description = description;
  const w = parseWindow(block);
  if (w !== null) out.window = Number.parseInt(w, 10);
  const deps = parseDependenciesCsvFromCalc(source);
  if (deps !== null) {
    out.dependencies = deps
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return out;
}
