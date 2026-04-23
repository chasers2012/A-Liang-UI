'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/reui/badge';
import { useAtomValue, useSetAtom } from 'jotai';

import {
  factorsEditDependenciesAtom,
  factorsEditDescriptionAtom,
  factorsEditGroupAtom,
  factorsEditNameAtom,
  factorsEditWindowAtom,
  factorsSourceDraftAtom,
  factorsVisibleDetailAtom,
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
    <div className="space-y-2">
      <Label htmlFor={pid('source')}>Python 源码</Label>
      {readOnly ? (
        <CodeJar id={pid('source')} value={form.source} readOnly />
      ) : (
        <CodeJar id={pid('source')} value={form.source} onChange={(source) => setSourceDraft(source)} />
      )}
    </div>
  );
}
