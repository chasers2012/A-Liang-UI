export type AgentLlmProvider = "ollama" | "openai";

/** 与 FastAPI ``AgentLlmSettings`` 一致。 */
export type AgentLlmSettingsPublic = {
  provider: AgentLlmProvider;
  model: string;
  ollama_base_url: string;
  openai_base_url: string | null;
  api_key: string | null;
};

export type AgentChatRolePublic = "user" | "assistant" | "system";

export type AgentChatMessagePublic = {
  role: AgentChatRolePublic;
  content: string;
};

export type AgentChatRequestPublic = {
  messages: AgentChatMessagePublic[];
};

export type AgentChatResponsePublic = {
  role: "assistant";
  content: string;
};
