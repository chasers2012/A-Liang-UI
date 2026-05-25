'use client';

import { useAtomValue, useSetAtom } from 'jotai';

import { CollapsibleSidebarDrawerTrigger } from '@/components/collapsible-sidebar';
import { EmptyState } from '@/components/empty-state';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  knowledgePageAtom,
  searchKnowledgeAtom,
  setKnowledgeSearchQueryAtom,
} from '@/models/knowledge/list-detail.atom';

export function KnowledgeDetailPanel() {
  const { hits, loading, searchForm } = useAtomValue(knowledgePageAtom);
  const search = useSetAtom(searchKnowledgeAtom);
  const setSearchQuery = useSetAtom(setKnowledgeSearchQueryAtom);

  return (
    <PanelDetailCard titleActions={<CollapsibleSidebarDrawerTrigger label="打开文档列表" />} title="知识检索">
      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <Field className="min-w-0 flex-1 gap-2">
            <FieldLabel htmlFor="knowledge-search">检索词</FieldLabel>
            <Input
              id="knowledge-search"
              value={searchForm.query}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search();
              }}
            />
          </Field>
          <Button variant="outline" onClick={() => void search()} disabled={loading}>
            检索
          </Button>
        </div>

        {!hits.length ? (
          <EmptyState title="暂无命中结果" description="输入检索词后点击「检索」或按 Enter。" compact />
        ) : (
          <div className="space-y-2">
            {hits.map((hit, index) => (
              <Card key={`${hit.document_name || 'hit'}-${index}`}>
                <CardContent className="space-y-1 p-4">
                  <div className="text-sm font-medium">{hit.document_name || `命中结果 ${index + 1}`}</div>
                  <p className="text-sm text-muted-foreground">{hit.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PanelDetailCard>
  );
}
