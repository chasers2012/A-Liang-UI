"use client";

import { useMemo } from "react";
import MarkdownIt from "markdown-it";

import { cn } from "@/lib/utils";

import "./ai-chat-markdown.css";

function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
  });
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet("href");
    if (href?.startsWith("http://") || href?.startsWith("https://")) {
      if (token.attrIndex("target") < 0) {
        token.attrPush(["target", "_blank"]);
      }
      token.attrPush(["rel", "noopener noreferrer"]);
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };
  return md;
}

const md = createMarkdownIt();

export function AiChatMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const html = useMemo(() => md.render(content), [content]);
  return (
    <div
      className={cn(
        "ai-chat-md wrap-break-word text-sm leading-relaxed",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
