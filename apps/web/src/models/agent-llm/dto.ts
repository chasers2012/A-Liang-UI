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

export type AgentChatMessagePublic = {
  role: AgentChatRolePublic;
  content: string;
  /** 助手消息可选：与正文交错存储的工具调用（含刷新后会话恢复）。 */
  blocks?: AgentAssistantBlockPublic[];
};

export type AgentChatRequestPublic = {
  messages: AgentChatMessagePublic[];
  session_id?: string | null;
};

export type AgentChatSessionSummaryPublic = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
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
