import { type ChatTurn } from "@/models/chat/session.atom";

export type ChatSegment =
  | { kind: "solo-assistant"; message: ChatTurn }
  | { kind: "turn"; user: ChatTurn; assistant: ChatTurn | undefined };

export function buildChatSegments(messages: ChatTurn[]): ChatSegment[] {
  const segments: ChatSegment[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (m.role === "user") {
      const next = messages[i + 1];
      if (next?.role === "assistant") {
        segments.push({ kind: "turn", user: m, assistant: next });
        i += 2;
        continue;
      }
      segments.push({ kind: "turn", user: m, assistant: undefined });
      i += 1;
      continue;
    }
    segments.push({ kind: "solo-assistant", message: m });
    i += 1;
  }
  return segments;
}
