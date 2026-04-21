import { FactorSectionContent } from './factor-section-content';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '因子',
};

export default function FactorOverviewPage() {
  return <FactorSectionContent />;
}
