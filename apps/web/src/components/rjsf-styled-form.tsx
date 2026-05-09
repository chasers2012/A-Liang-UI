'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import Form from '@rjsf/shadcn';
import type { FieldTemplateProps, RJSFSchema, UiSchema, WidgetProps } from '@rjsf/utils';
import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { HelpCircle } from 'lucide-react';

type NavConf = { order?: string[]; navs?: Array<{ nav: string; name?: string }> };
type NavDrivenUiSchema = UiSchema & { navConf?: NavConf };

type TabPagination = {
  schema: RJSFSchema;
  uiSchema: NavDrivenUiSchema;
  fieldsByTab: Map<string, string[]>;
  ungrouped: string[];
  orderedTabs: string[];
  navLabelByKey: Map<string, string>;
};

type RjsfStyledFormProps = ComponentProps<typeof Form> & {
  tabbedByNav?: boolean;
};
type RjsfOnChangeArg = Parameters<NonNullable<RjsfStyledFormProps['onChange']>>[0];

type SubmitButtonOptions = { norender?: boolean };
type EnumOption = { label: string; value: unknown };

function isEnumValueMatched(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left == null || right == null) return false;
  if (typeof left === 'object' || typeof right === 'object') return false;
  return String(left) === String(right);
}

function resolveSubmitButtonNorender(uiSchema: UiSchema | undefined): boolean {
  const opts = (uiSchema as Record<string, unknown> | undefined)?.['ui:submitButtonOptions'] as
    | SubmitButtonOptions
    | undefined;
  return Boolean(opts?.norender);
}

function RjsfPortalSelectWidget(props: WidgetProps) {
  const enumOptions = Array.isArray(props.options.enumOptions)
    ? (props.options.enumOptions as EnumOption[])
    : ([] as EnumOption[]);
  if (props.multiple) {
    const selected = Array.isArray(props.value) ? (props.value as unknown[]) : [];
    const selectedIndexValues = enumOptions
      .map((option, index) =>
        selected.some((selectedValue) => isEnumValueMatched(selectedValue, option.value)) ? String(index) : null,
      )
      .filter((value): value is string => value !== null);
    return (
      <select
        id={props.id}
        multiple
        className="form-select h-7 w-full rounded-md px-2 text-xs shadow-sm"
        value={selectedIndexValues}
        disabled={props.disabled || props.readonly}
        required={props.required}
        onChange={(e) => {
          const next = Array.from(e.currentTarget.selectedOptions)
            .map((option) => Number(option.value))
            .filter((idx) => Number.isFinite(idx) && idx >= 0 && idx < enumOptions.length)
            .map((idx) => enumOptions[idx]?.value);
          props.onChange(next);
        }}
        onBlur={() => props.onBlur?.(props.id, props.value)}
        onFocus={() => props.onFocus?.(props.id, props.value)}
      >
        {enumOptions.map((option, index) => (
          <option key={`${props.id}-multi-${String(option.value)}-${index}`} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  const selectedIndex = enumOptions.findIndex((option) => isEnumValueMatched(option.value, props.value));
  const selectedValue = selectedIndex >= 0 ? String(selectedIndex) : undefined;
  const selectedLabel = selectedIndex >= 0 ? enumOptions[selectedIndex]?.label : undefined;
  const placeholder = typeof props.placeholder === 'string' && props.placeholder.trim() ? props.placeholder : '请选择';
  const emptyOptionValue = '__rjsf_empty__';

  return (
    <Select
      value={selectedValue}
      disabled={props.disabled || props.readonly}
      required={props.required}
      onValueChange={(next) => {
        if (next === emptyOptionValue) {
          props.onChange(props.options.emptyValue);
          return;
        }
        const idx = Number(next);
        if (!Number.isFinite(idx) || idx < 0 || idx >= enumOptions.length) return;
        props.onChange(enumOptions[idx]?.value);
      }}
      onOpenChange={(open) => {
        if (!open) {
          props.onBlur?.(props.id, props.value);
          return;
        }
        props.onFocus?.(props.id, props.value);
      }}
    >
      <SelectTrigger id={props.id} className="h-7 w-full rounded-md px-2 text-xs shadow-sm">
        <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {!props.required ? <SelectItem value={emptyOptionValue}>{placeholder}</SelectItem> : null}
        {enumOptions.map((option, index) => (
          <SelectItem key={`${props.id}-${String(option.value)}-${index}`} value={String(index)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function HoverDescriptionFieldTemplate(props: FieldTemplateProps) {
  const {
    id,
    classNames,
    style,
    hidden,
    required,
    readonly,
    disabled,
    label,
    displayLabel,
    rawDescription,
    errors,
    help,
    children,
  } = props;

  if (hidden) return null;

  const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
  const showDescriptionTooltip = description.length > 0;

  return (
    <div className={classNames} style={style}>
      {displayLabel ? (
        <div className="mb-1 flex items-center gap-1.5">
          <label htmlFor={id} className="control-label text-xs text-muted-foreground">
            {label}
            {required ? <span className="ml-0.5 text-destructive">*</span> : null}
          </label>
          {showDescriptionTooltip ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="inline-flex cursor-help items-center text-muted-foreground hover:text-foreground"
                    aria-label={`${label} 字段说明`}
                  >
                    <HelpCircle className="size-3.5" />
                  </span>
                }
              />
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                {description}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
      {displayLabel ? (
        children
      ) : showDescriptionTooltip ? (
        <div className="flex items-center gap-1.5">
          {children}
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className="inline-flex cursor-help items-center text-muted-foreground hover:text-foreground"
                  aria-label={`${label || id} 字段说明`}
                >
                  <HelpCircle className="size-3.5" />
                </span>
              }
            />
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              {description}
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        children
      )}
      {!readonly && !disabled ? errors : null}
      {help}
    </div>
  );
}

const RJSF_BASE_CLASSNAME = cn(
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
);

function shouldStopWheelPropagation(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      [
        'select',
        'textarea',
        '.form-select',
        '.form-control',
        '[role="listbox"]',
        '[data-radix-select-content]',
        '[data-radix-scroll-area-viewport]',
      ].join(','),
    ),
  );
}

function collectSchemaFieldNames(schema: unknown, out: Set<string>) {
  if (!schema || typeof schema !== 'object') return;
  const node = schema as Record<string, unknown>;

  const props = node.properties;
  if (props && typeof props === 'object') {
    Object.keys(props as Record<string, unknown>).forEach((key) => out.add(key));
    Object.values(props as Record<string, unknown>).forEach((child) => collectSchemaFieldNames(child, out));
  }

  const recursiveKeys = ['allOf', 'anyOf', 'oneOf', 'dependencies', 'if', 'then', 'else'];
  recursiveKeys.forEach((key) => {
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach((item) => collectSchemaFieldNames(item, out));
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach((item) => collectSchemaFieldNames(item, out));
    }
  });
}

function buildTabPagination(schema: RJSFSchema, uiSchema: NavDrivenUiSchema): TabPagination {
  const fieldsSet = new Set<string>();
  collectSchemaFieldNames(schema, fieldsSet);
  Object.keys(uiSchema)
    .filter((key) => !key.startsWith('ui:') && key !== 'navConf')
    .forEach((key) => fieldsSet.add(key));
  const fields = [...fieldsSet];
  const navConf = uiSchema.navConf ?? {};
  const navLabelByKey = new Map<string, string>();
  (navConf.navs ?? []).forEach((n: { nav: string; name?: string }) => navLabelByKey.set(n.nav, n.name ?? n.nav));

  const fieldsByTab = new Map<string, string[]>();
  const ungrouped: string[] = [];
  fields.forEach((field) => {
    const fieldUi = (uiSchema[field] as Record<string, unknown> | undefined) ?? {};
    const nav = typeof fieldUi.nav === 'string' ? fieldUi.nav : null;
    if (!nav) {
      ungrouped.push(field);
      return;
    }
    const arr = fieldsByTab.get(nav) ?? [];
    arr.push(field);
    fieldsByTab.set(nav, arr);
  });

  const orderedTabs: string[] = [];
  (navConf.order ?? []).forEach((k: string) => {
    if (fieldsByTab.has(k)) orderedTabs.push(k);
  });
  fieldsByTab.forEach((_v, k) => {
    if (!orderedTabs.includes(k)) orderedTabs.push(k);
  });
  if (ungrouped.length) orderedTabs.unshift('__ungrouped__');

  return { schema, uiSchema, fieldsByTab, ungrouped, orderedTabs, navLabelByKey };
}

function buildTabSchemaAndUi(
  pagination: TabPagination | null,
  tab: string | null,
  formData: Record<string, unknown>,
): { schema: RJSFSchema; uiSchema: UiSchema } | null {
  if (!pagination || !tab) return null;
  const activeFields = tab === '__ungrouped__' ? pagination.ungrouped : (pagination.fieldsByTab.get(tab) ?? []);
  const properties = (pagination.schema.properties ?? {}) as Record<string, RJSFSchema>;
  const dependencies =
    ((pagination.schema as Record<string, unknown>).dependencies as Record<string, unknown> | undefined) ?? {};
  const dependencyKeys = Object.keys(dependencies);
  const tabProperties: Record<string, RJSFSchema> = {};
  [...activeFields, ...dependencyKeys].forEach((key) => {
    if (properties[key]) tabProperties[key] = properties[key];
  });
  const tabRequired = ((pagination.schema.required ?? []) as string[]).filter((k) => activeFields.includes(k));
  const tabSchema: RJSFSchema = {
    ...pagination.schema,
    properties: tabProperties,
    required: tabRequired,
    dependencies: filterDependenciesForTab(dependencies, activeFields) as RJSFSchema['dependencies'],
  };
  const tabUi: UiSchema = {};
  const hiddenByDependency = getHiddenFieldsFromDependencies(dependencies, formData);
  activeFields.forEach((k) => {
    const fieldUi = ((pagination.uiSchema[k] as UiSchema | undefined) ?? {}) as Record<string, unknown>;
    if (hiddenByDependency.has(k)) {
      tabUi[k] = {
        ...fieldUi,
        'ui:widget': 'hidden',
      };
      return;
    }
    if (Object.keys(fieldUi).length > 0) tabUi[k] = fieldUi as UiSchema;
  });
  dependencyKeys
    .filter((key) => !activeFields.includes(key))
    .forEach((key) => {
      tabUi[key] = {
        ...(tabUi[key] as UiSchema | undefined),
        'ui:widget': 'hidden',
      };
    });
  return { schema: tabSchema, uiSchema: tabUi };
}

function getHiddenFieldsFromDependencies(
  dependencies: Record<string, unknown>,
  formData: Record<string, unknown>,
): Set<string> {
  const hidden = new Set<string>();

  Object.entries(dependencies).forEach(([depKey, depSchema]) => {
    if (!depSchema || typeof depSchema !== 'object') return;
    const oneOf = (depSchema as Record<string, unknown>).oneOf;
    if (!Array.isArray(oneOf)) return;
    const currentValue = formData[depKey];
    const matched = oneOf.find((candidate): candidate is Record<string, unknown> => {
      if (!candidate || typeof candidate !== 'object') return false;
      const props = (candidate as Record<string, unknown>).properties;
      if (!props || typeof props !== 'object' || Array.isArray(props)) return false;
      const depProp = (props as Record<string, unknown>)[depKey];
      const depConst =
        depProp && typeof depProp === 'object' && !Array.isArray(depProp)
          ? (depProp as Record<string, unknown>).const
          : undefined;
      return depConst === undefined || depConst === currentValue;
    });

    if (!matched) return;
    const props = (matched.properties ?? {}) as Record<string, unknown>;
    Object.entries(props).forEach(([field, value]) => {
      if (value === false) hidden.add(field);
    });
  });

  return hidden;
}

function filterDependenciesForTab(
  dependencies: Record<string, unknown>,
  activeFields: string[],
): Record<string, unknown> {
  const active = new Set(activeFields);

  const pruneNode = (node: unknown, triggerKey: string): unknown => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((item) => pruneNode(item, triggerKey));

    const rec = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(rec)) {
      if (k === 'properties' && v && typeof v === 'object' && !Array.isArray(v)) {
        const props = v as Record<string, unknown>;
        const nextProps: Record<string, unknown> = {};
        for (const [field, fieldSchema] of Object.entries(props)) {
          // Keep trigger field for dependency matching, and fields in current tab for rendering.
          if (field === triggerKey || active.has(field)) {
            nextProps[field] = pruneNode(fieldSchema, triggerKey);
          }
        }
        out[k] = nextProps;
        continue;
      }

      if (v && typeof v === 'object') {
        out[k] = pruneNode(v, triggerKey);
      } else {
        out[k] = v;
      }
    }

    return out;
  };

  const nextDeps: Record<string, unknown> = {};
  for (const [depKey, depSchema] of Object.entries(dependencies)) {
    nextDeps[depKey] = pruneNode(depSchema, depKey);
  }
  return nextDeps;
}

function resolveTabState(
  tabbedByNav: boolean,
  schema: RJSFSchema | undefined,
  uiSchema: UiSchema | undefined,
  activeTab: string | null,
  formData: Record<string, unknown>,
) {
  if (!tabbedByNav || !schema || !uiSchema) {
    return { pagination: null, resolvedTab: null, tabSchemaAndUi: null };
  }
  const pagination = buildTabPagination(schema, (uiSchema ?? {}) as NavDrivenUiSchema);
  const resolvedTab =
    pagination.orderedTabs.length && pagination.orderedTabs.includes(activeTab ?? '')
      ? activeTab
      : (pagination.orderedTabs[0] ?? null);
  return {
    pagination,
    resolvedTab,
    tabSchemaAndUi: buildTabSchemaAndUi(pagination, resolvedTab, formData),
  };
}

export function RjsfStyledForm({ className, tabbedByNav = false, ...props }: RjsfStyledFormProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const schema = props.schema as RJSFSchema | undefined;
  const uiSchema = props.uiSchema as UiSchema | undefined;
  const shouldHideSubmit = resolveSubmitButtonNorender(uiSchema);
  const formData = useMemo(() => (props.formData as Record<string, unknown>) ?? {}, [props.formData]);
  const { pagination, resolvedTab, tabSchemaAndUi } = useMemo(
    () => resolveTabState(tabbedByNav, schema, uiSchema, activeTab, formData),
    [tabbedByNav, schema, uiSchema, activeTab, formData],
  );
  const handleChange = (next: RjsfOnChangeArg) => {
    if (tabSchemaAndUi) {
      const nextEvent = (typeof next === 'object' && next ? next : {}) as Record<string, unknown>;
      const nextData = (nextEvent.formData as Record<string, unknown> | undefined) ?? {};
      const mergedEvent = {
        ...nextEvent,
        formData: {
          ...formData,
          ...nextData,
        },
      } as RjsfOnChangeArg;
      props.onChange?.(mergedEvent);
      return;
    }
    props.onChange?.(next);
  };

  return (
    <div
      onWheelCapture={(e) => {
        if (shouldStopWheelPropagation(e.target)) {
          e.stopPropagation();
        }
      }}
    >
      {pagination && pagination.orderedTabs.length > 1 ? (
        <Tabs value={resolvedTab ?? undefined} onValueChange={setActiveTab} className="mb-3">
          <TabsList variant="line">
            {pagination.orderedTabs.map((tab) => {
              const label = tab === '__ungrouped__' ? '其他' : (pagination.navLabelByKey.get(tab) ?? tab);
              return (
                <TabsTrigger key={tab} value={tab}>
                  {label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      ) : null}
      <Form
        {...props}
        schema={tabSchemaAndUi?.schema ?? props.schema}
        uiSchema={tabSchemaAndUi?.uiSchema ?? props.uiSchema}
        onChange={handleChange}
        widgets={{
          SelectWidget: RjsfPortalSelectWidget,
          ...(props.widgets ?? {}),
        }}
        templates={{
          ...(props.templates ?? {}),
          FieldTemplate: HoverDescriptionFieldTemplate,
          DescriptionFieldTemplate: () => null,
          ...(shouldHideSubmit
            ? {
                ButtonTemplates: {
                  ...(props.templates?.ButtonTemplates ?? {}),
                  SubmitButton: () => null,
                },
              }
            : {}),
        }}
        className={cn(RJSF_BASE_CLASSNAME, className)}
      />
    </div>
  );
}
