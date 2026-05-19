'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import Form from '@rjsf/shadcn';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';

import RjsfStringField from './fields/rjsf-string-field';
import { HoverDescriptionFieldTemplate } from './field-templates/hover-description-field-template';
import { uiSchemaWithNullEmptyValue } from './rjsf-empty-value';
import RjsfProjectBaseInputTemplate from './field-templates/rjsf-project-base-input-template';
import RjsfProjectObjectFieldTemplate from './field-templates/rjsf-project-object-field-template';
import { RjsfPortalSelectWidget } from './widgets/rjsf-portal-select-widget';
import RjsfProjectCheckboxWidget from './widgets/rjsf-project-checkbox-widget';
import RjsfProjectCheckboxesWidget from './widgets/rjsf-project-checkboxes-widget';
import RjsfProjectTextareaWidget from './widgets/rjsf-project-textarea-widget';

type NavConf = { order?: string[]; navs?: Array<{ nav: string; name?: string }> };
type NavDrivenUiSchema = UiSchema & { navConf?: NavConf };

type TabSlot = { kind: 'ungrouped' } | { kind: 'nav'; nav: string };

type TabPagination = {
  schema: RJSFSchema;
  uiSchema: NavDrivenUiSchema;
  fieldsByTab: Map<string, string[]>;
  ungrouped: string[];
  tabSlots: TabSlot[];
  navLabelByKey: Map<string, string>;
};

type RjsfStyledFormProps = ComponentProps<typeof Form> & {
  tabbedByNav?: boolean;
};
type RjsfOnChangeArg = Parameters<NonNullable<RjsfStyledFormProps['onChange']>>[0];
type RjsfFormContext = Record<string, unknown> & { __rjsfProjectReadonly?: boolean };

function applyRootUiSchemaOptions(tabUi: UiSchema, sourceUiSchema: NavDrivenUiSchema): void {
  Object.entries(sourceUiSchema).forEach(([key, value]) => {
    if (key.startsWith('ui:')) {
      tabUi[key] = value as UiSchema[typeof key];
    }
  });
}

function shouldStopWheelPropagation(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      [
        'select',
        'textarea',
        '[data-slot="input"]',
        '[data-slot="textarea"]',
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

  const orderedNavTabs: string[] = [];
  (navConf.order ?? []).forEach((k: string) => {
    if (fieldsByTab.has(k)) orderedNavTabs.push(k);
  });
  fieldsByTab.forEach((_v, k) => {
    if (!orderedNavTabs.includes(k)) orderedNavTabs.push(k);
  });

  const tabSlots: TabSlot[] = [];
  if (ungrouped.length) tabSlots.push({ kind: 'ungrouped' });
  orderedNavTabs.forEach((nav) => tabSlots.push({ kind: 'nav', nav }));

  return { schema, uiSchema, fieldsByTab, ungrouped, tabSlots, navLabelByKey };
}

function buildTabSchemaAndUi(
  pagination: TabPagination | null,
  tab: string | null,
  formData: Record<string, unknown>,
): { schema: RJSFSchema; uiSchema: UiSchema } | null {
  if (!pagination || !tab) return null;
  const slotIndex = Number(tab);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= pagination.tabSlots.length) return null;
  const slot = pagination.tabSlots[slotIndex];
  const activeFields = slot.kind === 'ungrouped' ? pagination.ungrouped : (pagination.fieldsByTab.get(slot.nav) ?? []);
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

  applyRootUiSchemaOptions(tabUi, pagination.uiSchema);

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
  const tabValueOptions = pagination.tabSlots.map((_, i) => String(i));
  const resolvedTab =
    pagination.tabSlots.length && activeTab !== null && tabValueOptions.includes(activeTab)
      ? activeTab
      : pagination.tabSlots.length
        ? '0'
        : null;
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
  const formReadonly = Boolean(props.readonly);
  const mergedFormContext = useMemo<RjsfFormContext>(
    () => ({
      ...((props.formContext as Record<string, unknown> | undefined) ?? {}),
      __rjsfProjectReadonly: formReadonly,
    }),
    [props.formContext, formReadonly],
  );
  const formData = useMemo(() => (props.formData as Record<string, unknown>) ?? {}, [props.formData]);
  const baseUiSchema = useMemo(() => uiSchemaWithNullEmptyValue(uiSchema), [uiSchema]);
  const { pagination, resolvedTab, tabSchemaAndUi } = useMemo(
    () => resolveTabState(tabbedByNav, schema, baseUiSchema, activeTab, formData),
    [tabbedByNav, schema, baseUiSchema, activeTab, formData],
  );
  const resolvedFormUiSchema = tabSchemaAndUi?.uiSchema ?? baseUiSchema;
  const handleChange = (next: RjsfOnChangeArg) => {
    if (formReadonly) return;
    if (tabSchemaAndUi) {
      const nextEvent = (typeof next === 'object' && next ? next : {}) as Record<string, unknown>;
      const nextData = (nextEvent.formData as Record<string, unknown> | undefined) ?? {};
      props.onChange?.({
        ...nextEvent,
        formData: {
          ...formData,
          ...nextData,
        },
      } as RjsfOnChangeArg);
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
      {pagination && pagination.tabSlots.length > 1 ? (
        <Tabs value={resolvedTab ?? undefined} onValueChange={setActiveTab} className="mb-3">
          <TabsList variant="line">
            {pagination.tabSlots.map((slot, index) => {
              const value = String(index);
              const label = slot.kind === 'ungrouped' ? '其他' : (pagination.navLabelByKey.get(slot.nav) ?? slot.nav);
              return (
                <TabsTrigger key={value} value={value}>
                  {label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      ) : null}
      <Form
        {...props}
        readonly={formReadonly}
        formContext={mergedFormContext}
        schema={tabSchemaAndUi?.schema ?? props.schema}
        uiSchema={resolvedFormUiSchema}
        onChange={handleChange}
        fields={{
          ...(props.fields ?? {}),
          StringField: RjsfStringField,
        }}
        widgets={{
          SelectWidget: RjsfPortalSelectWidget,
          TextareaWidget: RjsfProjectTextareaWidget,
          CheckboxWidget: RjsfProjectCheckboxWidget,
          CheckboxesWidget: RjsfProjectCheckboxesWidget,
          ...(props.widgets ?? {}),
        }}
        templates={{
          ...(props.templates ?? {}),
          BaseInputTemplate: RjsfProjectBaseInputTemplate,
          FieldTemplate: HoverDescriptionFieldTemplate,
          ObjectFieldTemplate: RjsfProjectObjectFieldTemplate,
          DescriptionFieldTemplate: () => null,
        }}
        className={className}
      />
    </div>
  );
}
