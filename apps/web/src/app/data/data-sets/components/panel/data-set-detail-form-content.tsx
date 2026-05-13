'use client';

import { useMemo, type ReactNode } from 'react';
import { useSetAtom } from 'jotai';
import { Minus, Plus } from 'lucide-react';

import { EditablePageDescription } from '@/components/editable-page-description';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DataSourcePublic } from '@/models/datasource/dto';
import type { DataSetBindingFormRow, DataSetFormState } from '@/models/data-set/form-logic';
import {
  addDataSetEditorBindingAtom,
  removeDataSetEditorBindingAtom,
  setDataSetEditorFormPatchAtom,
  updateDataSetEditorBindingAtom,
} from '@/models/data-set/editor/form-state.atom';
import { Section } from '@/components/section';

export function DataSetDetailFormContent(props: {
  form: DataSetFormState;
  bindingDatasources: DataSourcePublic[];
  dependencyFieldsByDsId: Record<string, string[]>;
  formError?: string | null;
  readOnly?: boolean;
}) {
  const { form, bindingDatasources, dependencyFieldsByDsId, formError = null, readOnly = false } = props;

  const patchForm = useSetAtom(setDataSetEditorFormPatchAtom);
  const addBinding = useSetAtom(addDataSetEditorBindingAtom);
  const updateBinding = useSetAtom(updateDataSetEditorBindingAtom);
  const removeBinding = useSetAtom(removeDataSetEditorBindingAtom);

  return (
    <>
      {!readOnly && formError ? (
        <Alert variant="destructive">
          <AlertTitle>提交失败</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <Section title="简介" className="mb-8 space-y-3">
        <EditablePageDescription
          value={form.description}
          onChange={(d) => (readOnly ? undefined : patchForm({ description: d }))}
          textareaAriaLabel="数据集说明"
          showEdit={!readOnly}
        />
      </Section>

      <Section title="参数">
        <FieldGroup className="gap-3">
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="ts-start">开始日期</FieldLabel>
              <DatePicker
                id="ts-start"
                value={form.start}
                onChange={(v) => (readOnly ? undefined : patchForm({ start: v }))}
                placeholder="选择开始日期"
                required
                disabled={readOnly}
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="ts-end">结束日期</FieldLabel>
              <DatePicker
                id="ts-end"
                value={form.end}
                onChange={(v) => (readOnly ? undefined : patchForm({ end: v }))}
                placeholder="选择结束日期"
                required
                disabled={readOnly}
              />
            </Field>
          </FieldGroup>

          <Field className="gap-2">
            <FieldLabel htmlFor="ts-instruments">标的代码（可选）</FieldLabel>
            <Textarea
              id="ts-instruments"
              value={form.instrument_codes_text}
              onChange={(e) => (readOnly ? undefined : patchForm({ instrument_codes_text: e.target.value }))}
              placeholder="每行一个或逗号分隔；留空表示不限制标的范围"
              rows={4}
              disabled={readOnly}
              className="min-h-0 resize-y font-mono text-xs"
            />
          </Field>
        </FieldGroup>
      </Section>

      <Section title="数据源绑定">
        {!readOnly && bindingDatasources.length === 0 ? (
          <Alert variant="destructive">
            <AlertTitle>无可用数据源</AlertTitle>
            <AlertDescription>请先在「数据源」中新建至少一个数据源。</AlertDescription>
          </Alert>
        ) : null}
        {form.bindings.map((row, index) => (
          <DataSetBindingRowBlock
            key={index}
            index={index}
            row={row}
            bindingsLength={form.bindings.length}
            dependencyFieldsByDsId={dependencyFieldsByDsId}
            labelLookupDatasources={bindingDatasources}
            bindingDatasources={(() => {
              const currentId = row.datasource_id.trim();
              const takenIds = new Set(
                form.bindings.map((b, i) => (i === index ? '' : b.datasource_id.trim())).filter(Boolean),
              );
              return bindingDatasources.filter((d) => d.id === currentId || !takenIds.has(d.id));
            })()}
            updateBinding={(i, patch) => updateBinding({ index: i, patch })}
            removeBinding={(i) => removeBinding(i)}
            readOnly={readOnly}
          />
        ))}
        {!readOnly ? (
          <Button type="button" variant="outline" size="sm" onClick={() => addBinding()}>
            <Plus className="size-4" />
            添加数据源
          </Button>
        ) : null}
      </Section>
    </>
  );
}

function bindingDatasourceTriggerLabel(
  row: DataSetBindingFormRow,
  bindingDatasources: DataSourcePublic[],
): string | null {
  const id = row.datasource_id.trim();
  if (!id) return null;
  const d = bindingDatasources.find((x) => x.id === id);
  if (d) return `${d.name} (${d.type})`;
  const n = row.datasource_name?.trim();
  const t = row.datasource_type?.trim();
  if (n && t) return `${n} (${t})`;
  if (n) return n;
  return id;
}

type DataSetBindingRowBlockProps = {
  index: number;
  row: DataSetBindingFormRow;
  bindingsLength: number;
  dependencyFieldsByDsId: Record<string, string[]>;
  /** 完整目录，用于触发器上解析 id → 名称 */
  labelLookupDatasources: DataSourcePublic[];
  bindingDatasources: DataSourcePublic[];
  updateBinding: (i: number, patch: Partial<DataSetBindingFormRow>) => void;
  removeBinding: (i: number) => void;
  readOnly?: boolean;
};

function DataSetBindingRowBlock({
  index,
  row,
  bindingsLength,
  dependencyFieldsByDsId,
  labelLookupDatasources,
  bindingDatasources,
  updateBinding,
  removeBinding,
  readOnly = false,
}: DataSetBindingRowBlockProps) {
  const trimmedId = row.datasource_id.trim();
  const physicalColumns = dependencyFieldsByDsId[trimmedId] ?? [];
  const columnOptions = (() => {
    const set = new Set<string>();
    for (const c of physicalColumns) {
      const t = String(c).trim();
      if (t) set.add(t);
    }
    return [...set].sort((x, y) => x.localeCompare(y));
  })();
  const columnsAnchor = useComboboxAnchor();

  const dsTriggerId = `ds-binding-${index}-trigger`;

  const selectItems = useMemo((): Record<string, ReactNode> => {
    const items: Record<string, ReactNode> = {};
    for (const d of bindingDatasources) {
      items[d.id] = `${d.name} (${d.type})`;
    }
    const cur = row.datasource_id.trim();
    if (cur && !(cur in items)) {
      const label = bindingDatasourceTriggerLabel(row, labelLookupDatasources) ?? cur;
      items[cur] = (
        <span className="flex min-w-0 max-w-full items-center gap-2">
          <span className="min-w-0 truncate">{label}</span>
          <span className="shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
            已删除
          </span>
        </span>
      );
    }
    return items;
  }, [bindingDatasources, labelLookupDatasources, row]);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">绑定 {index + 1}</span>
        {!readOnly && bindingsLength > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-destructive"
            onClick={() => removeBinding(index)}
          >
            <Minus className="size-4" />
            移除
          </Button>
        ) : null}
      </div>
      <FieldGroup className="gap-3">
        <Field className="gap-2">
          <FieldLabel htmlFor={dsTriggerId}>数据源</FieldLabel>
          <Select
            modal={false}
            items={selectItems}
            value={row.datasource_id}
            onValueChange={(v) => {
              if (!v) return;
              const picked = labelLookupDatasources.find((d) => d.id === v);
              updateBinding(index, {
                datasource_id: v,
                columns: [],
                datasource_name: picked?.name,
                datasource_type: picked?.type,
              });
            }}
            disabled={readOnly || bindingDatasources.length === 0}
          >
            <SelectTrigger id={dsTriggerId} className="w-full min-w-0">
              <SelectValue placeholder="选择数据源" />
            </SelectTrigger>
            <SelectContent>
              {bindingDatasources.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} ({d.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field className="gap-2">
          <FieldLabel>
            筛选数据列<span className="text-xs text-muted-foreground">留空启用全部</span>
          </FieldLabel>
          {readOnly ? (
            <div className="flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent bg-clip-padding px-2.5 py-1 text-sm">
              {row.columns.length ? (
                row.columns.map((c) => (
                  <span
                    key={c}
                    className="flex h-5.25 w-fit items-center justify-center rounded-sm bg-muted px-1.5 font-mono text-xs font-medium whitespace-nowrap text-foreground opacity-70"
                  >
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">（未选择：启用全部）</span>
              )}
            </div>
          ) : (
            <Combobox
              items={columnOptions}
              multiple
              value={row.columns}
              onValueChange={(v) => updateBinding(index, { columns: v ?? [] })}
              openOnInputClick
            >
              <ComboboxChips ref={columnsAnchor} className="w-full min-w-0">
                <ComboboxValue>
                  {(value: string[]) => (
                    <>
                      {value.map((c) => (
                        <ComboboxChip key={c} className="font-mono text-xs" aria-label={`移除 ${c}`}>
                          {c}
                        </ComboboxChip>
                      ))}
                    </>
                  )}
                </ComboboxValue>
              </ComboboxChips>
              <ComboboxContent
                anchor={columnsAnchor}
                sideOffset={4}
                align="start"
                className="w-max max-w-[min(28rem,var(--available-width))]"
              >
                <ComboboxEmpty className="px-2.5 py-2 text-sm text-muted-foreground">无匹配列</ComboboxEmpty>
                <ComboboxList className="outline-none">
                  {(item: string) => (
                    <ComboboxItem key={item} value={item} className="items-start text-sm">
                      <span className="min-w-0 flex-1 whitespace-normal wrap-break-word font-mono text-xs">{item}</span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          )}
        </Field>
      </FieldGroup>
    </div>
  );
}
