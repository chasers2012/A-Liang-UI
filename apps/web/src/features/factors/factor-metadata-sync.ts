import type { FactorFormState } from "./form-model";
import { parseDependencies } from "./form-model";

function escapePyDoubleQuoted(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\\n");
}

/** Replace `attr = "..."` or `attr = '...'` on a line (multiline ^). */
function replaceStringAttr(block: string, attr: string, value: string): string {
  const py = `"${escapePyDoubleQuoted(value)}"`;
  const re = new RegExp(
    `^([ \\t]*)${attr}\\s*=\\s*(?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')`,
    "m",
  );
  return re.test(block) ? block.replace(re, `$1${attr} = ${py}`) : block;
}

function replaceNumberAttr(block: string, attr: string, n: number): string {
  const re = new RegExp(`^([ \\t]*)${attr}\\s*=\\s*\\d+`, "m");
  return re.test(block) ? block.replace(re, `$1${attr} = ${n}`) : block;
}

/** Single-line `dependencies = [...]` in class body. */
function replaceDependenciesAttr(block: string, items: string[]): string {
  const inner = items.map((x) => JSON.stringify(x)).join(", ");
  const re = /^([ \t]*)dependencies\s*=\s*\[[^\]]*\]/m;
  return re.test(block)
    ? block.replace(re, `$1dependencies = [${inner}]`)
    : block;
}

function findUserFactorClassBodyRange(
  source: string,
): { start: number; end: number } | null {
  const classRe = /^class\s+UserFactor\s*\(\s*Factor\s*\)\s*:\s*/m;
  const m = classRe.exec(source);
  if (!m || m.index === undefined) return null;
  const bodyStart = m.index + m[0].length;
  const after = source.slice(bodyStart);
  const defMatch = /\n[ \t]*def\s+\w+\s*\(/.exec(after);
  const end = defMatch ? bodyStart + defMatch.index : source.length;
  return { start: bodyStart, end };
}

function patchUserFactorBody(block: string, form: FactorFormState): string {
  const name = form.name.trim() || "my_factor";
  let b = block;
  b = replaceStringAttr(b, "name", name);
  b = replaceStringAttr(b, "group", form.group.trim() || "factor");
  b = replaceStringAttr(b, "group_label", form.group_label.trim() || "因子");
  b = replaceStringAttr(b, "description", form.description);
  const mw = Number.parseInt(form.max_window, 10);
  if (Number.isFinite(mw) && mw >= 1) {
    b = replaceNumberAttr(b, "max_window", mw);
  }
  const deps = parseDependencies(form.dependencies_csv);
  if (deps.length > 0) {
    b = replaceDependenciesAttr(b, deps);
  }
  return b;
}

/**
 * Push form field values into `UserFactor` class attributes in source when that
 * class exists; otherwise returns the original source (no whole-file guess).
 */
export function applyFormMetadataToSource(
  source: string,
  form: FactorFormState,
): string {
  const range = findUserFactorClassBodyRange(source);
  if (!range) return source;
  const { start, end } = range;
  const newMid = patchUserFactorBody(source.slice(start, end), form);
  return source.slice(0, start) + newMid + source.slice(end);
}

function getUserFactorClassBody(source: string): string | null {
  const range = findUserFactorClassBodyRange(source);
  if (!range) return null;
  return source.slice(range.start, range.end);
}

function unescapePyString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\" && i + 1 < raw.length) {
      const n = raw[++i];
      if (n === "n") out += "\n";
      else if (n === "r") out += "\r";
      else if (n === "t") out += "\t";
      else if (n === "\\") out += "\\";
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
  const reD = new RegExp(
    `^\\s*${attr}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`,
    "m",
  );
  let m = reD.exec(block);
  if (m) return unescapePyString(m[1]);
  const reS = new RegExp(
    `^\\s*${attr}\\s*=\\s*'((?:[^'\\\\]|\\\\.)*)'`,
    "m",
  );
  m = reS.exec(block);
  if (m) return unescapePyString(m[1]);
  return null;
}

function parseMaxWindow(block: string): string | null {
  const mm = block.match(/^\s*max_window\s*=\s*(\d+)/m);
  return mm ? mm[1] : null;
}

function parseDependenciesCsv(block: string): string | null {
  const m = block.match(/^\s*dependencies\s*=\s*\[([^\]]*)\]/m);
  if (!m) return null;
  const inner = m[1].trim();
  if (!inner) return "";
  const items: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(inner)) !== null) {
    items.push(unescapePyString(mm[1] ?? mm[2]));
  }
  return items.join(", ");
}

/**
 * Read `UserFactor` class attributes from source into form-shaped fields.
 * Only keys that are successfully parsed are set (partial object).
 */
export function parseUserFactorMetadataFromSource(
  source: string,
): Partial<FactorFormState> {
  const block = getUserFactorClassBody(source);
  if (!block) return {};

  const out: Partial<FactorFormState> = {};
  const n = parseStringAttr(block, "name");
  if (n !== null) out.name = n;
  const group = parseStringAttr(block, "group");
  if (group !== null) out.group = group;
  const groupLabel = parseStringAttr(block, "group_label");
  if (groupLabel !== null) out.group_label = groupLabel;
  const description = parseStringAttr(block, "description");
  if (description !== null) out.description = description;
  const mw = parseMaxWindow(block);
  if (mw !== null) out.max_window = mw;
  const deps = parseDependenciesCsv(block);
  if (deps !== null) out.dependencies_csv = deps;
  return out;
}
