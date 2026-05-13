'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type PanelDetailCardTabPanelItem = {
  value: string;
  label: ReactNode;
  content: ReactNode;
  contentClassName?: string;
  /** 为 true 时该 tab 不可切换（仍会随 value 显示对应内容） */
  disabled?: boolean;
};

export type PanelDetailCardProps = Omit<ComponentProps<typeof Card>, 'title' | 'children'> & {
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  panels?: readonly PanelDetailCardTabPanelItem[];
  /** When both are set, tab selection is controlled by the parent (otherwise internal state). */
  panelActiveTab?: string;
  onPanelActiveTabChange?: (value: string) => void;
};

function usePanelDetailCardActiveTabValue(
  panels: readonly PanelDetailCardTabPanelItem[] | undefined,
  panelActiveTab: string | undefined,
  onPanelActiveTabChange: ((value: string) => void) | undefined,
) {
  const firstPanelValue = panels?.[0]?.value;
  const [internalTab, setInternalTab] = useState<string | undefined>(undefined);

  const controlled = panelActiveTab !== undefined && onPanelActiveTabChange !== undefined;

  const activePanelValue = (() => {
    if (!panels || panels.length === 0) return '';
    if (controlled) {
      return panels.some((p) => p.value === panelActiveTab) ? panelActiveTab : (firstPanelValue ?? '');
    }
    if (internalTab && panels.some((p) => p.value === internalTab)) return internalTab;
    return firstPanelValue ?? '';
  })();

  const setSelectedPanelValue = controlled ? onPanelActiveTabChange : setInternalTab;

  return { activePanelValue, setSelectedPanelValue };
}

type PanelDetailCardMainRegionProps = {
  panels: readonly PanelDetailCardTabPanelItem[] | undefined;
  activePanelValue?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

function PanelDetailCardMainRegion({ panels, activePanelValue, actions, children }: PanelDetailCardMainRegionProps) {
  const hasPanels = panels != null && panels.length > 0;

  const activePanel = useMemo(() => {
    if (!hasPanels) return null;
    const active = activePanelValue == null ? null : String(activePanelValue);
    return panels!.find((p) => p.value === active) ?? panels![0] ?? null;
  }, [activePanelValue, hasPanels, panels]);

  return (
    <>
      <div
        className={'flex w-full shrink-0 flex-row items-center justify-between gap-2 h-[48px] border-b px-4 pb-3 pt-0'}
      >
        <div
          className={cn('flex min-h-9 min-w-0 items-center', {
            'flex-wrap gap-2': hasPanels,
          })}
        >
          {hasPanels ? (
            <TabsList className="inline-flex h-9 w-fit flex-wrap items-center gap-1 rounded-lg bg-muted/80 p-1 text-muted-foreground">
              {panels!.map((p) => (
                <TabsTrigger key={p.value} value={p.value} disabled={p.disabled}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions ?? null}</div>
      </div>
      <div className={'flex min-h-0 flex-1 flex-col overflow-hidden h-full px-6 pb-0 pt-4'}>
        {children}
        {hasPanels && activePanel ? (
          <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden space-y-6', activePanel.contentClassName)}>
            {activePanel.content}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function PanelDetailCard({
  className,
  title,
  children,
  actions,
  panels,
  panelActiveTab,
  onPanelActiveTabChange,
  ...cardProps
}: PanelDetailCardProps) {
  const { activePanelValue, setSelectedPanelValue } = usePanelDetailCardActiveTabValue(
    panels,
    panelActiveTab,
    onPanelActiveTabChange,
  );

  const mainContent = (
    <PanelDetailCardMainRegion panels={panels} activePanelValue={activePanelValue} actions={actions}>
      {children}
    </PanelDetailCardMainRegion>
  );

  return (
    <Card className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', className)} {...cardProps}>
      <CardHeader className="shrink-0 space-y-2">
        <CardTitle className="space-y-2">{title || ''}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {panels && panels.length > 0 ? (
          <Tabs
            className="flex min-h-0 flex-1 flex-col gap-0"
            defaultValue={panels[0].value}
            value={activePanelValue}
            onValueChange={(v) => setSelectedPanelValue(v)}
          >
            {mainContent}
          </Tabs>
        ) : (
          mainContent
        )}
      </CardContent>
    </Card>
  );
}
