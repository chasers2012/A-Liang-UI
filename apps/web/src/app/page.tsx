import { HomeAiChat } from "@/components/chat/index";
import { Page } from "@/components/page";

export default function HomePage() {
  return (
    <Page gap="sm" fillHeight className="max-w-full p-0!">
      <HomeAiChat />
    </Page>
  );
}
