import type { Metadata } from 'next';

import { DataSetsPage } from './components/data-sets-page';

export const metadata: Metadata = {
  title: '数据集',
};

export default function DataSetsRoutePage() {
  return <DataSetsPage />;
}
