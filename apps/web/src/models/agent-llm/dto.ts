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

/** 与后端 ``AssistantBlockPublic`` 一致。 */
export type AgentAssistantBlockPublic =
  | { kind: "text"; content: string }
  | { kind: "tool"; call: AgentChatToolCallPublic };

/** 会话详情 / 持久化中的消息：始终带服务端 ``id``。 */
export type AgentChatMessagePublic = {
  id: string;
  role: AgentChatRolePublic;
  /** 消息内容（文本/工具调用）统一存储在 blocks 中。 */
  blocks: AgentAssistantBlockPublic[];
};

/** ``POST /agent/chat/stream`` 请求体中的单条消息：``id`` 可省略（由服务端 SSE ``message_ids`` 分配）。 */
export type AgentChatRequestMessage = {
  id?: string | null;
  role: AgentChatRolePublic;
  blocks: AgentAssistantBlockPublic[];
};

export type AgentChatRequestPublic = {
  messages: AgentChatRequestMessage[];
  session_id?: string | null;
};

export type AgentChatSessionSummaryPublic = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

/** 与后端 ``ChatSessionArchivedSummaryPublic`` 一致。 */
export type AgentChatSessionArchivedSummaryPublic =
  AgentChatSessionSummaryPublic & {
    archived_at: string;
  };

export type AgentChatSessionDetailPublic = {
  id: string;
  title: string;
  messages: AgentChatMessagePublic[];
  created_at: string;
  updated_at: string;
};

export type AgentChatSessionCreateBody = {
  title: string;
};

export type AgentChatSessionRenameBody = {
  title: string;
};
