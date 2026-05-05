'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import Form from '@rjsf/shadcn';
import type { FieldTemplateProps, RJSFSchema, UiSchema } from '@rjsf/utils';
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

function resolveSubmitButtonNorender(uiSchema: UiSchema | undefined): boolean {
  const opts = (uiSchema as Record<string, unknown> | undefined)?.['ui:submitButtonOptions'] as
    | SubmitButtonOptions
    | undefined;
  return Boolean(opts?.norender);
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

  if (hidden) return <div className="hidden">{children}</div>;

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
  (navConf.navs ?? []).forEach((n) => navLabelByKey.set(n.nav, n.name ?? n.nav));

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
  (navConf.order ?? []).forEach((k) => {
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
): { schema: RJSFSchema; uiSchema: UiSchema } | null {
  if (!pagination || !tab) return null;
  const activeFields = tab === '__ungrouped__' ? pagination.ungrouped : (pagination.fieldsByTab.get(tab) ?? []);
  const properties = (pagination.schema.properties ?? {}) as Record<string, RJSFSchema>;
  const tabProperties: Record<string, RJSFSchema> = {};
  const tabRequired = ((pagination.schema.required ?? []) as string[]).filter((k) => activeFields.includes(k));
  activeFields.forEach((k) => {
    if (properties[k]) tabProperties[k] = properties[k];
  });
  const dependencyKeys = Object.keys(
    ((pagination.schema as Record<string, unknown>).dependencies as Record<string, unknown> | undefined) ?? {},
  );
  dependencyKeys.forEach((key) => {
    if (!tabProperties[key] && properties[key]) {
      tabProperties[key] = properties[key];
    }
  });
  const tabSchema: RJSFSchema = {
    ...pagination.schema,
    properties: tabProperties,
    required: tabRequired,
  };
  const tabUi: UiSchema = {};
  activeFields.forEach((k) => {
    const fieldUi = pagination.uiSchema[k] as UiSchema | undefined;
    if (fieldUi) tabUi[k] = fieldUi;
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

function resolveTabState(
  tabbedByNav: boolean,
  schema: RJSFSchema | undefined,
  uiSchema: UiSchema | undefined,
  activeTab: string | null,
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
    tabSchemaAndUi: buildTabSchemaAndUi(pagination, resolvedTab),
  };
}

export function RjsfStyledForm({ className, tabbedByNav = false, ...props }: RjsfStyledFormProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const schema = props.schema as RJSFSchema | undefined;
  const uiSchema = props.uiSchema as UiSchema | undefined;
  const shouldHideSubmit = resolveSubmitButtonNorender(uiSchema);
  const { pagination, resolvedTab, tabSchemaAndUi } = useMemo(
    () => resolveTabState(tabbedByNav, schema, uiSchema, activeTab),
    [tabbedByNav, schema, uiSchema, activeTab],
  );
  const formData = (props.formData as Record<string, unknown>) ?? {};
  const handleChange = (next: RjsfOnChangeArg) => {
    if (tabSchemaAndUi) {
      const nextData = (next.formData as Record<string, unknown>) ?? {};
      const mergedEvent = {
        ...next,
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
