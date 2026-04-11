import {
  AgentChatMessagePublic,
  AgentChatDetailPublic,
  TextBlockPublic,
  getAgentChat,
} from "@/api";
import { atom } from "jotai";
import { atomFamily } from "jotai-family";

/**
 * message id → message(AgentChatMessagePublic)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const messagesAtomFamily = atomFamily((_mid: string) =>
  atom<AgentChatMessagePublic | undefined>(undefined),
);

/**
 * session id → user message ids
 */
export const sessionUserMessageIdsAtomFamily = atomFamily(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_sessionId: string | undefined | null) => atom<string[]>([]),
);

/**
 * user message id → assistant message ids
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const userMessageReplieIdsAtomFamily = atomFamily((_umid: string) =>
  atom<string[]>([]),
);

export const replieIdOfMessageAtomFamily = atomFamily((id: string) =>
  atom((get) => get(userMessageReplieIdsAtomFamily(id))[0]),
);

export const replyOfMessageAtomFamily = atomFamily((id: string) =>
  atom<AgentChatMessagePublic | undefined>((get) => {
    const rid = get(replieIdOfMessageAtomFamily(id));
    if (!rid) return undefined;
    return get(messagesAtomFamily(rid));
  }),
);

export const userMessageTextAtomFamily = atomFamily((id: string) =>
  atom((get) =>
    (
      (get(messagesAtomFamily(id))?.blocks?.filter((b) => b.kind === "text") ||
        []) as TextBlockPublic[]
    )
      .map((b) => b.content)
      .join(""),
  ),
);

export const sessionDetailAtomFamily = atomFamily(
  (sessionId: string | undefined | null) => {
    const base = atom<AgentChatDetailPublic | null>(null);
    return atom(
      (get) => {
        return get(base);
      },
      async (_get, set) => {
        if (!sessionId) return;
        const detail = await getAgentChat(sessionId);
        set(base, detail);
        set(
          sessionUserMessageIdsAtomFamily(sessionId),
          detail.messages.filter((m) => m.role === "user").map((m) => m.id),
        );
        const repliesDict: Record<string, string[]> = {};
        detail.messages.forEach((m, idx) => {
          if (m.role === "user") {
            if (!repliesDict[m.id]) {
              repliesDict[m.id] = [];
            }
          } else {
            const userMessage = detail.messages
              .slice(0, idx)
              .findLast((m) => m.role === "user");
            if (userMessage) {
              repliesDict[userMessage.id].push(m.id);
            }
          }
        });
        Object.entries(repliesDict).forEach(([userId, replyIds]) => {
          set(userMessageReplieIdsAtomFamily(userId), replyIds);
        });
        detail.messages.forEach((m) => {
          set(messagesAtomFamily(m.id), m);
        });
      },
    );
  },
);

export const removeSessionMessageAtom = atom(
  null,
  (get, set, sessionId: string | undefined | null) => {
    if (!sessionId) return;
    const userIds = get(sessionUserMessageIdsAtomFamily(sessionId));
    if (!userIds?.length) return;

    const removeIds = new Set<string>([
      ...userIds,
      ...userIds.flatMap(
        (uid) => get(userMessageReplieIdsAtomFamily(uid)) ?? [],
      ),
    ]);

    for (const id of removeIds) {
      messagesAtomFamily.remove(id);
    }
    for (const uid of userIds) {
      userMessageReplieIdsAtomFamily.remove(uid);
    }
    sessionUserMessageIdsAtomFamily.remove(sessionId);
  },
);
