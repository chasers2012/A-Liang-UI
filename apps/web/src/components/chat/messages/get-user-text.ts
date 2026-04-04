import type { AssistantBlock } from "@/models/chat/types";

export function getUserMessageText(blocks: AssistantBlock[] | undefined): string {
  if (!blocks?.length) return "";
  return blocks
    .filter((b): b is { kind: "text"; content: string } => b.kind === "text")
    .map((b) => b.content)
    .join("");
}
