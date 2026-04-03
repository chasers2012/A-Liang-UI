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

export type AgentChatMessagePublic = {
  role: AgentChatRolePublic;
  content: string;
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
