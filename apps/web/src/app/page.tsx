import { HomeAiChat } from '@/components/chat/index';
import type { Metadata } from 'next';
import { Page } from '@/components/page';

export const metadata: Metadata = {
  title: '对话',
};

export default function HomePage() {
  return (
    <Page size="full" gap="none" className="p-0! overflow-hidden w-full h-full">
      <HomeAiChat />
    </Page>
  );
}
