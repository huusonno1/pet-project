import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { FilterId, matrixOf } from './filters';

/** Vẽ ảnh qua ma trận màu trên surface offscreen, lưu JPEG vào cache, trả về URI mới. */
export async function applyFilter(uri: string, filter: FilterId): Promise<string> {
  if (filter === 'ORIGINAL') return uri;
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Không đọc được ảnh');
  const surface = Skia.Surface.MakeOffscreen(image.width(), image.height());
  if (!surface) throw new Error('Không tạo được bề mặt vẽ');
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrixOf(filter)));
  surface.getCanvas().drawImage(image, 0, 0, paint);
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 90);
  const out = new File(Paths.cache, `filtered-${Date.now()}.jpg`);
  out.create();
  out.write(bytes);
  return out.uri;
}
