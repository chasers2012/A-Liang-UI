/** 策略（工作流图）与节点类型目录 DTO。 */

import { WorkflowGraphPersisted } from '@/components/workflow-graph/reactflow/types';
import type { NodeTypeSocketPublic, WorkflowIOSpecPublic } from '../evaluation-profile/dto';

export interface StrategyPublic {
  id: string;
  name: string;
  description: string;
  workflow: WorkflowGraphPersisted;
  created_at: string;
  updated_at: string;
}

export interface StrategyNodeTypeCatalogItemPublic {
  type: string;
  label: string;
  description: string;
  category: string | null;
  inputs: NodeTypeSocketPublic[];
  outputs: NodeTypeSocketPublic[];
}

export type { NodeTypeSocketPublic, WorkflowIOSpecPublic };
