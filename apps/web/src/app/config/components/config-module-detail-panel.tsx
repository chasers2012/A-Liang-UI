'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import validator from '@rjsf/validator-ajv8';

import { CollapsibleSidebarDrawerTrigger } from '@/components/collapsible-sidebar';
import { PanelPlaceholder } from '@/components/empty-state';
import { PanelDetailCard } from '@/components/panel-detail-card';
import { RjsfStyledForm } from '@/components/rjsf-styled-form';
import { Button } from '@/components/ui/button';
import {
  configPageStateAtom,
  getConfigModuleAtoms,
  saveConfigModuleAtom,
  type ConfigModuleView,
} from '@/models/config';
import { configSelectedModuleKeyAtom } from '@/models/config/selection.atom';

function ConfigModuleFormContent({ moduleView }: { moduleView: ConfigModuleView }) {
  const { spec, schema, uiSchema, loading, loadError, saveError, saveSuccess } = moduleView;
  const { valueAtom } = getConfigModuleAtoms(spec.key);
  const [formData, setFormData] = useAtom(valueAtom);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      {spec.description ? <p className="text-sm text-muted-foreground">{spec.description}</p> : null}
      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          加载配置失败：{loadError}
        </p>
      ) : null}
      {saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {saveError}
        </p>
      ) : null}
      {saveSuccess ? <p className="text-sm text-muted-foreground">{saveSuccess}</p> : null}

      <div className="max-w-2xl">
        {loading ? (
          <p className="text-sm text-muted-foreground">加载配置中…</p>
        ) : (
          <RjsfStyledForm
            schema={schema}
            uiSchema={uiSchema}
            validator={validator}
            formData={formData}
            onChange={(next) => setFormData((next.formData as Record<string, unknown>) ?? {})}
            liveValidate={false}
            noHtml5Validate
          />
        )}
      </div>
    </div>
  );
}

function ConfigModuleSaveActions({ moduleView }: { moduleView: ConfigModuleView }) {
  const saveModule = useSetAtom(saveConfigModuleAtom);
  const { spec, loading, saving } = moduleView;

  return (
    <Button type="button" onClick={() => void saveModule(spec.key)} disabled={loading || saving}>
      {saving ? '保存中...' : '保存'}
    </Button>
  );
}

export function ConfigModuleDetailPanel() {
  const selectedKey = useAtomValue(configSelectedModuleKeyAtom);
  const { modules } = useAtomValue(configPageStateAtom);
  const moduleView = modules.find((m) => m.spec.key === selectedKey) ?? null;

  if (!selectedKey || !moduleView) {
    return (
      <PanelDetailCard
        titleActions={<CollapsibleSidebarDrawerTrigger />}
        title="配置详情"
        className="flex min-h-0 flex-1 flex-col"
      >
        <PanelPlaceholder
          title="请选择配置模块"
          description="从左侧选择一个模块；新增后端配置模块后会自动出现在列表中。"
        />
      </PanelDetailCard>
    );
  }

  return (
    <PanelDetailCard
      titleActions={<CollapsibleSidebarDrawerTrigger />}
      title={moduleView.spec.title}
      className="flex min-h-0 flex-1 flex-col"
      actions={<ConfigModuleSaveActions moduleView={moduleView} />}
    >
      <ConfigModuleFormContent moduleView={moduleView} />
    </PanelDetailCard>
  );
}
