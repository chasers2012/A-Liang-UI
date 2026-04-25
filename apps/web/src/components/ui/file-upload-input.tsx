'use client';

import type { ChangeEvent } from 'react';
import { useRef, useState } from 'react';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type UploadStatusView = {
  Icon: typeof Loader2 | typeof AlertCircle | typeof CheckCircle2 | null;
  className: string;
};

type FileUploadInputProps = {
  id: string;
  value?: string | null;
  required?: boolean;
  accept?: string;
  disabled?: boolean;
  emptyText?: string;
  chooseButtonText?: string;
  uploadingText?: string;
  className?: string;
  onUpload: (file: File) => Promise<string>;
  onUploadError?: (err: unknown) => string;
  onUploaded?: (value: string) => void;
};

function resolveUploadStatusView(uploading: boolean, uploadError: string | null, showName: string): UploadStatusView {
  if (uploading) {
    return {
      Icon: Loader2,
      className: 'size-4 shrink-0 animate-spin text-muted-foreground',
    };
  }
  if (uploadError) {
    return {
      Icon: AlertCircle,
      className: 'size-4 shrink-0 text-destructive',
    };
  }
  if (showName) {
    return {
      Icon: CheckCircle2,
      className: 'size-4 shrink-0 text-emerald-600',
    };
  }
  return {
    Icon: null,
    className: 'size-4 shrink-0',
  };
}

function getDefaultErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return '文件上传失败';
}

function resolveUploadedName(value?: string | null): string {
  if (typeof value !== 'string') return '';
  return value ? (value.split('/').pop() ?? value) : '';
}

function buildFileChangeHandler({
  onUpload,
  onUploaded,
  onUploadError,
  setPickedName,
  setUploadError,
  setUploading,
}: {
  onUpload: (file: File) => Promise<string>;
  onUploaded?: (value: string) => void;
  onUploadError?: (err: unknown) => string;
  setPickedName: (name: string) => void;
  setUploadError: (message: string | null) => void;
  setUploading: (uploading: boolean) => void;
}) {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;

    setPickedName(picked.name);
    setUploadError(null);
    setUploading(true);

    void onUpload(picked)
      .then((nextValue) => {
        onUploaded?.(nextValue);
      })
      .catch((err: unknown) => {
        const message = onUploadError?.(err) ?? getDefaultErrorMessage(err);
        setUploadError(message);
      })
      .finally(() => {
        setUploading(false);
      });
  };
}

export function FileUploadInput({
  id,
  value,
  required,
  accept,
  disabled = false,
  emptyText = '未选择文件',
  chooseButtonText = '选择文件',
  uploadingText = '上传中...',
  className,
  onUpload,
  onUploadError,
  onUploaded,
}: FileUploadInputProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const uploadedName = resolveUploadedName(value);
  const showName = uploading ? pickedName : pickedName || uploadedName;
  const { Icon: StatusIcon, className: statusClassName } = resolveUploadStatusView(uploading, uploadError, showName);
  const handleFileChange = buildFileChangeHandler({
    onUpload,
    onUploaded,
    onUploadError,
    setPickedName,
    setUploadError,
    setUploading,
  });

  return (
    <div className={className}>
      <Input
        ref={inputRef}
        id={id}
        required={required}
        type="file"
        accept={accept || undefined}
        disabled={disabled || uploading}
        className="sr-only"
        onChange={handleFileChange}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? uploadingText : chooseButtonText}
        </Button>
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          {StatusIcon && <StatusIcon className={statusClassName} aria-hidden="true" />}
          <span className="min-w-0 truncate" role="status" aria-live="polite">
            {showName || emptyText}
          </span>
        </span>
      </div>
      {uploadError && (
        <p className="text-xs text-destructive" role="alert">
          {uploadError}
        </p>
      )}
    </div>
  );
}
