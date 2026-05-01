export type TSNode = {
  type: string;
  text: string;
  startIndex: number;
  endIndex: number;
  namedChildren: TSNode[];
  childForFieldName(fieldName: string): TSNode | null;
  descendantsOfType(types: string | string[]): TSNode[];
};

type TSTree = { rootNode: TSNode; delete(): void };
type TSParserInstance = { parse(source: string): TSTree | null; setLanguage(language: unknown): unknown };
type TSParserCtor = {
  new (): TSParserInstance;
  init(options?: { locateFile?: (scriptName: string) => string }): Promise<void>;
};
type TSRuntimeModule = {
  Parser: TSParserCtor;
  Language: { load(path: string): Promise<unknown> };
};

export type ParsedPythonArgs = { positional: unknown[]; keyword: Record<string, unknown> };
export type ParsedPythonCall = { callee: string; args: ParsedPythonArgs } | null;

async function createPythonParser(): Promise<TSParserInstance | null> {
  if (typeof window === 'undefined') return null;
  try {
    const runtimePath = '/web-tree-sitter.js';
    const mod = (await import(/* webpackIgnore: true */ runtimePath)) as TSRuntimeModule;
    await mod.Parser.init({ locateFile: (scriptName: string) => `/${scriptName}` });
    const language = await mod.Language.load('/tree-sitter-python.wasm');
    const parser = new mod.Parser();
    parser.setLanguage(language);
    return parser;
  } catch (error) {
    console.error('[python-parser] failed to initialize web-tree-sitter parser', error);
    return null;
  }
}

const parser = await createPythonParser();

export function parsePython(code: string): TSTree | null {
  return parser?.parse(code) ?? null;
}

export function withPythonTree<T>(source: string, runner: (root: TSNode) => T | undefined): T | undefined {
  const tree = parsePython(source);
  if (!tree) return;
  try {
    return runner(tree.rootNode);
  } finally {
    tree.delete();
  }
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

/**
 * Parse a `string` node (tree-sitter-python) into JS string.
 * Supports regular strings and triple-quoted strings.
 */
export function parsePythonStringValue(node: TSNode | null | undefined): string | undefined {
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

export function parsePythonNumberValue(node: TSNode | null | undefined): number | undefined {
  if (!node) return;
  if (node.type === 'none') return;
  if (node.type !== 'integer' && node.type !== 'float') return;
  const n = Number(node.text);
  return Number.isFinite(n) ? n : undefined;
}

/** Convert a tree-sitter-python node into a JS literal-ish value. */
export function parsePythonLiteral(node: TSNode | null | undefined): unknown {
  if (!node) return undefined;
  if (node.type === 'string') return parsePythonStringValue(node);
  if (node.type === 'integer') return parseInt(node.text, 10);
  if (node.type === 'float') return parseFloat(node.text);
  if (node.type === 'true') return true;
  if (node.type === 'false') return false;
  if (node.type === 'none') return null;
  if (node.type === 'identifier') {
    if (node.text === 'True') return true;
    if (node.text === 'False') return false;
    if (node.text === 'None') return null;
    return node.text;
  }
  if (node.type === 'list') return node.namedChildren.map(parsePythonLiteral);
  return node.text;
}

/** BFS find all nodes of given type. */
export function findNodes(root: TSNode, type: string): TSNode[] {
  const results: TSNode[] = [];
  const queue: TSNode[] = [root];
  while (queue.length) {
    const node = queue.shift();
    if (!node) break;
    if (node.type === type) results.push(node);
    queue.push(...node.namedChildren);
  }
  return results;
}

/** DFS find first node of given type. */
export function findFirst(node: TSNode, type: string): TSNode | null {
  if (node.type === type) return node;
  for (const child of node.namedChildren) {
    const found = findFirst(child, type);
    if (found) return found;
  }
  return null;
}

export function parsePythonArgs(argsNode: TSNode): ParsedPythonArgs {
  const positional: unknown[] = [];
  const keyword: Record<string, unknown> = {};

  for (const child of argsNode.namedChildren) {
    if (child.type === 'keyword_argument') {
      const name = child.childForFieldName('name')?.text.trim();
      if (!name) continue;
      keyword[name] = parsePythonLiteral(child.childForFieldName('value'));
      continue;
    }
    positional.push(parsePythonLiteral(child));
  }

  return { positional, keyword };
}

export function parsePythonCall(callNode: TSNode): ParsedPythonCall {
  const funcNode = callNode.childForFieldName('function');
  const argsNode = callNode.childForFieldName('arguments');
  if (!funcNode || !argsNode) return null;
  return { callee: funcNode.text.trim(), args: parsePythonArgs(argsNode) };
}
