import { DataSetsPanel } from './data-sets-panel';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '数据集',
};

export default function DataSetsPage() {
  return <DataSetsPanel />;
}
