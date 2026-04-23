import type { FactorDetailPublic } from './dto';

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

function patchUserFactorBody(block: string, form: FactorDetailPublic): string {
  const name = form.name.trim() || 'my_factor';
  let b = block;
  b = replaceStringAttr(b, 'name', name);
  b = replaceStringAttr(b, 'group', form.group.trim());
  b = replaceStringAttr(b, 'description', form.description);
  const w = form.window;
  if (Number.isFinite(w) && w >= 1) {
    b = replaceNumberAttr(b, 'window', w);
  }
  return b;
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

/**
 * Push form field values into `NewFactor` class attributes in source when that
 * class exists; otherwise returns the original source (no whole-file guess).
 */
export function applyFormMetadataToSource(source: string, form: FactorDetailPublic): string {
  const range = findUserFactorClassBodyRange(source);
  const deps = form.dependencies;
  let out = source;
  if (range) {
    const { start, end } = range;
    const newMid = patchUserFactorBody(source.slice(start, end), form);
    out = source.slice(0, start) + newMid + source.slice(end);
  }
  return replaceCalcDependenciesInSource(out, deps);
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
