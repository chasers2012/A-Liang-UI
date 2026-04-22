'use client';

import { EditablePageDescription } from '@/components/editable-page-description';
import { MarkdownContent } from '@/components/markdown/markdown-content';

export function PreviewDescriptionSection(props: {
  readonly: boolean;
  description: string | null | undefined;
  onDescriptionChange?: (description: string) => void;
}) {
  const { readonly, description, onDescriptionChange } = props;
  if (!readonly) {
    return (
      <EditablePageDescription
        value={description ?? ''}
        onChange={onDescriptionChange ?? (() => {})}
        textareaAriaLabel="节点描述"
      />
    );
  }
  if (!description?.trim()) return null;
  return (
    <MarkdownContent
      content={description.trim()}
      isFinished
      className="text-sm leading-relaxed text-muted-foreground"
    />
  );
}
