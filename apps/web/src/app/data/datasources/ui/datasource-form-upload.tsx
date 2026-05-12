'use client';

import { ApiError } from '@/api/client';
import { uploadFile } from '@/api/upload';

import { FileUploadInput } from '@/components/ui/file-upload-input';

function toUploadErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return '文件上传失败';
}

export function UploadPathWidget(props: {
  id: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  value?: unknown;
  options?: Record<string, unknown>;
  onChange: (value: string) => void;
}) {
  const id = props.id;
  const required = Boolean(props.required);
  const disabled = Boolean(props.disabled || props.readonly);
  const accept = typeof props.options?.accept === 'string' ? props.options.accept : '';
  const value = typeof props.value === 'string' ? props.value : null;

  return (
    <FileUploadInput
      id={id}
      value={value}
      required={required}
      disabled={disabled}
      accept={accept || undefined}
      className="grid gap-2"
      onUpload={(picked) => uploadFile(picked).then((resp) => resp.path)}
      onUploadError={toUploadErrorMessage}
      onUploaded={(path) => props.onChange(path)}
    />
  );
}
