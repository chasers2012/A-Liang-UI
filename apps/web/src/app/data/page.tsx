import type { Metadata } from 'next';

import { Page } from '@/components/page';

import { DataSectionLinks } from './data-section-links';

export const metadata: Metadata = {
  title: '数据',
};

export default function DataSectionPage() {
  return (
    <Page title="数据" description="与侧栏「数据」分组一致：数据源与数据集。" gap="sm">
      <DataSectionLinks />
    </Page>
  );
}
