import type { Metadata } from 'next';

import { DataSyncPage } from './data-sync-page';

export const metadata: Metadata = {
  title: '数据同步',
};

export default function DataSyncRoutePage() {
  return <DataSyncPage />;
}
