import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '回测',
};

export default function BacktestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
