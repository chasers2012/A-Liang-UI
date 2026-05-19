import type { UiSchema } from '@rjsf/utils';

const UI_GLOBAL_OPTIONS_KEY = 'ui:globalOptions';

/** 注入 `ui:globalOptions.emptyValue: null`（需配合 RjsfStringField 合并 globalUiOptions）。 */
export function uiSchemaWithNullEmptyValue(uiSchema: UiSchema | undefined): UiSchema {
  const global = (uiSchema?.[UI_GLOBAL_OPTIONS_KEY] as Record<string, unknown> | undefined) ?? {};
  return {
    ...(uiSchema ?? {}),
    [UI_GLOBAL_OPTIONS_KEY]: {
      ...global,
      emptyValue: null,
    },
  };
}
