import { useEffect, useMemo } from 'react';
import { useAtomValue } from 'jotai';

import { knowledgePageAtom } from './list-detail.atom';

export function useKnowledgeDocumentsPolling(refresh: () => void, intervalMs = 3000) {
  const { documents } = useAtomValue(knowledgePageAtom);
  const pendingCount = useMemo(() => documents.filter((doc) => doc.status !== 'indexed').length, [documents]);

  useEffect(() => {
    if (!pendingCount) return;

    const timer = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, pendingCount, refresh]);
}
