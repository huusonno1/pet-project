import { uploadImage } from '@/features/media/upload';

import type { Capture } from './capture-store';
import { renderComposition } from './render-effects';

/** Áp hiệu ứng rồi tải lần lượt từng ảnh; một ảnh lỗi → cả lô lỗi để không tạo kỷ niệm thiếu ảnh. */
export async function uploadCapture(capture: Capture): Promise<string[]> {
  const ids: string[] = [];
  for (const uri of capture.uris) {
    const rendered = await renderComposition(uri, capture);
    const media = await uploadImage(rendered, { purpose: 'SHARED', filter: capture.effect });
    ids.push(media.id);
  }
  return ids;
}
