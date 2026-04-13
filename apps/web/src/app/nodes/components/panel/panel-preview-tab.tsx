"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Check, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ParamItem, SocketItem } from "../node-preview-meta";
import { PreviewDescriptionSection } from "../preview-description-section";
import { WorkflowStepNodePreview } from "../preview/workflow-step-node-preview";
import { cn } from "@/lib/utils";
import type { NodeDetailPublic, WorkflowDomainNodeVisibilityPublic } from "@/models/nodes/dto";
import { isWireInputSpec } from "@/components/workflow-graph/workflow-node-input-spec";
import { SectionHeader } from "@/components/section-header";
import { PREVIEW_SCROLL_CLASS, mergePreviewParamModels } from "./shared";
import { listNodeVisibilityConfigs, putNodeVisibilityConfig } from "@/api/nodes";

const domainComboboxInputClassName =
  "min-w-[6rem] flex-1 border-0 bg-transparent py-0.5 pl-1 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";
const domainComboboxInputGroupClassName =
  "flex min-h-8 w-full flex-wrap items-center gap-0.5 rounded-lg border border-input bg-transparent px-1.5 py-1 outline-none transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30";
const domainChipClassName =
  "flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";
const domainComboboxItemClassName =
  "flex cursor-default items-start gap-2 px-2.5 py-1.5 text-sm outline-none select-none data-[highlighted]:relative data-[highlighted]:z-0 data-[highlighted]:text-accent-foreground data-[highlighted]:before:absolute data-[highlighted]:before:inset-x-1 data-[highlighted]:before:inset-y-0.5 data-[highlighted]:before:z-[-1] data-[highlighted]:before:rounded-md data-[highlighted]:before:bg-accent";

function NodeDomainsSection(props: { nodeId: string }) {
  const { nodeId } = props;
  const [domainConfigs, setDomainConfigs] = useState<WorkflowDomainNodeVisibilityPublic[]>(
    [],
  );
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
    () =>
      [...domainConfigs].sort((a, b) =>
        a.domain.localeCompare(b.domain, "zh-Hans-CN"),
      ),
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
    () => [...selectedDomainSet].sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
    [selectedDomainSet],
  );

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
      setDomainConfigs((prev) =>
        prev.map((item) => (item.domain === domain ? saved : item)),
      );
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
    return <p className="text-xs text-muted-foreground">加载中…</p>;
  }
  if (domainRows.length === 0) {
    return <p className="text-xs text-muted-foreground">暂无领域配置</p>;
  }
  return (
    <>
      <Combobox.Root
        items={domainRows.map((row) => row.domain)}
        multiple
        value={selectedDomains}
        onValueChange={(v) => void handleSelectedDomainsChange(v)}
        openOnInputClick
        disabled={Boolean(domainsSaving)}
      >
        <Combobox.InputGroup className={domainComboboxInputGroupClassName}>
          <Combobox.Chips className="flex w-full min-w-0 flex-wrap items-center gap-0.5">
            <Combobox.Value>
              {(value: string[]) => (
                <>
                  {value.map((domain) => (
                    <Combobox.Chip
                      key={domain}
                      className={domainChipClassName}
                      aria-label={`移除 ${domain}`}
                    >
                      {domain}
                      <Combobox.ChipRemove
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground"
                        aria-label="移除"
                      >
                        <X className="size-3" aria-hidden />
                      </Combobox.ChipRemove>
                    </Combobox.Chip>
                  ))}
                  <Combobox.Input
                    placeholder={value.length > 0 ? "添加更多…" : "选择可用领域"}
                    autoComplete="off"
                    className={domainComboboxInputClassName}
                  />
                </>
              )}
            </Combobox.Value>
          </Combobox.Chips>
        </Combobox.InputGroup>

        <Combobox.Portal>
          <Combobox.Positioner className="z-50 outline-none" sideOffset={4} align="start">
            <Combobox.Popup
              className={cn(
                "max-h-[min(16rem,var(--available-height))] min-w-(--anchor-width) w-max max-w-[min(28rem,var(--available-width))]",
                "origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md",
              )}
            >
              <Combobox.Empty className="px-2.5 py-2 text-sm text-muted-foreground">
                无匹配领域
              </Combobox.Empty>
              <Combobox.List className="outline-none">
                {(item: string) => (
                  <Combobox.Item
                    key={item}
                    value={item}
                    className={domainComboboxItemClassName}
                  >
                    <Combobox.ItemIndicator className="mt-0.5 flex shrink-0 justify-center">
                      <Check className="size-3.5" aria-hidden />
                    </Combobox.ItemIndicator>
                    <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">
                      {item}
                    </span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {domainsSaving ? (
        <p className="text-xs text-muted-foreground">保存中…</p>
      ) : null}
      {domainsError ? (
        <p className="text-xs text-destructive">{domainsError}</p>
      ) : null}
    </>
  );
}

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
          <SectionHeader>可用领域</SectionHeader>
          <NodeDomainsSection nodeId={detail.id} />
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

