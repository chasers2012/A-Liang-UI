import type { AgentLlmSettingsPublic } from "@/models";
import { apiFetchJson } from "./client";

export function getAgentLlmSettings(): Promise<AgentLlmSettingsPublic> {
  return apiFetchJson<AgentLlmSettingsPublic>("/agent/llm-settings");
}

export function putAgentLlmSettings(
  body: AgentLlmSettingsPublic,
): Promise<AgentLlmSettingsPublic> {
  return apiFetchJson<AgentLlmSettingsPublic>("/agent/llm-settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
