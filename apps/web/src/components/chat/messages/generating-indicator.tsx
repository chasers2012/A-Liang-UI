import { chatIsSendingAtom } from "@/models/chat/session";
import { useAtomValue } from "jotai";
import { Loader2 } from "lucide-react";
import { Activity, memo } from "react";

export const GeneratingIndicator = memo(function GeneratingIndicator() {
  const isSending = useAtomValue(chatIsSendingAtom);
  return (
    <Activity mode={isSending ? "visible" : "hidden"}>
      <div
        id="chat-generating-indicator"
        className="flex items-center gap-2 text-muted-foreground"
      >
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        正在生成…
      </div>
    </Activity>
  );
});