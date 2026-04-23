'use client';

import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditablePageTitle } from '@/components/editable-page-title';
import type { FactorFormState } from '@/models/factor';
import { applyFactorFormPatch } from '../../ui/factor-form-fields';
import { PanelOverviewTab } from './panel-overview-tab';
import { PanelSourceTab } from './panel-source-tab';
import { FactorDetailToolbarButton } from './panel-edit-toolbar-button';

type FactorDetailPanelProps = {
  detailTabValue: string;
  setDetailTabValue: (value: string) => void;
  form: FactorFormState;
  setForm: (next: FactorFormState | ((prev: FactorFormState) => FactorFormState)) => void;
  formError: string | null;
  editing: boolean;
  isCreating: boolean;
  sourceSaving: boolean;
  selectedId: string | null;
  onCancelCreate: () => void;
  onCreate: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

export function FactorDetailPanel({
  detailTabValue,
  setDetailTabValue,
  form,
  setForm,
  formError,
  editing,
  isCreating,
  sourceSaving,
  selectedId,
  onCancelCreate,
  onCreate,
  onCancelEdit,
  onSave,
  onDelete,
  onEdit,
}: FactorDetailPanelProps) {
  return (
    <>
      <CardHeader className="shrink-0 space-y-2">
        <CardTitle className="space-y-2">
          {editing ? (
            <EditablePageTitle
              value={form.name}
              onChange={(name) => {
                setForm((prev) => applyFactorFormPatch(prev, { name }));
              }}
              inputAriaLabel="编辑因子标识 name"
              editButtonAriaLabel="编辑因子标识 name"
              placeholder="（未命名因子）"
            />
          ) : (
            form.name || '因子详情'
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <Tabs value={detailTabValue} onValueChange={setDetailTabValue} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex h-[48px] w-full shrink-0 flex-row items-center justify-between gap-2 border-b px-4 pb-3 pt-0">
            <TabsList className="inline-flex h-9 w-fit flex-wrap items-center gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="source">源码</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <FactorDetailToolbarButton
                editing={editing}
                isCreating={isCreating}
                sourceSaving={sourceSaving}
                selectedId={selectedId}
                onCancelCreate={onCancelCreate}
                onCreate={onCreate}
                onCancelEdit={onCancelEdit}
                onSave={onSave}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            </div>
          </div>
          <div className="h-full max-h-[calc(100vh-10rem)] flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-2">
            <TabsContent value="overview">
              <PanelOverviewTab
                form={form}
                setForm={setForm}
                formError={formError}
                editing={editing}
                selectedId={selectedId}
              />
            </TabsContent>
            <TabsContent value="source">
              <PanelSourceTab
                form={form}
                setForm={setForm}
                formError={formError}
                editing={editing}
                selectedId={selectedId}
              />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </>
  );
}
