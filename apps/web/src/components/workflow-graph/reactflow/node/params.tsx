import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import Form from '@rjsf/shadcn';
import validator from '@rjsf/validator-ajv8';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { useMemo } from 'react';

import { SocketDescriptionTooltip } from './socket-description-tooltip';

export interface IParamRowProps<TValType = unknown> {
  label: string;
  description?: string | null;
  readOnly: boolean;
  value: TValType;
  onChange: (v: TValType) => void;
}

function ParamFieldLabel({ label, description }: { label: string; description?: string | null }) {
  const d = description?.trim();
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {d ? <SocketDescriptionTooltip description={d} /> : null}
    </div>
  );
}

export function BooleanParamRow(props: IParamRowProps<boolean>) {
  const { label, description, readOnly, value, onChange } = props;
  return (
    <div className="flex items-center justify-between gap-2 overflow-hidden">
      <ParamFieldLabel label={label} description={description} />
      <Switch
        className={cn({ 'cursor-pointer': !readOnly })}
        size="sm"
        disabled={readOnly}
        checked={Boolean(value)}
        onCheckedChange={(checked) => onChange(checked)}
      />
    </div>
  );
}

export function StringParamRow(props: IParamRowProps<string>) {
  const { label, description, readOnly, value, onChange } = props;
  const s = value === null || value === undefined ? '' : String(value);
  return (
    <div>
      <ParamFieldLabel label={label} description={description} />
      <Input
        type="text"
        disabled={readOnly}
        className="h-7 font-mono text-xs"
        value={s}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function TextareaParamRow(props: IParamRowProps<string> & { rows?: number }) {
  const { label, description, readOnly, value, onChange, rows = 6 } = props;
  const s = value === null || value === undefined ? '' : String(value);
  const rowCount = Math.max(2, Math.min(Number(rows) || 6, 40));
  return (
    <div>
      <ParamFieldLabel label={label} description={description} />
      <Textarea
        disabled={readOnly}
        rows={rowCount}
        className="min-h-0 max-h-48 resize-y font-mono text-xs leading-snug"
        value={s}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

type tOptionItem = string | number | { label: string | number; value: string | number };

export function SelectParamRow(props: IParamRowProps<tOptionItem> & { options: tOptionItem[] }) {
  const { label, description, options, readOnly, value, onChange } = props;
  const current = value === null || value === undefined ? '' : String(value);

  const optionsItems = options.map((o) => {
    if (typeof o === 'object' && o.label && o.value) {
      return o;
    }
    return { label: String(o), value: String(o) };
  });

  return (
    <div>
      <ParamFieldLabel label={label} description={description} />
      <Select
        modal={false}
        value={current}
        onValueChange={(v) => {
          if (v === null || v === undefined) return;
          const hit = options.find((o) => String(o) === v);
          if (hit === undefined) {
            onChange(v);
            return;
          }
          onChange(hit);
        }}
        disabled={readOnly}
      >
        <SelectTrigger size="sm" className="h-7 w-full text-xs">
          <SelectValue placeholder="请选择">
            {(val) => {
              const key = val === null || val === undefined ? '' : String(val);
              if (key === '') return null;
              const hit = optionsItems.find((o) => String(o.value) === key);
              return hit?.label ?? key;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {optionsItems.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DateParamRow(props: IParamRowProps<string>) {
  const { label, description, readOnly, value, onChange } = props;
  return (
    <div>
      <ParamFieldLabel label={label} description={description} />
      <DatePicker disabled={readOnly} value={value} onChange={(next) => onChange(next)} placeholder="选择日期" />
    </div>
  );
}

export function DateTimeParamRow(props: IParamRowProps<string>) {
  const { label, description, readOnly, value, onChange } = props;
  const s = value === null || value === undefined ? '' : String(value);
  return (
    <div>
      <ParamFieldLabel label={label} description={description} />
      <DatePicker disabled={readOnly} value={s} onChange={(next) => onChange(next)} placeholder="选择日期时间" />
    </div>
  );
}

export function NumberParamRow(props: IParamRowProps<number | undefined> & { maximum: number; minimum: number }) {
  const { label, description, maximum, minimum, readOnly, value, onChange } = props;
  const numStr = value === null || value === undefined ? '' : String(value);
  return (
    <div>
      <ParamFieldLabel label={label} description={description} />
      <Input
        type="number"
        disabled={readOnly}
        className="h-7 font-mono text-xs"
        value={numStr}
        min={minimum ?? undefined}
        max={maximum ?? undefined}
        step="any"
        onChange={(e) => {
          const s = e.target.value.trim();
          if (s === '' || s === '-') onChange(undefined);
          else onChange(Number(s));
        }}
      />
    </div>
  );
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const getFactorId = (v: unknown): string | null => {
  if (!isRecord(v)) return null;
  if (!('factor_id' in v)) return null;
  const fid = v.factor_id;
  return fid === null || fid === undefined ? '' : String(fid);
};

export function RjsfParamRow(
  props: IParamRowProps<unknown> & {
    json_schema?: unknown;
    ui_schema?: unknown;
  },
) {
  const { label, description, readOnly, value, onChange, json_schema, ui_schema } = props;
  const schema = useMemo(() => (json_schema ?? {}) as RJSFSchema, [json_schema]);
  const uiSchema = useMemo(() => (ui_schema ?? {}) as UiSchema, [ui_schema]);

  const rjsfKey = useMemo(() => {
    const fid = getFactorId(value);
    return fid === null ? 'rjsf:default' : `rjsf:factor:${fid}`;
  }, [value]);

  const factorParamsDefaultsByFactorId = useMemo(() => {
    const out = new Map<string, unknown>();
    const schemaRec = isRecord(schema) ? schema : {};
    const deps = isRecord(schemaRec.dependencies) ? schemaRec.dependencies : {};
    const factorIdDep = isRecord(deps.factor_id) ? deps.factor_id : {};
    const oneOf = Array.isArray(factorIdDep.oneOf) ? factorIdDep.oneOf : [];

    for (const rawItem of oneOf) {
      if (!isRecord(rawItem)) continue;
      const props = isRecord(rawItem.properties) ? rawItem.properties : {};
      const factorIdProp = isRecord(props.factor_id) ? props.factor_id : {};
      const fid = factorIdProp.const;
      if (fid === null || fid === undefined) continue;
      const k = String(fid);
      const factorParamsProp = isRecord(props.factor_params) ? props.factor_params : {};
      const defaults = factorParamsProp.default;
      if (defaults !== undefined) out.set(k, defaults);
    }
    return out;
  }, [schema]);

  return (
    <div>
      <ParamFieldLabel label={label} description={description} />
      <Form
        key={rjsfKey}
        tagName="div"
        className={cn(
          // Align RJSF layout/typography with shadcn (tailwind + CSS vars)
          'text-xs text-foreground',
          'space-y-2',
          // Field groups & spacing
          '[&_.form-group]:space-y-1 [&_.field]:space-y-1 [&_.array-item]:space-y-2',
          // Labels / descriptions
          '[&_.control-label]:text-xs [&_.control-label]:text-muted-foreground [&_label]:text-xs [&_label]:text-muted-foreground',
          '[&_.field-description]:text-xs [&_.field-description]:text-muted-foreground [&_.help-block]:text-xs [&_.help-block]:text-muted-foreground',
          // Errors
          '[&_.text-danger]:text-destructive [&_.error-detail]:text-destructive [&_.field-error]:text-destructive',
          // Inputs (covers default RJSF bootstrap-ish classnames)
          '[&_.form-control]:h-7 [&_.form-control]:rounded-md [&_.form-control]:border [&_.form-control]:border-input [&_.form-control]:bg-background [&_.form-control]:px-2 [&_.form-control]:py-1 [&_.form-control]:text-xs [&_.form-control]:shadow-sm',
          '[&_.form-control:focus]:outline-none [&_.form-control:focus]:ring-1 [&_.form-control:focus]:ring-ring',
          '[&_.form-control:disabled]:cursor-not-allowed [&_.form-control:disabled]:opacity-50',
          // Selects
          '[&_.form-select]:h-7 [&_.form-select]:rounded-md [&_.form-select]:border [&_.form-select]:border-input [&_.form-select]:bg-background [&_.form-select]:px-2 [&_.form-select]:text-xs [&_.form-select]:shadow-sm',
          '[&_.form-select:focus]:outline-none [&_.form-select:focus]:ring-1 [&_.form-select:focus]:ring-ring',
          // Checkboxes / radios
          '[&_.checkbox]:h-4 [&_.checkbox]:w-4 [&_.radio]:h-4 [&_.radio]:w-4',
        )}
        schema={schema}
        uiSchema={{
          ...(uiSchema ?? {}),
          'ui:submitButtonOptions': { norender: true },
        }}
        validator={validator}
        formData={value as unknown}
        disabled={readOnly}
        readonly={readOnly}
        liveValidate={false}
        noHtml5Validate
        onChange={(next) => {
          const nextData = next.formData as unknown;
          const prevFid = getFactorId(value);
          const nextFid = getFactorId(nextData);

          if (prevFid !== null && nextFid !== null && prevFid !== nextFid) {
            const defaults = factorParamsDefaultsByFactorId.get(nextFid);
            if (defaults !== undefined && isRecord(nextData)) {
              onChange({ ...nextData, factor_params: defaults } as unknown);
              return;
            }
          }

          onChange(next.formData);
        }}
      >
        <></>
      </Form>
    </div>
  );
}
