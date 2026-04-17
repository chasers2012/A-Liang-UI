import type { UploadFileResponse } from '@/models/datasource/dto';

import { ApiError, getQuantAgentApiBase, parseDetail } from './client';

export async function uploadFile(file: File): Promise<UploadFileResponse> {
  const url = `${getQuantAgentApiBase()}/uploads/file`;
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(parseDetail(text), res.status);
  }
  return res.json() as Promise<UploadFileResponse>;
}
