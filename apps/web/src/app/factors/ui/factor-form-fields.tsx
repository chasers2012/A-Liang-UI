'use client';

import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
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
    <Field className="gap-2">
      <FieldLabel htmlFor={pid('params')}>参数 params</FieldLabel>
      {paramSpecs.length > 0 ? (
        <div id={pid('params')} className="text-sm">
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
                      <Input
                        id={pid(`params-name-${p.name}`)}
                        className="h-7 w-28 font-mono text-xs"
                        value={p.name}
                        readOnly={readOnly}
                        onChange={(e) => {
                          setParamSpecs((current) => {
                            return (current ?? []).map((row, i) =>
                              i === index ? { ...row, name: e.target.value } : row,
                            );
                          });
                        }}
                      />
                    </td>
                    <td className="min-w-[180px] py-1 pr-2">
                      <Input
                        id={pid(`params-label-${p.name}`)}
                        className="h-7 min-w-[96px] w-full text-xs"
                        value={p.label}
                        readOnly={readOnly}
                        onChange={(e) => {
                          const label = e.target.value;
                          setParamSpecs((current) =>
                            (current ?? []).map((row, i) => (i === index ? { ...row, label } : row)),
                          );
                        }}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        id={pid(`params-default-${p.name}`)}
                        type="number"
                        className="h-7 w-24 font-mono text-xs"
                        value={p.default ?? ''}
                        readOnly={readOnly}
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
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        id={pid(`params-min-${p.name}`)}
                        type="number"
                        className="h-7 w-20 font-mono text-xs"
                        value={p.min ?? ''}
                        readOnly={readOnly}
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
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        id={pid(`params-max-${p.name}`)}
                        type="number"
                        className="h-7 w-20 font-mono text-xs"
                        value={p.max ?? ''}
                        readOnly={readOnly}
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
        <div id={pid('params')} className="flex h-8 items-center text-muted-foreground">
          -
        </div>
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
    </Field>
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
    <FieldGroup>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        {!hideNameField && (
          <Field className="gap-2 sm:col-span-2">
            <FieldLabel htmlFor={pid('name')}>标识 name</FieldLabel>
            <Input
              id={pid('name')}
              className="font-mono text-sm"
              value={form.name}
              readOnly={readOnly}
              onChange={(e) => setName(e.target.value)}
              placeholder={readOnly ? '-' : 'my_factor'}
              autoComplete="off"
            />
          </Field>
        )}
        <Field className="min-w-0 gap-2">
          <FieldLabel htmlFor={pid('group')}>分组 group</FieldLabel>
          {readOnly ? (
            <Input
              id={pid('group')}
              className="font-mono text-sm"
              value={form.group}
              readOnly
              placeholder="-"
              onChange={() => {}}
            />
          ) : (
            <FactorGroupCombobox id={pid('group')} value={form.group} onValueChange={(group) => setGroup(group)} />
          )}
          <FieldDescription>可选已有分组或输入新名称。</FieldDescription>
        </Field>
        <Field className="min-w-0 gap-2">
          <FieldLabel htmlFor={pid('mw')}>window</FieldLabel>
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
        </Field>
      </FieldGroup>
      {!hideDescriptionField ? (
        <Field className="gap-2">
          <FieldLabel htmlFor={pid('desc')}>描述</FieldLabel>
          <Textarea
            id={pid('desc')}
            rows={2}
            value={form.description}
            readOnly={readOnly}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={readOnly ? '-' : undefined}
          />
        </Field>
      ) : null}
      <Field className="gap-2">
        <FieldLabel htmlFor={pid('deps')}>依赖列 dependencies</FieldLabel>
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
            <div className="flex h-8 items-center text-muted-foreground">-</div>
          )
        ) : (
          <FactorDependenciesCombobox
            id={pid('deps')}
            value={form.dependencies}
            onValueChange={(deps) => setDependencies(deps)}
          />
        )}
      </Field>
      <FactorParamsField pid={pid} readOnly={readOnly} paramSpecs={form.param_specs ?? []} />
    </FieldGroup>
  );
}

type FactorSourceFieldProps = FactorFieldBaseProps;

export function FactorSourceField(props: FactorSourceFieldProps) {
  const { readOnly, pid } = props;
  const form = useAtomValue(factorsVisibleDetailAtom);
  const setSourceDraft = useSetAtom(factorsSourceDraftAtom);
  if (!form) return null;
  return (
    <Field className="flex h-full min-h-0 flex-1 gap-2">
      <FieldLabel htmlFor={pid('source')}>Python 源码</FieldLabel>
      <CodeJar
        id={pid('source')}
        value={form.source}
        readOnly={readOnly}
        onChange={setSourceDraft}
        className="h-full min-h-0 flex-1"
      />
    </Field>
  );
}
