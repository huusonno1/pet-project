import { fetch as expoFetch } from 'expo/fetch';
import { ImageManipulator } from 'expo-image-manipulator';

import { prepareImage, uploadImage } from '@/features/media/upload';
import { ApiError } from '@/lib/api/client';
import { mockApi, rejectionOf } from '@/test/api-mock';

jest.mock('expo/fetch', () => ({ fetch: jest.fn(async () => ({ ok: true, status: 200 })) }));
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ uri, size: 123456 })),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

type Ctx = { resize: jest.Mock; renderAsync: jest.Mock };

/** Lần manipulate đầu trả kích thước gốc; lần sau trả ảnh đã xử lý. */
function setupManipulator(original: { width: number; height: number }, saved: { width: number; height: number }) {
  const contexts: Ctx[] = [];
  (ImageManipulator.manipulate as jest.Mock).mockImplementation(() => {
    const first = contexts.length === 0;
    const ctx: Ctx = {
      resize: jest.fn().mockReturnThis(),
      renderAsync: jest.fn(async () =>
        first
          ? { ...original, saveAsync: jest.fn() }
          : { ...saved, saveAsync: jest.fn(async () => ({ uri: 'file:///cache/out.jpg', ...saved })) },
      ),
    };
    contexts.push(ctx);
    return ctx;
  });
  return contexts;
}

const MEDIA = { id: 'p1', url: 'http://minio/p1.jpg', width: 2048, height: 1536, filter: 'WARM', takenAt: null };

describe('media upload', () => {
  test('downscalesLargeImages', async () => {
    const contexts = setupManipulator({ width: 4000, height: 3000 }, { width: 2048, height: 1536 });

    const result = await prepareImage('file:///camera/big.jpg');

    expect(contexts[1].resize).toHaveBeenCalledWith({ width: 2048, height: 1536 });
    expect(result).toEqual({ uri: 'file:///cache/out.jpg', width: 2048, height: 1536 });
  });

  test('keeps small images at original size', async () => {
    const contexts = setupManipulator({ width: 800, height: 600 }, { width: 800, height: 600 });
    await prepareImage('file:///small.jpg');
    expect(contexts[1].resize).not.toHaveBeenCalled();
  });

  test('requests presigned url, uploads the file and confirms', async () => {
    setupManipulator({ width: 4000, height: 3000 }, { width: 2048, height: 1536 });
    const api = mockApi({
      'POST /api/media/upload-url': {
        status: 201,
        body: { mediaId: 'p1', uploadUrl: 'http://minio/put', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, expiresAt: '' },
      },
      'POST /api/media/p1/confirm': { body: MEDIA },
    });

    const media = await uploadImage('file:///camera/big.jpg', { filter: 'WARM' });

    expect(media).toEqual(MEDIA);
    expect(api.calls[0].body).toEqual({
      contentType: 'image/jpeg',
      sizeBytes: 123456,
      width: 2048,
      height: 1536,
      filter: 'WARM',
      purpose: 'SHARED',
    });
    expect(expoFetch).toHaveBeenCalledWith('http://minio/put', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: { uri: 'file:///cache/out.jpg', size: 123456 },
    });
  });

  test('failed upload does not confirm', async () => {
    setupManipulator({ width: 800, height: 600 }, { width: 800, height: 600 });
    (expoFetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403 });
    const api = mockApi({
      'POST /api/media/upload-url': {
        status: 201,
        body: { mediaId: 'p1', uploadUrl: 'http://minio/put', method: 'PUT', headers: {}, expiresAt: '' },
      },
    });

    const error = await rejectionOf(uploadImage('file:///small.jpg'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('UPLOAD_FAILED');
    expect(api.calls.some((c) => c.path.endsWith('/confirm'))).toBe(false);
  });
});
