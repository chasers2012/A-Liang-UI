"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Page } from "@/components/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ApiError,
  getAgentLlmSettings,
  putAgentLlmSettings,
} from "@/lib/quant-agent-api";
import type { AgentLlmProvider, AgentLlmSettingsPublic } from "@/models";

const DEFAULT_LLM: AgentLlmSettingsPublic = {
  provider: "ollama",
  model: "qwen3.5:9b",
  ollama_base_url: "http://127.0.0.1:11434",
  openai_base_url: null,
  api_key: null,
};

export default function AgentPage() {
  const [settings, setSettings] = useState<AgentLlmSettingsPublic>(DEFAULT_LLM);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void getAgentLlmSettings()
      .then((data) => {
        if (!cancelled) {
          setSettings({
            provider: data.provider === "openai" ? "openai" : "ollama",
            model: data.model || DEFAULT_LLM.model,
            ollama_base_url:
              data.ollama_base_url || DEFAULT_LLM.ollama_base_url,
            openai_base_url: data.openai_base_url ?? null,
            api_key: data.api_key ?? null,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaveError(null);
      setSavedOk(false);
      setSaving(true);
      try {
        const body: AgentLlmSettingsPublic = {
          ...settings,
          openai_base_url:
            settings.openai_base_url?.trim() || null,
          api_key: settings.api_key?.trim() || null,
        };
        const next = await putAgentLlmSettings(body);
        setSettings({
          ...next,
          openai_base_url: next.openai_base_url ?? null,
          api_key: next.api_key ?? null,
        });
        setSavedOk(true);
      } catch (err) {
        setSaveError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : String(err),
        );
      } finally {
        setSaving(false);
      }
    },
    [settings],
  );

  const setProvider = useCallback((v: AgentLlmProvider) => {
    setSettings((s) => ({ ...s, provider: v }));
  }, []);

  return (
    <Page>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent</h1>
        <p className="mt-2 text-muted-foreground">
          配置因子挖掘智能体使用的 LLM。默认使用本机 Ollama，模型{" "}
          <span className="font-mono text-foreground">qwen3.5:9b</span>
          。设置会写入工作区{" "}
          <span className="font-mono text-foreground">config/agent_llm.json</span>
          ；命令行运行 <span className="font-mono">python -m agent.run</span>{" "}
          时会读取（环境变量仍可覆盖）。
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>模型与密钥</CardTitle>
          <CardDescription>
            Ollama 无需 API Key；选用 OpenAI 时需填写 Key 或设置环境变量{" "}
            <span className="font-mono">OPENAI_API_KEY</span>。
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {loadError ? (
              <p className="text-sm text-destructive" role="alert">
                加载失败：{loadError}
              </p>
            ) : null}
            {saveError ? (
              <p className="text-sm text-destructive" role="alert">
                保存失败：{saveError}
              </p>
            ) : null}
            {savedOk ? (
              <p className="text-sm text-muted-foreground">已保存。</p>
            ) : null}

            <div className="space-y-2">
              <Label>提供方</Label>
              <Select
                modal={false}
                value={settings.provider}
                disabled={loading}
                onValueChange={(v) => {
                  if (v === "ollama" || v === "openai") setProvider(v);
                }}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ollama">Ollama（本地）</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-llm-model">模型名</Label>
              <Input
                id="agent-llm-model"
                value={settings.model}
                disabled={loading}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, model: e.target.value }))
                }
                placeholder="qwen3.5:9b"
                className="max-w-md font-mono"
              />
            </div>

            {settings.provider === "ollama" ? (
              <div className="space-y-2">
                <Label htmlFor="agent-ollama-url">Ollama 地址</Label>
                <Input
                  id="agent-ollama-url"
                  value={settings.ollama_base_url}
                  disabled={loading}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      ollama_base_url: e.target.value,
                    }))
                  }
                  placeholder="http://127.0.0.1:11434"
                  className="max-w-md font-mono text-sm"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="agent-openai-url">
                    OpenAI API 基址（可选）
                  </Label>
                  <Input
                    id="agent-openai-url"
                    value={settings.openai_base_url ?? ""}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        openai_base_url: e.target.value || null,
                      }))
                    }
                    placeholder="默认 api.openai.com"
                    className="max-w-md font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-api-key">API Key</Label>
                  <Input
                    id="agent-api-key"
                    type="password"
                    autoComplete="off"
                    value={settings.api_key ?? ""}
                    disabled={loading}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        api_key: e.target.value || null,
                      }))
                    }
                    placeholder="sk-..."
                    className="max-w-md font-mono text-sm"
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="submit" disabled={loading || saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </Page>
  );
}
