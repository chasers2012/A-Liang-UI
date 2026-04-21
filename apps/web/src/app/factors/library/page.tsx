import { FactorsPanel } from './factors-panel';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '因子库',
};

export default function FactorsPage() {
  return <FactorsPanel />;
}
