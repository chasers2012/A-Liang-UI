import type { TSNode } from '@/lib/python-parser';

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
