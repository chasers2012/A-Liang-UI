'use client';

import * as React from 'react';

import { AppTopNav } from '@/components/app-top-nav';
import { NavigationEditGuardDialog } from '@/components/navigation-edit-guard-dialog';
import { NavigationEditGuardProvider } from '@/components/navigation-edit-guard-context';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <NavigationEditGuardProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden">
        <AppTopNav />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">{children}</main>
        <NavigationEditGuardDialog />
      </div>
    </NavigationEditGuardProvider>
  );
}
