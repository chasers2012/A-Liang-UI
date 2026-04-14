'use client';

import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { type EvaluationProfilePublic, listNodes } from '@/api';

import { WorkflowGraphCanvas, toWorkflowNodeTypes } from '@/components/workflow-graph';
import { NodeSummaryPublic } from '@/models/nodes/dto';

export function ProfileDetailWorkflowCard(props: {
  profile: EvaluationProfilePublic;
  profileId: string;
  className?: string;
}) {
  const { profile, profileId, className } = props;
  const [catalog, setCatalog] = useState<NodeSummaryPublic[]>([]);
  const nodeTypes = useMemo(() => toWorkflowNodeTypes(catalog), [catalog]);

  useEffect(() => {
    listNodes('evaluation-profile')
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  return (
    <section className={cn('flex min-h-0 flex-1 flex-col gap-2', className)} aria-labelledby="profile-workflow-heading">
      <h2 id="profile-workflow-heading" className="shrink-0 text-sm font-semibold leading-none tracking-tight">
        工作流
      </h2>
      <div className="flex min-h-0 flex-1 flex-col">
        {catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">加载画布…</p>
        ) : (
          <WorkflowGraphCanvas
            key={profileId}
            nodeTypes={nodeTypes}
            initialGraph={profile.workflow}
            readOnly
            className="h-full flex-1"
          />
        )}
      </div>
    </section>
  );
}
