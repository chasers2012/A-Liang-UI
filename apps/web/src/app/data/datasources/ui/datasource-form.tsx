'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Page } from '@/components/page';
import { PageFormHeaderActions } from '@/components/page-form-header-actions';

import { EditablePageTitle } from '@/components/editable-page-title';
import type { DatasourcePluginPublic } from '@/models/datasource/dto';
import type { EditorMode, FormState } from '../form-model';
import { DatasourceFormPluginConfig } from './datasource-form-plugin-config';

export const DATASOURCE_MAIN_FORM_ID = 'datasource-main-form';

type Props = {
  editorMode: EditorMode;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  plugins: DatasourcePluginPublic[];
  formError: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  cancelHref: string;
};

export function DatasourceForm({
  editorMode,
  form,
  setForm,
  plugins,
  formError,
  submitting,
  onSubmit,
  cancelHref,
}: Props) {
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const typeItems = useMemo(
    () => Object.fromEntries(plugins.map((p) => [p.type, p.title?.trim() || p.type])),
    [plugins],
  );
  const selectedPlugin = plugins.find((p) => p.type === form.type) ?? null;
  const [pluginConfigValid, setPluginConfigValid] = useState(false);

  const mainFormValid = !!form.name.trim() && (editorMode !== 'create' || !!form.type.trim());
  const pluginFormValid = !!selectedPlugin && pluginConfigValid;

  return (
    <Page
      gap="none"
      title={
        <EditablePageTitle
          value={form.name}
          onChange={(n) => set({ name: n })}
          inputAriaLabel="数据源显示名称"
          editButtonAriaLabel="编辑名称"
        />
      }
      description={
        editorMode === 'create' ? '连接信息保存在服务端 workspace；接口不会返回密码明文。' : '密码留空表示保留原值。'
      }
      headerClassName="mb-8"
      action={
        <PageFormHeaderActions
          formId={DATASOURCE_MAIN_FORM_ID}
          submitting={submitting}
          submitDisabled={!mainFormValid || !pluginFormValid}
          cancelHref={cancelHref}
        />
      }
    >
      <form id={DATASOURCE_MAIN_FORM_ID} className="flex flex-col gap-6" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-4">
          {editorMode === 'create' && (
            <div className="grid gap-2">
              <Label htmlFor="ds-type">类型</Label>
              <Select
                modal={false}
                items={typeItems}
                value={form.type}
                onValueChange={(v) => {
                  if (v == null || v === '') return;
                  set({ type: v, config: {} });
                }}
              >
                <SelectTrigger id="ds-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plugins.map((p) => (
                    <SelectItem key={p.type} value={p.type}>
                      {p.title?.trim() || p.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DatasourceFormPluginConfig
            form={form}
            setForm={setForm}
            plugin={selectedPlugin}
            onValidityChange={setPluginConfigValid}
          />

          {formError && (
            <Alert variant="destructive">
              <AlertTitle>校验失败</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
        </div>
      </form>
    </Page>
  );
}
