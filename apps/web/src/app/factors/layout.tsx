import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '因子',
};

export default function FactorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
