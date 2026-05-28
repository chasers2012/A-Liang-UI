import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '知识库',
};

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
