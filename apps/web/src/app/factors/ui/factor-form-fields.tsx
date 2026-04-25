'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/reui/badge';
import { Button } from '@/components/ui/button';
import { useAtomValue, useSetAtom } from 'jotai';
import { Plus, Trash2 } from 'lucide-react';

import {
  factorsEditDependenciesAtom,
  factorsEditDescriptionAtom,
  factorsEditGroupAtom,
  factorsEditNameAtom,
  factorsEditWindowAtom,
  factorsSourceDraftAtom,
  factorsVisibleDetailAtom,
  factorsEditParamSpecsAtom,
} from '@/models/factor';
import { CodeJar } from '@/components/ui/code-jar';
import { FactorDependenciesCombobox } from './factor-dependencies-combobox';
import { FactorGroupCombobox } from './factor-group-combobox';

type FactorFieldBaseProps = {
  readOnly: boolean;
  pid: (s: string) => string;
};

type FactorMetaFieldsProps = FactorFieldBaseProps & {
  hideNameField: boolean;
  hideDescriptionField: boolean;
};

function FactorParamsField({
  pid,
  readOnly,
  paramSpecs,
}: Pick<FactorFieldBaseProps, 'pid' | 'readOnly'> & {
  paramSpecs: Array<{ name: string; label: string; default?: number | null; min?: number | null; max?: number | null }>;
}) {
  const setParamSpecs = useSetAtom(factorsEditParamSpecsAtom);

  return (
    <div className="space-y-2">
      <Label htmlFor={pid('params')}>参数 params</Label>
      {paramSpecs.length > 0 ? (
        <div className="rounded-md bg-muted/30 px-3 py-2 text-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="text-left font-medium py-1 pr-2 whitespace-nowrap">name</th>
                  <th className="text-left font-medium py-1 pr-2 whitespace-nowrap">label</th>
                  <th className="text-left font-medium py-1 pr-2 whitespace-nowrap">default</th>
                  <th className="text-left font-medium py-1 pr-2 whitespace-nowrap">min</th>
                  <th className="text-left font-medium py-1 pr-2 whitespace-nowrap">max</th>
                  {!readOnly ? <th className="text-right font-medium py-1 whitespace-nowrap">操作</th> : null}
                </tr>
              </thead>
              <tbody>
                {paramSpecs.map((p, index) => (
                  <tr key={`${p.name}-${index}`} className="align-middle">
                    <td className="py-1 pr-2">
                      {readOnly ? (
                        <Badge variant="secondary" size="default" className="font-mono shrink-0">
                          {p.name}
                        </Badge>
                      ) : (
                        <Input
                          id={pid(`params-name-${p.name}`)}
                          className="h-7 w-28 font-mono text-xs"
                          value={p.name}
                          onChange={(e) => {
                            setParamSpecs((current) => {
                              return (current ?? []).map((row, i) =>
                                i === index ? { ...row, name: e.target.value } : row,
                              );
                            });
                          }}
                        />
                      )}
                    </td>
                    <td className="py-1 pr-2 min-w-[180px]">
                      {readOnly ? (
                        <span className="text-muted-foreground">{p.label}</span>
                      ) : (
                        <Input
                          id={pid(`params-label-${p.name}`)}
                          className="h-7 min-w-[96px] w-full text-xs"
                          value={p.label}
                          onChange={(e) => {
                            const label = e.target.value;
                            setParamSpecs((current) =>
                              (current ?? []).map((row, i) => (i === index ? { ...row, label } : row)),
                            );
                          }}
                        />
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {readOnly ? (
                        <span className="font-mono text-xs text-muted-foreground">{p.default ?? '-'}</span>
                      ) : (
                        <Input
                          id={pid(`params-default-${p.name}`)}
                          type="number"
                          className="h-7 w-24 font-mono text-xs"
                          value={p.default ?? ''}
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (v === '' || v === '-') {
                              setParamSpecs((current) =>
                                (current ?? []).map((row, i) => (i === index ? { ...row, default: null } : row)),
                              );
                              return;
                            }
                            const n = Number(v);
                            if (!Number.isFinite(n)) return;
                            setParamSpecs((current) =>
                              (current ?? []).map((row, i) => (i === index ? { ...row, default: n } : row)),
                            );
                          }}
                        />
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {readOnly ? (
                        <span className="font-mono text-xs text-muted-foreground">{p.min ?? '-'}</span>
                      ) : (
                        <Input
                          id={pid(`params-min-${p.name}`)}
                          type="number"
                          className="h-7 w-20 font-mono text-xs"
                          value={p.min ?? ''}
                          placeholder="min"
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (v === '' || v === '-') {
                              setParamSpecs((current) =>
                                (current ?? []).map((row, i) => (i === index ? { ...row, min: null } : row)),
                              );
                              return;
                            }
                            const n = Number(v);
                            if (!Number.isFinite(n)) return;
                            setParamSpecs((current) =>
                              (current ?? []).map((row, i) => (i === index ? { ...row, min: n } : row)),
                            );
                          }}
                        />
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {readOnly ? (
                        <span className="font-mono text-xs text-muted-foreground">{p.max ?? '-'}</span>
                      ) : (
                        <Input
                          id={pid(`params-max-${p.name}`)}
                          type="number"
                          className="h-7 w-20 font-mono text-xs"
                          value={p.max ?? ''}
                          placeholder="max"
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (v === '' || v === '-') {
                              setParamSpecs((current) =>
                                (current ?? []).map((row, i) => (i === index ? { ...row, max: null } : row)),
                              );
                              return;
                            }
                            const n = Number(v);
                            if (!Number.isFinite(n)) return;
                            setParamSpecs((current) =>
                              (current ?? []).map((row, i) => (i === index ? { ...row, max: n } : row)),
                            );
                          }}
                        />
                      )}
                    </td>
                    {!readOnly ? (
                      <td className="py-1 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            setParamSpecs((current) => {
                              const rows = current ?? [];
                              if (index < 0 || index >= rows.length) return rows;
                              return rows.filter((_, i) => i !== index);
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">-</div>
      )}
      {!readOnly ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1"
          onClick={() =>
            setParamSpecs((current) => {
              const rows = current ?? [];
              const nextIndex = rows.length + 1;
              return [
                ...rows,
                {
                  name: `param_${nextIndex}`,
                  label: `参数${nextIndex}`,
                  default: 1,
                  min: 1,
                  max: 250,
                },
              ];
            })
          }
        >
          <Plus className="size-4" />
          新增参数
        </Button>
      ) : null}
    </div>
  );
}

export function FactorMetaFields(props: FactorMetaFieldsProps) {
  const { readOnly, pid, hideNameField, hideDescriptionField } = props;
  const form = useAtomValue(factorsVisibleDetailAtom);
  const setName = useSetAtom(factorsEditNameAtom);
  const setGroup = useSetAtom(factorsEditGroupAtom);
  const setDescription = useSetAtom(factorsEditDescriptionAtom);
  const setWindow = useSetAtom(factorsEditWindowAtom);
  const setDependencies = useSetAtom(factorsEditDependenciesAtom);
  if (!form) return null;
  const dependencies = form.dependencies;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {!hideNameField && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={pid('name')}>标识 name</Label>
            {readOnly ? (
              <div className="rounded-md bg-muted/30 px-3 py-2 font-mono text-sm">{form.name || '-'}</div>
            ) : (
              <Input
                id={pid('name')}
                className="font-mono text-sm"
                value={form.name}
                readOnly={readOnly}
                onChange={(e) => setName(e.target.value)}
                placeholder="my_factor"
                autoComplete="off"
              />
            )}
          </div>
        )}
        <div className="min-w-0 space-y-2">
          <Label htmlFor={pid('group')}>分组 group</Label>
          {readOnly ? (
            <div className="rounded-md bg-muted/30 px-3 py-2 font-mono text-sm">{form.group || '-'}</div>
          ) : (
            <FactorGroupCombobox id={pid('group')} value={form.group} onValueChange={(group) => setGroup(group)} />
          )}
          <p className="text-xs text-muted-foreground">可选已有分组或输入新名称。</p>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={pid('mw')}>window</Label>
          {readOnly ? (
            <div className="rounded-md bg-muted/30 px-3 py-2 font-mono text-sm">{form.window || '-'}</div>
          ) : (
            <Input
              id={pid('mw')}
              type="number"
              min={1}
              className="font-mono"
              value={String(form.window)}
              readOnly={readOnly}
              onChange={(e) => {
                const next = Number.parseInt(e.target.value, 10);
                setWindow(Number.isFinite(next) ? next : 1);
              }}
            />
          )}
        </div>
      </div>
      {!hideDescriptionField ? (
        <div className="space-y-2">
          <Label htmlFor={pid('desc')}>描述</Label>
          {readOnly ? (
            <div className="min-h-16 rounded-md bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
              {form.description || '-'}
            </div>
          ) : (
            <Textarea
              id={pid('desc')}
              rows={2}
              value={form.description}
              readOnly={readOnly}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={pid('deps')}>依赖列 dependencies</Label>
        {readOnly ? (
          dependencies.length > 0 ? (
            <div className="flex flex-wrap gap-1 h-[32px] items-center">
              {dependencies.map((dep) => (
                <Badge key={dep} variant="secondary" size="default" className="font-mono">
                  {dep}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground h-[32px]">-</div>
          )
        ) : (
          <FactorDependenciesCombobox
            id={pid('deps')}
            value={form.dependencies}
            onValueChange={(deps) => setDependencies(deps)}
          />
        )}
      </div>
      <FactorParamsField pid={pid} readOnly={readOnly} paramSpecs={form.param_specs ?? []} />
    </>
  );
}

type FactorSourceFieldProps = FactorFieldBaseProps;

export function FactorSourceField(props: FactorSourceFieldProps) {
  const { readOnly, pid } = props;
  const form = useAtomValue(factorsVisibleDetailAtom);
  const setSourceDraft = useSetAtom(factorsSourceDraftAtom);
  if (!form) return null;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Label htmlFor={pid('source')}>Python 源码</Label>
      <CodeJar
        id={pid('source')}
        value={form.source}
        readOnly={readOnly}
        onChange={setSourceDraft}
        className="h-full min-h-0 flex-1"
      />
    </div>
  );
}
