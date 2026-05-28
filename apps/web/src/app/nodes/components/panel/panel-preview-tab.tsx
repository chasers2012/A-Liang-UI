'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { useAtomValue } from 'jotai';

import { EmptyState, PanelPlaceholder } from '@/components/empty-state';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ParamItem, SocketItem } from '../node-preview-meta';
import { PreviewDescriptionSection } from '../preview-description-section';
import { WorkflowStepNodePreview } from '../preview/workflow-step-node-preview';
import type { NodeDetailPublic, WorkflowDomainNodeVisibilityPublic } from '@/models/nodes/dto';
import { isWireInputSpec } from '@/components/workflow-graph/workflow-node-input-spec';
import { SectionHeader } from '@/components/section';
import { mergePreviewParamModels } from './shared';
import { listNodeVisibilityConfigs, putNodeVisibilityConfig } from '@/api/nodes';
import { nodesSelectedIdAtom } from '@/models/nodes/selection.atom';
import { nodesEditActiveAtom, nodesEditDescriptionAtom, nodesVisibleDetailAtom } from '@/models/nodes/edit.atom';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';

/** 右侧详情 panel 宽度低于此值时，改为纵向平铺（预览在上、单滚动区域） */
const PANEL_PREVIEW_NARROW_WIDTH_PX = 768;

const domainComboboxInputClassName = 'text-sm placeholder:text-muted-foreground';
const domainChipClassName = 'text-xs';
const domainComboboxItemClassName = 'items-start text-sm';

function NodeDomainsSection(props: { nodeId: string }) {
  const { nodeId } = props;
  const [domainConfigs, setDomainConfigs] = useState<WorkflowDomainNodeVisibilityPublic[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domainsSaving, setDomainsSaving] = useState<string | null>(null);
  const [domainsError, setDomainsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setDomainsLoading(true);
      setDomainsError(null);
      try {
        const rows = await listNodeVisibilityConfigs();
        if (!cancelled) setDomainConfigs(rows);
      } catch (e) {
        if (!cancelled) {
          setDomainsError(e instanceof Error ? e.message : String(e));
          setDomainConfigs([]);
        }
      } finally {
        if (!cancelled) setDomainsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const domainRows = useMemo(
    () => [...domainConfigs].sort((a, b) => a.domain.localeCompare(b.domain, 'zh-Hans-CN')),
    [domainConfigs],
  );
  const selectedDomainSet = useMemo(() => {
    const set = new Set<string>();
    for (const row of domainRows) {
      const hidden = row.hidden_node_ids.includes(nodeId);
      if (!hidden) set.add(row.domain);
    }
    return set;
  }, [domainRows, nodeId]);
  const selectedDomains = useMemo(
    () => [...selectedDomainSet].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
    [selectedDomainSet],
  );
  const domainAnchor = useComboboxAnchor();

  const toggleDomain = async (domain: string) => {
    if (domainsSaving) return;
    const row = domainRows.find((v) => v.domain === domain);
    if (!row) return;
    setDomainsSaving(domain);
    setDomainsError(null);
    try {
      const currentlyVisible = !row.hidden_node_ids.includes(nodeId);
      const set = new Set(row.hidden_node_ids);
      if (currentlyVisible) set.add(nodeId);
      else set.delete(nodeId);
      const nextHiddenIds = [...set];

      const saved = await putNodeVisibilityConfig(domain, nextHiddenIds);
      setDomainConfigs((prev) => prev.map((item) => (item.domain === domain ? saved : item)));
    } catch (e) {
      setDomainsError(e instanceof Error ? e.message : String(e));
    } finally {
      setDomainsSaving(null);
    }
  };

  const handleSelectedDomainsChange = async (next: string[] | null) => {
    if (domainsSaving) return;
    const target = new Set(next ?? []);
    const current = new Set(selectedDomains);
    const changedDomains = domainRows
      .map((row) => row.domain)
      .filter((domain) => target.has(domain) !== current.has(domain));
    for (const domain of changedDomains) {
      await toggleDomain(domain);
    }
  };

  if (domainsLoading) {
    return <EmptyState variant="loading" title="加载中" compact className="flex-none p-2" />;
  }
  if (domainRows.length === 0) {
    return <EmptyState title="暂无领域配置" compact className="flex-none p-2" />;
  }
  return (
    <>
      <Combobox
        items={domainRows.map((row) => row.domain)}
        multiple
        value={selectedDomains}
        onValueChange={(v) => void handleSelectedDomainsChange(v)}
        openOnInputClick
        disabled={Boolean(domainsSaving)}
      >
        <ComboboxChips ref={domainAnchor} className="w-full min-w-0">
          <ComboboxValue>
            {(value: string[]) => (
              <>
                {value.map((domain) => (
                  <ComboboxChip key={domain} className={domainChipClassName} aria-label={`移除 ${domain}`}>
                    {domain}
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={value.length > 0 ? '添加更多…' : '选择可用领域'}
                  autoComplete="off"
                  className={domainComboboxInputClassName}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>

        <ComboboxContent
          anchor={domainAnchor}
          sideOffset={4}
          align="start"
          className="w-max max-w-[min(28rem,var(--available-width))]"
        >
          <ComboboxEmpty className="px-2.5 py-2 text-sm text-muted-foreground">无匹配领域</ComboboxEmpty>
          <ComboboxList className="outline-none">
            {(item: string) => (
              <ComboboxItem key={item} value={item} className={domainComboboxItemClassName}>
                <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">{item}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {domainsSaving ? <p className="text-xs text-muted-foreground">保存中…</p> : null}
      {domainsError ? <p className="text-xs text-destructive">{domainsError}</p> : null}
    </>
  );
}

type PanelPreviewMetadataSectionsProps = {
  detail: NodeDetailPublic;
  editable: boolean;
  description: string | null | undefined;
  onDescriptionChange: (value: string) => void;
};

function PanelPreviewMetadataSections(props: PanelPreviewMetadataSectionsProps) {
  const { detail, editable, description, onDescriptionChange } = props;
  const wireInputs = detail.inputs.filter(isWireInputSpec);
  const mergedParamModels = mergePreviewParamModels(detail);

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader>可用领域</SectionHeader>
      <NodeDomainsSection nodeId={detail.id} />
      <SectionHeader>节点简介</SectionHeader>
      <PreviewDescriptionSection
        readonly={!editable}
        description={description}
        onDescriptionChange={onDescriptionChange}
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
  );
}

type PanelPreviewNodeCanvasProps = {
  detail: NodeDetailPublic;
  label: string;
  description: string | null | undefined;
  className?: string;
};

function PanelPreviewNodeCanvas(props: PanelPreviewNodeCanvasProps) {
  const { detail, label, description, className } = props;
  return (
    <WorkflowStepNodePreview
      label={label}
      description={description}
      inputs={detail.inputs}
      outputs={detail.outputs}
      params={{}}
      selected
      className={className}
    />
  );
}

export function PanelPreviewTab() {
  const [selectedId] = useAtom(nodesSelectedIdAtom);
  const detail = useAtomValue(nodesVisibleDetailAtom);
  const editable = useAtomValue(nodesEditActiveAtom);
  const [, setEditDescription] = useAtom(nodesEditDescriptionAtom);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setIsNarrow(el.clientWidth < PANEL_PREVIEW_NARROW_WIDTH_PX);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [detail]);

  if (!detail) {
    return (
      <PanelPlaceholder
        loading={Boolean(selectedId)}
        title="请选择节点"
        description={selectedId ? undefined : '请从左侧选择一个节点。'}
      />
    );
  }
  const label = detail.name;
  const description = detail.description;
  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
      {isNarrow ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-2 pt-2">
          <div className="flex flex-col gap-6 pr-1">
            <PanelPreviewNodeCanvas
              detail={detail}
              label={label}
              description={description}
              className="min-h-[min(400px,55vh)] w-full shrink-0"
            />
            <PanelPreviewMetadataSections
              detail={detail}
              editable={editable}
              description={description}
              onDescriptionChange={(v) => setEditDescription(v)}
            />
          </div>
        </div>
      ) : (
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 pb-2 pt-2">
          <ResizablePanel defaultSize="50%" minSize="25%" className="min-h-0 min-w-0">
            <div className="flex h-full min-h-0 flex-col overflow-y-auto pr-2">
              <PanelPreviewMetadataSections
                detail={detail}
                editable={editable}
                description={description}
                onDescriptionChange={(v) => setEditDescription(v)}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle className="mx-1" />
          <ResizablePanel defaultSize="50%" minSize="25%" className="min-h-0 min-w-0">
            <div className="flex h-full min-h-0 flex-col">
              <PanelPreviewNodeCanvas
                detail={detail}
                label={label}
                description={description}
                className="h-full min-h-[200px] flex-1"
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}
