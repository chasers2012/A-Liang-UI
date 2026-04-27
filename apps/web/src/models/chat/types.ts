/** 与后端 ``TextBlockPublic`` / assistant 消息中文本块一致。 */
export type TextBlockPublic = {
  kind: 'text';
  content: string;
  agent_name?: string;
  completed?: boolean;
};

/** 与后端 ``ChatToolCallPublic`` 一致（会话持久化 + SSE）。 */
export type ChatToolCallDisplay = {
  id: string;
  name: string;
  agent_name?: string;
  args?: unknown;
  status: 'running' | 'ok' | 'error';
  authorization_status?: 'none' | 'pending' | 'approved' | 'rejected';
  result?: unknown;
  error?: string;
};

/** 前端聊天 UI 消息块（与 ``AssistantBlockPublic`` 对齐）。 */
export type AssistantBlock =
  | TextBlockPublic
  | { kind: 'reasoning'; content: string; agent_name?: string }
  | { kind: 'tool'; agent_name?: string; call: ChatToolCallDisplay };
