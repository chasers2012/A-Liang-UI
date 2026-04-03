import { HomeAiChat } from "@/components/home-ai-chat";
import { Page } from "@/components/page";

export default function HomePage() {
  return (
    <Page gap="sm" fillHeight className="max-w-full p-0!">
      <HomeAiChat />
    </Page>
  );
}
