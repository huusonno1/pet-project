import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { ApiError, apiFetch } from '@/lib/api/client';
import type { MediaDto, UploadUrl } from '@/lib/api/types';

export const MAX_SIDE = 2048;

export type PreparedImage = { uri: string; width: number; height: number };

/** Thu nhỏ để cạnh dài ≤ 2048px và nén JPEG 0.85. */
export async function prepareImage(uri: string): Promise<PreparedImage> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const scale = Math.min(1, MAX_SIDE / Math.max(original.width, original.height));
  const context = ImageManipulator.manipulate(uri);
  if (scale < 1) {
    context.resize({ width: Math.round(original.width * scale), height: Math.round(original.height * scale) });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export type UploadOptions = { purpose?: 'SHARED' | 'AVATAR'; filter?: string | null; takenAt?: string };

/** Xin presigned URL → PUT file thẳng lên MinIO → xác nhận với backend. */
export async function uploadImage(uri: string, opts: UploadOptions = {}): Promise<MediaDto> {
  const image = await prepareImage(uri);
  const file = new File(image.uri);
  const target = await apiFetch<UploadUrl>('/api/media/upload-url', {
    method: 'POST',
    body: {
      contentType: 'image/jpeg',
      sizeBytes: file.size,
      width: image.width,
      height: image.height,
      filter: opts.filter ?? undefined,
      takenAt: opts.takenAt,
      purpose: opts.purpose ?? 'SHARED',
    },
  });
  const res = await expoFetch(target.uploadUrl, { method: 'PUT', headers: target.headers, body: file });
  if (!res.ok) {
    throw new ApiError(res.status, 'UPLOAD_FAILED', 'Tải ảnh lên thất bại, thử lại nhé');
  }
  return apiFetch<MediaDto>(`/api/media/${target.mediaId}/confirm`, { method: 'POST' });
}
