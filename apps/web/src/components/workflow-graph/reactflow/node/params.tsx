
import {
  DatePicker,
} from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface IParamRowProps<TValType = unknown> {
  label: string;
  readOnly: boolean;
  value: TValType;
  onChange: (v: TValType) => void;
}


export function BooleanParamRow(props: IParamRowProps<boolean>) {
  const { label, readOnly, value, onChange } = props;
  return (
    <div className="flex items-center justify-between gap-2 overflow-hidden">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Switch
        className={cn({ "cursor-pointer": !readOnly })}
        size="sm"
        disabled={readOnly}
        checked={Boolean(value)}
        onCheckedChange={(checked) => onChange(checked)}
      />
    </div>
  );
}

export function StringParamRow(props: IParamRowProps<string>) {
  const { label, readOnly, value, onChange } = props;
  const s =
    value === null || value === undefined ? "" : String(value);
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
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

type tOptionItem = string | number | { label: string | number; value: string | number };

export function SelectParamRow(props: IParamRowProps<tOptionItem> & { options: tOptionItem[] }) {
  const { label, options, readOnly, value, onChange } = props;
  const current =
    value === null || value === undefined ? "" : String(value);

  const optionsItems = options.map((o) => {
    if (typeof o === 'object' && o.label && o.value) {
      return o
    }
    return { label: String(o), value: String(o) };
  })

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
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
              const key =
                val === null || val === undefined ? "" : String(val);
              if (key === "") return null;
              const hit = optionsItems.find(
                (o) => String(o.value) === key,
              );
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
  const { label, readOnly, value, onChange } = props;
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <DatePicker
        disabled={readOnly}
        value={value}
        onChange={(next) => onChange(next)}
        placeholder="选择日期"
      />
    </div>
  );
}

export function DateTimeParamRow(props: IParamRowProps<string>) {
  const { label, readOnly, value, onChange } = props;
  const s =
    value === null || value === undefined ? "" : String(value);
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <DatePicker
        disabled={readOnly}
        value={s}
        onChange={(next) => onChange(next)}
        placeholder="选择日期时间"
      />
    </div>
  );
}

export function NumberParamRow(props: IParamRowProps<number | undefined> & { maximum: number; minimum: number }) {
  const { label, maximum, minimum, readOnly, value, onChange } = props;
  const numStr =
    value === null || value === undefined
      ? ""
      : String(value);
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
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
          if (s === "" || s === "-") onChange(undefined);
          else onChange(Number(s));
        }}
      />
    </div>
  );
}
