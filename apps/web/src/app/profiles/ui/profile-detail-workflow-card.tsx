'use client';

import { cn } from '@/lib/utils';
import type { EvaluationProfilePublic } from '@/models/evaluation-profile/dto';

import { WorkflowGraphCanvas, toWorkflowNodeTypes } from '@/components/workflow-graph';

export function ProfileDetailWorkflowCard(props: {
  profile: EvaluationProfilePublic;
  profileId: string;
  nodeTypes: ReturnType<typeof toWorkflowNodeTypes>;
  className?: string;
}) {
  const { profile, profileId, nodeTypes, className } = props;

  return (
    <section className={cn('flex min-h-0 flex-1 flex-col gap-2', className)} aria-labelledby="profile-workflow-heading">
      <div className="flex min-h-0 flex-1 flex-col">
        <WorkflowGraphCanvas
          key={profileId}
          nodeTypes={nodeTypes}
          initialGraph={profile.workflow}
          readOnly
          className="h-full flex-1"
        />
      </div>
    </section>
  );
}
