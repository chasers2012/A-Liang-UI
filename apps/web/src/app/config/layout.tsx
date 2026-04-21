import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '配置',
};

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return children;
}
