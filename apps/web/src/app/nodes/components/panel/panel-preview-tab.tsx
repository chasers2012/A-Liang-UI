"use client";

import { ParamItem, SectionHeader, SocketItem } from "../node-preview-meta";
import { PreviewDescriptionSection } from "../preview-description-section";
import { WorkflowStepNodePreview } from "../preview/workflow-step-node-preview";
import { cn } from "@/lib/utils";
import type { NodeDetailPublic } from "@/models/nodes/dto";
import { isWireInputSpec } from "@/components/workflow-graph/workflow-node-input-spec";
import { PREVIEW_SCROLL_CLASS, mergePreviewParamModels } from "./shared";

export function PanelPreviewTab(props: {
  detail: NodeDetailPublic | null;
  placeholder: string;
  editable?: boolean;
  editName?: string;
  editDescription?: string;
  onEditDescriptionChange?: (description: string) => void;
}) {
  const {
    detail,
    placeholder,
    editable = false,
    editName = "",
    editDescription = "",
    onEditDescriptionChange,
  } = props;
  if (!detail) {
    return (
      <div className={cn(PREVIEW_SCROLL_CLASS, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
        <p className="py-8 text-sm text-muted-foreground">{placeholder}</p>
      </div>
    );
  }
  const label = editable && editName.trim() ? editName : detail.name;
  const description = editable ? detail.description : editDescription;
  const wireInputs = detail.inputs.filter(isWireInputSpec);
  const mergedParamModels = mergePreviewParamModels(detail);

  return (
    <div className={cn(PREVIEW_SCROLL_CLASS, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
      <div className="flex min-h-0 flex-1 flex-col gap-6 pb-2 pt-2 lg:flex-row lg:items-stretch lg:gap-8">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <SectionHeader>节点简介</SectionHeader>
          <PreviewDescriptionSection
            readonly={!editable}
            description={description}
            onDescriptionChange={onEditDescriptionChange}
          />
          <SectionHeader>输入接口</SectionHeader>
          {wireInputs.length === 0 ? (
            <p className="text-xs text-muted-foreground">无</p>
          ) : (
            <ul className="flex list-none flex-col gap-2.5 p-0 text-sm">
              {wireInputs.map((s) => (
                <SocketItem key={s.name} socket={s} />
              ))}
            </ul>
          )}
          <SectionHeader>输出接口</SectionHeader>
          {detail.outputs.length === 0 ? (
            <p className="text-xs text-muted-foreground">无</p>
          ) : (
            <ul className="flex list-none flex-col gap-2.5 p-0 text-sm">
              {detail.outputs.map((s) => (
                <SocketItem key={s.name} socket={s} />
              ))}
            </ul>
          )}
          <SectionHeader>节点参数</SectionHeader>
          {mergedParamModels.length === 0 ? (
            <p className="text-xs text-muted-foreground">无</p>
          ) : (
            <ul className="flex list-none flex-col gap-2.5 p-0 text-sm">
              {mergedParamModels.map((p) => (
                <ParamItem key={p.key} item={p} />
              ))}
            </ul>
          )}
        </div>
        <div className="flex w-[500px] max-w-[500px] flex-col">
          <WorkflowStepNodePreview
            label={label}
            description={description}
            inputs={detail.inputs}
            outputs={detail.outputs}
            params={{}}
            selected
            className="h-full min-h-[280px] flex-1 max-lg:min-h-[min(400px,55vh)]"
          />
        </div>
      </div>
    </div>
  );
}

