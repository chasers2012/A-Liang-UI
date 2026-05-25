'use client';

import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';

import { Page } from '@/components/page';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { knowledgePageAtom, refreshKnowledgePageAtom } from '@/models/knowledge/list-detail.atom';
import { useKnowledgeEvents } from '@/models/knowledge/use-knowledge-events';

import { KnowledgeDetailPanel } from './components/knowledge-detail-panel';
import { KnowledgeListPane } from './components/knowledge-list-pane';

export default function KnowledgePage() {
  const { error } = useAtomValue(knowledgePageAtom);
  const refresh = useSetAtom(refreshKnowledgePageAtom);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useKnowledgeEvents(refresh);

  return (
    <Page size="full" gap="sm" className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      {error ? (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-row gap-4 overflow-hidden">
        <KnowledgeListPane />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <KnowledgeDetailPanel />
        </div>
      </div>
    </Page>
  );
}
