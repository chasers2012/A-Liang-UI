import { atom, type SetStateAction } from "jotai";
import { atomFamily } from "jotai-family";
import { startTransition } from "react";
import { activeSessionIdAtom } from "./active-session";
import { sessionUserMessageIdsAtomFamily } from "./session-detail";
import { atomEffect } from "jotai-effect";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const segmentOpenAtomFamily = atomFamily((_id: string) => {
  const base = atom(false);
  return atom(
    (get) => get(base),
    (_get, set, update: SetStateAction<boolean>) => {
      startTransition(() => {
        requestAnimationFrame(() => {
          set(base, update);
        });
      });
    },
  );
});

export const toggleSegmentOpenAtomFamily = atomFamily((id: string) => {
  return atom(null, (_get, set) => {
    set(segmentOpenAtomFamily(id), (prev) => !prev);
  });
});

const stableDelayMs = 20;

const scrollAfterDomSettles = (target: HTMLElement) => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const container = document.getElementById("chat-messages-container");
  if (!container) return;
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "auto" });
      });
      observer.disconnect();
      debounceTimer = null;
    }, stableDelayMs);
  });

  observer.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "auto" });
    });
    observer.disconnect();
    debounceTimer = null;
  }, stableDelayMs);
};

export function openLatestSegmentAndScroll(
  userMessageIds: string[],
  setOpen: (id: string) => void,
): void {
  if (!userMessageIds?.length) return;

  const lastMessageIds = userMessageIds.slice(-1);
  startTransition(() => {
    for (const messageId of lastMessageIds) {
      setOpen(messageId);
    }

    const lastUserMessageId = userMessageIds[userMessageIds.length - 1];
    if (!lastUserMessageId) return;

    const targetId = `reply-${lastUserMessageId}-end`;
    const existing = document.getElementById(targetId);
    if (existing) {
      scrollAfterDomSettles(existing);
      return;
    }

    const appearObserver = new MutationObserver(() => {
      const el = document.getElementById(targetId);
      if (!el) return;
      appearObserver.disconnect();
      scrollAfterDomSettles(el);
    });

    const container = document.getElementById("chat-messages-container");
    if (!container) return;
    appearObserver.observe(container, {
      childList: true,
      subtree: true,
    });
  });
}

export const segementOpenEffect = atomEffect((get, set) => {
  const activeSession = get(activeSessionIdAtom);
  if (!activeSession) return;
  const userMessageIds = get(sessionUserMessageIdsAtomFamily(activeSession));
  setTimeout(() => {
    openLatestSegmentAndScroll(userMessageIds, (id) => {
      set(segmentOpenAtomFamily(id), true);
    });
  }, 0);
});
