import type { Metadata } from 'next';
import FactorsLibraryBrowsePage from './ui/factors-library-browse-page';

export const metadata: Metadata = {
  title: '因子库',
};

export default function FactorsPage() {
  return <FactorsLibraryBrowsePage />;
}
