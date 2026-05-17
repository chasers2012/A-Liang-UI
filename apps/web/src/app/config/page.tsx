'use client';

import { useEffect, useMemo, useState } from 'react';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';

import { ApiError } from '@/api/client';
import { getConfig, getConfigSpecs, putConfig } from '@/api/config';
import { EmptyState } from '@/components/empty-state';
import { Page } from '@/components/page';
import { RjsfStyledForm } from '@/components/rjsf-styled-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ConfigModuleSpecPublic } from '@/models/config/dto';

type ModuleValuesMap = Record<string, Record<string, unknown>>;
type ModuleBusyMap = Record<string, { loading: boolean; saving: boolean }>;
type ModuleMessageMap = Record<string, string | null>;

export default function AgentConfigPage() {
  const [specs, setSpecs] = useState<ConfigModuleSpecPublic[]>([]);
  const [moduleValues, setModuleValues] = useState<ModuleValuesMap>({});
  const [moduleBusy, setModuleBusy] = useState<ModuleBusyMap>({});
  const [moduleErrors, setModuleErrors] = useState<ModuleMessageMap>({});
  const [moduleSuccess, setModuleSuccess] = useState<ModuleMessageMap>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGlobalError(null);
    void getConfigSpecs()
      .then(async (resp) => {
        if (cancelled) return;
        setSpecs(resp.items);
        const busyInit: ModuleBusyMap = {};
        resp.items.forEach((item) => {
          busyInit[item.key] = { loading: true, saving: false };
        });
        setModuleBusy(busyInit);

        await Promise.all(
          resp.items.map(async (item) => {
            try {
              const data = await getConfig(item.key);
              if (cancelled) return;
              setModuleValues((prev) => ({ ...prev, [item.key]: data.values }));
              setModuleErrors((prev) => ({ ...prev, [item.key]: null }));
            } catch (err) {
              if (cancelled) return;
              const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
              setModuleErrors((prev) => ({ ...prev, [item.key]: message }));
            } finally {
              if (cancelled) return;
              setModuleBusy((prev) => ({
                ...prev,
                [item.key]: { loading: false, saving: false },
              }));
            }
          }),
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setGlobalError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allLoading = useMemo(() => Object.values(moduleBusy).some((item) => item.loading), [moduleBusy]);

  const onSaveModule = async (moduleKey: string) => {
    const currentValues = moduleValues[moduleKey] ?? {};
    setModuleBusy((prev) => ({
      ...prev,
      [moduleKey]: { ...(prev[moduleKey] ?? { loading: false }), saving: true },
    }));
    setModuleErrors((prev) => ({ ...prev, [moduleKey]: null }));
    setModuleSuccess((prev) => ({ ...prev, [moduleKey]: null }));
    try {
      const resp = await putConfig(moduleKey, currentValues);
      setModuleValues((prev) => ({ ...prev, [moduleKey]: resp.values }));
      setModuleSuccess((prev) => ({ ...prev, [moduleKey]: '已保存。' }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
      setModuleErrors((prev) => ({ ...prev, [moduleKey]: message }));
    } finally {
      setModuleBusy((prev) => ({
        ...prev,
        [moduleKey]: { ...(prev[moduleKey] ?? { loading: false }), saving: false },
      }));
    }
  };

  const schemaForModule = (module: ConfigModuleSpecPublic): RJSFSchema => module.schema as RJSFSchema;

  const uiSchemaForModule = (module: ConfigModuleSpecPublic, disabled: boolean): UiSchema => ({
    ...(module.uiSchema as UiSchema),
    'ui:disabled': disabled,
  });

  return (
    <Page
      title="配置"
      description={<>动态加载后端可注册配置项。新增后端配置模块后，无需改前端页面结构即可在此展示并保存。</>}
    >
      <div className="space-y-4">
        {globalError ? (
          <p className="text-sm text-destructive" role="alert">
            加载配置定义失败：{globalError}
          </p>
        ) : null}

        {!globalError && specs.length === 0 && !allLoading ? (
          <EmptyState title="暂无可配置模块" description="后端未返回可编辑的配置定义。" compact />
        ) : null}

        {specs.map((module) => {
          const busy = moduleBusy[module.key] ?? { loading: false, saving: false };
          const formData = moduleValues[module.key] ?? {};
          const schema = schemaForModule(module);
          return (
            <Card key={module.key}>
              <CardHeader>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description ?? '无描述'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {moduleErrors[module.key] ? (
                  <p className="text-sm text-destructive" role="alert">
                    {moduleErrors[module.key]}
                  </p>
                ) : null}
                {moduleSuccess[module.key] ? (
                  <p className="text-sm text-muted-foreground">{moduleSuccess[module.key]}</p>
                ) : null}
                <div className="max-w-xl">
                  <RjsfStyledForm
                    schema={schema}
                    uiSchema={uiSchemaForModule(module, busy.loading || busy.saving)}
                    validator={validator}
                    formData={formData}
                    onChange={(next) =>
                      setModuleValues((prev) => ({
                        ...prev,
                        [module.key]: (next.formData as Record<string, unknown>) ?? {},
                      }))
                    }
                    liveValidate={false}
                    noHtml5Validate
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => void onSaveModule(module.key)}
                  disabled={busy.loading || busy.saving}
                >
                  {busy.saving ? '保存中...' : '保存'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
