import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '数据',
};

export default function DataLayout({ children }: { children: React.ReactNode }) {
  return children;
}
