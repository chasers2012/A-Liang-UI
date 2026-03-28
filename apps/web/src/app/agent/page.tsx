"use client";

import { Page } from "@/components/page";
import {
  Card
} from "@/components/ui/card";

export default function AgentPage() {
  return (
    <Page
      title="Agent"
      description="因子挖掘智能体：通过 CLI 或侧栏「配置」与项目中的 Agent 流程配合使用。"
    >
      <div className="flex gap-3 w-full  flex-1">
        <Card className="max-w-xl flex-1">

        </Card>
        <Card className="flex-3">

        </Card>
      </div>

    </Page>
  );
}
