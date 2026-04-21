import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '任务',
};

export default function SchedulerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
