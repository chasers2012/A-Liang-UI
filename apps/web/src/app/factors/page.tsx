import type { Metadata } from 'next';
import FactorsBrowsePage from './ui/factors-browse-page';

export const metadata: Metadata = {
  title: '因子库',
};

export default function FactorsPage() {
  return <FactorsBrowsePage />;
}
