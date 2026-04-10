export type AgentLlmProvider = "ollama" | "openai";

/** 与 FastAPI ``AgentLlmSettings`` 一致。 */
export type AgentLlmSettingsPublic = {
  provider: AgentLlmProvider;
  model: string;
  ollama_base_url: string;
  openai_base_url: string | null;
  api_key: string | null;
  temperature: number;
  ollama_timeout: number;
  ollama_num_predict: number;
  ollama_reasoning: boolean | null;
};

export type AgentChatRolePublic = "user" | "assistant" | "system";

/** 与后端 ``ChatToolCallPublic`` 一致（会话持久化 + SSE）。 */
export type AgentChatToolCallPublic = {
  id: string;
  name: string;
  args?: unknown;
  status: "running" | "ok" | "error";
  result?: unknown;
  error?: string;
};

export type TextBlockPublic = {
  kind: "text";
  content: string;
  completed?: boolean;
};
export type ToolBlockPublic = { kind: "tool"; call: AgentChatToolCallPublic };

/** 与后端 ``AssistantBlockPublic`` 一致。 */
export type AgentAssistantBlockPublic = TextBlockPublic | ToolBlockPublic;

/** 会话详情 / 持久化中的消息：始终带服务端 ``id``。 */
export type AgentChatMessagePublic = {
  id: string;
  role: AgentChatRolePublic;
  /** 消息内容（文本/工具调用）统一存储在 blocks 中。 */
  blocks: AgentAssistantBlockPublic[];
};

/** ``POST /chat/message`` 请求体中的单条 user 消息：``id`` 可省略（由服务端 SSE ``message_ids`` 分配）。 */
export type AgentChatRequestMessage = {
  id?: string | null;
  role: "user";
  blocks: AgentAssistantBlockPublic[];
};

export type AgentChatRequestPublic = {
  session_id: string;
  message: AgentChatRequestMessage;
};

export type AgentChatSummaryPublic = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

/** 与后端 ``ChatArchivedSummaryPublic`` 一致。 */
export type AgentChatArchivedSummaryPublic = AgentChatSummaryPublic & {
  archived_at: string;
};

export type AgentChatDetailPublic = {
  id: string;
  title: string;
  messages: AgentChatMessagePublic[];
  created_at: string;
  updated_at: string;
};

export type AgentChatCreateBody = {
  title: string;
};

export type AgentChatRenameBody = {
  title: string;
};
