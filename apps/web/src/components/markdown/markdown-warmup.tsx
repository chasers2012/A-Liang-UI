'use client';

import { IncremarkContent } from '@incremark/react';

const CONTENT = '```json\n{}\n```';

export function MarkdownWarmup() {
  // temporary fix for shiki multiple instance issue
  return <IncremarkContent content={CONTENT} />;
}
