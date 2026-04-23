'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/reui/badge';

import { applyFormMetadataToSource, parseUserFactorMetadataFromSource, type FactorDetailPublic } from '@/models/factor';
import { CodeJar } from '@/components/ui/code-jar';
import { FactorDependenciesCombobox } from './factor-dependencies-combobox';
import { FactorGroupCombobox } from './factor-group-combobox';

const SYNC_FROM_FORM_FIELDS: (keyof FactorDetailPublic)[] = ['name', 'group', 'description', 'window', 'dependencies'];

/** 与表单内 `set` 一致：改元数据时写回源码，改 `source` 时从源码解析元数据。 */
export function applyFactorFormPatch(f: FactorDetailPublic, patch: Partial<FactorDetailPublic>): FactorDetailPublic {
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

type FactorFieldBaseProps = {
  form: FactorDetailPublic;
  set: (patch: Partial<FactorDetailPublic>) => void;
  readOnly: boolean;
  pid: (s: string) => string;
};

type FactorMetaFieldsProps = FactorFieldBaseProps & {
  hideNameField: boolean;
  hideDescriptionField: boolean;
};

export function FactorMetaFields(props: FactorMetaFieldsProps) {
  const { form, set, readOnly, pid, hideNameField, hideDescriptionField } = props;
  const dependencies = form.dependencies;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {!hideNameField ? (
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
                onChange={(e) => set({ name: e.target.value })}
                placeholder="my_factor"
                autoComplete="off"
              />
            )}
          </div>
        ) : null}
        <div className="min-w-0 space-y-2">
          <Label htmlFor={pid('group')}>分组 group</Label>
          {readOnly ? (
            <div className="rounded-md bg-muted/30 px-3 py-2 font-mono text-sm">{form.group || '-'}</div>
          ) : (
            <FactorGroupCombobox id={pid('group')} value={form.group} onValueChange={(group) => set({ group })} />
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
                set({ window: Number.isFinite(next) ? next : 1 });
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
              onChange={(e) => set({ description: e.target.value })}
            />
          )}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={pid('deps')}>依赖列 dependencies</Label>
        {readOnly ? (
          dependencies.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {dependencies.map((dep) => (
                <Badge key={dep} variant="secondary" size="default" className="font-mono">
                  {dep}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">-</div>
          )
        ) : (
          <FactorDependenciesCombobox
            id={pid('deps')}
            value={form.dependencies}
            onValueChange={(dependencies) => set({ dependencies })}
          />
        )}
        <p className="text-xs text-muted-foreground">
          多选常用列；列表含当前 workspace 中因子已用过的列。新列名需符合标识符规则，输入后按 Enter 添加。
        </p>
      </div>
    </>
  );
}

type FactorSourceFieldProps = FactorFieldBaseProps;

export function FactorSourceField(props: FactorSourceFieldProps) {
  const { form, set, readOnly, pid } = props;
  return (
    <div className="space-y-2">
      <Label htmlFor={pid('source')}>Python 源码</Label>
      {readOnly ? (
        <CodeJar id={pid('source')} value={form.source} readOnly />
      ) : (
        <CodeJar id={pid('source')} value={form.source} onChange={(source) => set({ source })} />
      )}
    </div>
  );
}
