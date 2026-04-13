"use client";

import { useCallback, useState } from "react";

import { Page } from "@/components/page";
import { PageFormHeaderActions } from "@/components/page-form-header-actions";

import {
  AGENT_LLM_FORM_ID,
  AgentLlmSettingsCard,
} from "./agent-llm-settings-card";

export default function AgentConfigPage() {
  const [busy, setBusy] = useState({ saving: false, loading: true });
  const onBusyChange = useCallback(
    (next: { saving: boolean; loading: boolean }) => {
      setBusy(next);
    },
    [],
  );

  return (
    <Page
      title="配置"
      action={
        <PageFormHeaderActions
          formId={AGENT_LLM_FORM_ID}
          submitting={busy.saving}
          submitDisabled={busy.loading}
        />
      }
      description={
        <>
          配置因子挖掘智能体使用的 LLM。默认使用本机 Ollama，模型{" "}
          <span className="font-mono text-foreground">qwen3.5:9b</span>
          。设置会写入工作区{" "}
          <span className="font-mono text-foreground">config/agent_llm.json</span>
          ；命令行运行 <span className="font-mono">python -m agent.run</span>{" "}
          时会读取（环境变量仍可覆盖）。
        </>
      }
    >
      <AgentLlmSettingsCard onBusyChange={onBusyChange} />
    </Page>
  );
}
