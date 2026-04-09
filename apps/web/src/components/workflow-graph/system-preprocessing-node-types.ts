export const DATA_SET_FRAMES_INPUT_NODE_TYPE =
  "factor.preprocessing_workflow_nodes.DataSetFramesInput";

export const COLLECT_FRAMES_NODE_TYPE =
  "factor.preprocessing_workflow_nodes.CollectFrames";

export const SYSTEM_PREPROCESSING_NODE_TYPES = new Set<string>([
  DATA_SET_FRAMES_INPUT_NODE_TYPE,
  COLLECT_FRAMES_NODE_TYPE,
]);
