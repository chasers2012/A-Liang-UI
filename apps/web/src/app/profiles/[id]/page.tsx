'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAtomValue, useSetAtom } from 'jotai';
import { Pencil } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';

import { useEffectMicrotask } from '@/hooks/use-effect-microtask';
import { cn } from '@/lib/utils';
import {
  evaluationProfileDetailAtomFamily,
  loadEvaluationProfileDetailAtomFamily,
} from '@/models/evaluation-profile/list-detail.atom';

import { Page } from '@/components/page';
import { ProfileDetailWorkflowCard } from '../ui/profile-detail-workflow-card';

export default function EvaluationProfileDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = params.id;
  const id = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
  const { row, error } = useAtomValue(evaluationProfileDetailAtomFamily(id));
  const load = useSetAtom(loadEvaluationProfileDetailAtomFamily(id));

  useEffectMicrotask(() => {
    void load();
  }, [id, load]);

  if (!id) {
    return (
      <Page>
        <Alert variant="destructive">
          <AlertTitle>无效 id</AlertTitle>
        </Alert>
      </Page>
    );
  }

  if (error || !row) {
    return (
      <Page>
        <Alert variant={error ? 'destructive' : 'default'}>
          <AlertTitle>{error ? '加载失败' : '加载中…'}</AlertTitle>
          {error ? <AlertDescription>{error}</AlertDescription> : null}
        </Alert>
      </Page>
    );
  }

  return (
    <Page
      title={row.name}
      description={row.description || '无描述'}
      className="max-w-full"
      gap="sm"
      action={
        <Link
          href={`/profiles/${encodeURIComponent(id)}/edit`}
          className={cn(buttonVariants({ variant: 'default' }), 'gap-1.5')}
        >
          <Pencil className="size-4" />
          编辑
        </Link>
      }
    >
      <ProfileDetailWorkflowCard profile={row} profileId={id} />
    </Page>
  );
}
