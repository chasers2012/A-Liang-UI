import type { AssistantBlock, ChatToolCallDisplay } from '../chat/types';

export type { TextBlockPublic } from '../chat/types';

export type LlmProvider = 'ollama' | 'openai';

/** 与 FastAPI ``AgentLlmSettings`` 一致。 */
export type LlmSettingsPublic = {
  provider: LlmProvider;
  model: string;
  ollama_base_url: string;
  openai_base_url: string | null;
  api_key: string | null;
  temperature: number;
  ollama_timeout: number;
  ollama_num_predict: number;
  ollama_reasoning: boolean | null;
};

export type ChatRolePublic = 'user' | 'assistant' | 'system';

/** 与后端 ``ChatToolCallPublic`` 一致（同 {@link ChatToolCallDisplay}）。 */
export type ChatToolCallPublic = ChatToolCallDisplay;

export type ToolBlockPublic = { kind: 'tool'; call: ChatToolCallPublic };

/** 与后端 ``AssistantBlockPublic`` 一致（同 {@link AssistantBlock}）。 */
export type AssistantBlockPublic = AssistantBlock;

/** 会话详情 / 持久化中的消息：始终带服务端 ``id``。 */
export type ChatMessagePublic = {
  id: string;
  role: ChatRolePublic;
  /** 消息内容（文本/工具调用）统一存储在 blocks 中。 */
  blocks: AssistantBlockPublic[];
};

/** ``POST /chat/message`` 请求体中的单条 user 消息：``id`` 可省略（由服务端 SSE ``message_ids`` 分配）。 */
export type ChatRequestMessage = {
  id?: string | null;
  role: 'user';
  blocks: AssistantBlockPublic[];
};

export type ChatRequestPublic = {
  session_id: string;
  message: ChatRequestMessage;
};

export type ChatSummaryPublic = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

/** 与后端 ``ChatArchivedSummaryPublic`` 一致。 */
export type ChatArchivedSummaryPublic = ChatSummaryPublic & {
  archived_at: string;
};

export type ChatDetailPublic = {
  id: string;
  title: string;
  messages: ChatMessagePublic[];
  created_at: string;
  updated_at: string;
};

export type ChatCreateBody = {
  title: string;
};

export type ChatRenameBody = {
  title: string;
};
