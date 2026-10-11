import { ImageFormat, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { PEN_WIDTH, Stroke, strokeToPath } from './drawing';

const OUT = 600;

/** Vẽ lại các nét lên nền trắng 600×600 và lưu PNG vào cache. */
export async function exportDrawing(strokes: Stroke[], size: number): Promise<string> {
  const surface = Skia.Surface.MakeOffscreen(OUT, OUT);
  if (!surface) throw new Error('Không tạo được bề mặt vẽ');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('#FFFFFF'));
  const scale = OUT / size;
  for (const s of strokes) {
    const path = Skia.Path.MakeFromSVGString(strokeToPath(s.points));
    if (!path) continue;
    const m = Skia.Matrix();
    m.scale(scale, scale);
    path.transform(m);
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(s.color));
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(PEN_WIDTH * scale);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeJoin(StrokeJoin.Round);
    paint.setAntiAlias(true);
    canvas.drawPath(path, paint);
  }
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.PNG, 100);
  const out = new File(Paths.cache, `drawing-${Date.now()}.png`);
  out.create();
  out.write(bytes);
  return out.uri;
}
