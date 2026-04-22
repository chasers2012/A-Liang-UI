'use client';

import type { Dispatch, SetStateAction } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { applyFormMetadataToSource, parseUserFactorMetadataFromSource, type FactorFormState } from '@/models/factor';
import { CodeJar } from '@/components/ui/code-jar';
import { FactorDependenciesCombobox } from './factor-dependencies-combobox';
import { FactorGroupCombobox } from './factor-group-combobox';

const SYNC_FROM_FORM_FIELDS: (keyof FactorFormState)[] = ['name', 'group', 'description', 'window', 'dependencies_csv'];

/** 与表单内 `set` 一致：改元数据时写回源码，改 `source` 时从源码解析元数据。 */
export function applyFactorFormPatch(f: FactorFormState, patch: Partial<FactorFormState>): FactorFormState {
  if (Object.prototype.hasOwnProperty.call(patch, 'source')) {
    const src = patch.source as string;
    const parsed = parseUserFactorMetadataFromSource(src);
    return { ...f, ...patch, ...parsed };
  }
  const next = { ...f, ...patch };
  const touchesMeta = SYNC_FROM_FORM_FIELDS.some((k) => k in patch);
  if (touchesMeta) {
    next.source = applyFormMetadataToSource(next.source, next);
  }
  return next;
}

type Props = {
  form: FactorFormState;
  setForm: Dispatch<SetStateAction<FactorFormState>>;
  formError: string | null;
  /** Prefix for input ids to avoid duplicates across routes. */
  idPrefix?: string;
  /** 编辑页在标题处改 name 时为 true */
  hideNameField?: boolean;
  /** 编辑页在副标题区改 description 时为 true */
  hideDescriptionField?: boolean;
};

export function FactorFormFields({
  form,
  setForm,
  formError,
  idPrefix = 'factor',
  hideNameField = false,
  hideDescriptionField = false,
}: Props) {
  const set = (patch: Partial<FactorFormState>) => {
    setForm((f) => applyFactorFormPatch(f, patch));
  };

  const pid = (s: string) => `${idPrefix}-${s}`;

  return (
    <div className="space-y-4">
      {formError && (
        <Alert variant="destructive">
          <AlertTitle>无法保存</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {!hideNameField ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={pid('name')}>标识 name</Label>
            <Input
              id={pid('name')}
              className="font-mono text-sm"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="my_factor"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              须为合法 Python 标识符；请与源码中 <span className="font-mono">NewFactor.name</span>{' '}
              保持一致（可与代码编辑器双向同步）。
            </p>
          </div>
        ) : null}
        <div className="min-w-0 space-y-2">
          <Label htmlFor={pid('group')}>分组 group</Label>
          <FactorGroupCombobox id={pid('group')} value={form.group} onValueChange={(group) => set({ group })} />
          <p className="text-xs text-muted-foreground">可选已有分组或输入新名称。</p>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={pid('mw')}>window</Label>
          <Input
            id={pid('mw')}
            type="number"
            min={1}
            className="font-mono"
            value={form.window}
            onChange={(e) => set({ window: e.target.value })}
          />
        </div>
      </div>
      {!hideDescriptionField ? (
        <div className="space-y-2">
          <Label htmlFor={pid('desc')}>描述</Label>
          <Textarea
            id={pid('desc')}
            rows={2}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={pid('deps')}>依赖列 dependencies</Label>
        <FactorDependenciesCombobox
          id={pid('deps')}
          valueCsv={form.dependencies_csv}
          onValueCsvChange={(csv) => set({ dependencies_csv: csv })}
        />
        <p className="text-xs text-muted-foreground">
          多选常用列；列表含当前 workspace 中因子已用过的列。新列名需符合标识符规则，输入后按 Enter 添加。
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={pid('source')}>Python 源码</Label>
        <CodeJar id={pid('source')} value={form.source} onChange={(source) => set({ source })} />
      </div>
    </div>
  );
}
