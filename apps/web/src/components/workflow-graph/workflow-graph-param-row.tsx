
import type { NodeParamModel } from "@/models/evaluation-metric/dto";
import { BooleanParamRow, DateParamRow, DateTimeParamRow, NumberParamRow, SelectParamRow, StringParamRow } from "./reactflow/node/params";


export function nodeParamEffectiveValue(
  params: Record<string, unknown>,
  spec: NodeParamModel,
): unknown {
  if (Object.prototype.hasOwnProperty.call(params, spec.key)) {
    return params[spec.key];
  }
  return spec.default;
}

const paramTypeMap = {
  date: DateParamRow,
  datetime: DateTimeParamRow,
  select: SelectParamRow,
  toggle: BooleanParamRow,
  number: NumberParamRow,
  string: StringParamRow,
} as const;


export function WorkflowNodeParamFieldRow(props: {
  spec: NodeParamModel;
  value: unknown;
  readOnly: boolean;
  onChange: (v: unknown) => void;
}) {
  const { spec, value, readOnly, onChange } = props;
  const { key, label, type: valType, render_type: rt, ...rest } = spec
  const renderLabel = label?.trim() || key;
  if (!rt) {
    return null;
  }
  if (!(rt in paramTypeMap)) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component: any = paramTypeMap[rt as keyof typeof paramTypeMap];


  return <Component label={renderLabel} readOnly={readOnly} value={value} onChange={onChange} {...rest} />;

}
