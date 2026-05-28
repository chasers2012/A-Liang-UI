import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '工具',
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
