import { DatasourcesPanel } from './datasources-panel';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '数据源',
};

export default function DatasourcesPage() {
  return <DatasourcesPanel />;
}
