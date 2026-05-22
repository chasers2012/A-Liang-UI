'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import validator from '@rjsf/validator-ajv8';

import { EmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { RjsfStyledForm } from '@/components/rjsf-styled-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  configPageRefreshOnMountEffectAtom,
  configPageStateAtom,
  getConfigModuleAtoms,
  saveConfigModuleAtom,
  type ConfigModuleView,
} from '@/models/config';

function ConfigModuleCard({ module }: { module: ConfigModuleView }) {
  const { spec, schema, uiSchema, loading, saving, loadError, saveError, saveSuccess } = module;
  const { valueAtom } = getConfigModuleAtoms(spec.key);
  const [formData, setFormData] = useAtom(valueAtom);
  const saveModule = useSetAtom(saveConfigModuleAtom);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{spec.title}</CardTitle>
        <CardDescription>{spec.description ?? '无描述'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="max-w-xl">
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

        <Button type="button" onClick={() => void saveModule(spec.key)} disabled={loading || saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AgentConfigPage() {
  const { specsError, showEmpty, modules } = useAtomValue(configPageStateAtom);
  useAtom(configPageRefreshOnMountEffectAtom);

  return (
    <Page
      title="配置"
      description={<>动态加载后端可注册配置项。新增后端配置模块后，无需改前端页面结构即可在此展示并保存。</>}
    >
      <div className="space-y-4">
        {specsError ? (
          <p className="text-sm text-destructive" role="alert">
            加载配置定义失败：{specsError}
          </p>
        ) : null}

        {showEmpty ? <EmptyState title="暂无可配置模块" description="后端未返回可编辑的配置定义。" compact /> : null}

        {modules.map((module) => (
          <ConfigModuleCard key={module.spec.key} module={module} />
        ))}
      </div>
    </Page>
  );
}
