import { DatasourcesPanel } from './datasources-panel';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '数据源',
};

export default function DatasourcesPage({ searchParams }: { searchParams?: { selected?: string | string[] } }) {
  const raw = searchParams?.selected;
  const selectedId = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  return <DatasourcesPanel initialSelectedId={selectedId} />;
}
