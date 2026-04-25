type TSNode = {
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

let pythonParser: TSParserInstance | null = null;
let pythonParserInitPromise: Promise<TSParserInstance | null> | null = null;

export async function ensurePythonParser(): Promise<TSParserInstance | null> {
  if (pythonParser) return pythonParser;
  if (typeof window === 'undefined') return null;
  if (!pythonParserInitPromise) {
    pythonParserInitPromise = (async () => {
      try {
        const runtimePath = '/web-tree-sitter.js';
        const mod = (await import(/* webpackIgnore: true */ runtimePath)) as TSRuntimeModule;
        await mod.Parser.init({ locateFile: (scriptName: string) => `/${scriptName}` });
        const language = await mod.Language.load('/tree-sitter-python.wasm');
        const parser = new mod.Parser();
        parser.setLanguage(language);
        pythonParser = parser;
        return parser;
      } catch (error) {
        console.error('[factor] failed to initialize web-tree-sitter parser', error);
        return null;
      }
    })();
  }
  return await pythonParserInitPromise;
}

export function withPythonTree<T>(source: string, runner: (root: TSNode) => T | undefined): T | undefined {
  const parser = pythonParser;
  if (!parser) return;
  const tree = parser.parse(source);
  if (!tree) return;
  try {
    return runner(tree.rootNode);
  } finally {
    tree.delete();
  }
}

export async function withPythonTreeAsync<T>(
  source: string,
  runner: (root: TSNode) => T | undefined,
): Promise<T | undefined> {
  const parser = await ensurePythonParser();
  if (!parser) return;
  const tree = parser.parse(source);
  if (!tree) return;
  try {
    return runner(tree.rootNode);
  } finally {
    tree.delete();
  }
}

export function findNewFactorClassNode(root: TSNode): TSNode | null {
  const classes = root.descendantsOfType('class_definition');
  if (classes.length === 0) return null;
  let firstFactorSubclass: TSNode | null = null;
  for (const cls of classes) {
    const superclasses = cls.childForFieldName('superclasses')?.text ?? '';
    const isFactorSubclass = /(?:^|\W)Factor(?:$|\W)/.test(superclasses);
    if (isFactorSubclass && !firstFactorSubclass) firstFactorSubclass = cls;
  }
  return firstFactorSubclass ?? classes[0];
}

export function findClassBlockNode(root: TSNode): TSNode | null {
  const cls = findNewFactorClassNode(root);
  return cls?.childForFieldName('body') ?? null;
}

export function findClassAssignmentNode(classBlock: TSNode, attr: string): TSNode | null {
  const extractAssignment = (node: TSNode): TSNode | null => {
    if (node.type === 'assignment') return node;
    if (node.type === 'expression_statement') {
      const direct = node.namedChildren.find((child) => child.type === 'assignment');
      if (direct) return direct;
      const nested = node.descendantsOfType('assignment');
      if (nested.length > 0) return nested[0];
    }
    return null;
  };

  for (const child of classBlock.namedChildren) {
    const assignment = extractAssignment(child);
    if (!assignment) continue;
    const left = assignment.childForFieldName('left');
    if (left?.text.trim() !== attr) continue;
    return assignment;
  }
  return null;
}

export function findCalcFunctionNode(root: TSNode): TSNode | null {
  const classBlock = findClassBlockNode(root);
  if (!classBlock) return null;
  for (const child of classBlock.namedChildren) {
    if (child.type !== 'function_definition' && child.type !== 'async_function_definition') continue;
    const fnName = child.childForFieldName('name')?.text.trim();
    if (fnName === 'calc') return child;
  }
  return null;
}

export type { TSNode };
