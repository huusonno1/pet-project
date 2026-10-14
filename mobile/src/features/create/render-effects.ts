import { ImageFormat, matchFont, PaintStyle, Skia, SkCanvas, TileMode } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { blurSigma, bunnyEars, colorMatrix, Composition, hasEdits, heartSpots, sparkleSpots, Spot, stampText } from './effects';

export const HEART_PATH = 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z';
export const SPARKLE_PATH = 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z';

function drawShapes(canvas: SkCanvas, svg: string, spots: Spot[]) {
  for (const s of spots) {
    const path = Skia.Path.MakeFromSVGString(svg);
    if (!path) continue;
    const m = Skia.Matrix();
    m.translate(s.x, s.y);
    m.scale(s.size / 24, s.size / 24);
    path.transform(m);
    const paint = Skia.Paint();
    paint.setColor(Skia.Color('#FFFFFF'));
    paint.setAlphaf(s.opacity);
    paint.setAntiAlias(true);
    canvas.drawPath(path, paint);
  }
}

/** Áp hiệu ứng + trang trí lên ảnh gốc, lưu JPEG vào cache. */
export async function renderComposition(uri: string, c: Composition): Promise<string> {
  if (!hasEdits(c)) return uri;
  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  if (!image) throw new Error('Không đọc được ảnh');
  const w = image.width();
  const h = image.height();
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('Không tạo được bề mặt vẽ');
  const canvas = surface.getCanvas();

  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(colorMatrix(c.effect)));
  const sigma = blurSigma(c.effect) * (Math.max(w, h) / 1000);
  if (sigma > 0) paint.setImageFilter(Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null));
  canvas.drawImage(image, 0, 0, paint);

  if (c.effect === 'HEARTS' || c.hearts) drawShapes(canvas, HEART_PATH, heartSpots(w, h));
  if (c.effect === 'SPARKLE') drawShapes(canvas, SPARKLE_PATH, sparkleSpots(w, h));
  if (c.effect === 'BUNNY') {
    for (const e of bunnyEars(w, h)) {
      const outer = Skia.Paint();
      outer.setColor(Skia.Color('#FFFFFF'));
      canvas.drawOval(Skia.XYWHRect(e.cx - e.rx, e.cy - e.ry, e.rx * 2, e.ry * 2), outer);
      const inner = Skia.Paint();
      inner.setColor(Skia.Color('#F7A8CC'));
      canvas.drawOval(Skia.XYWHRect(e.cx - e.rx * 0.5, e.cy - e.ry * 0.7, e.rx, e.ry * 1.4), inner);
    }
  }
  const family = Platform.select({ ios: 'Helvetica', default: 'sans-serif' });
  if (c.stamp && c.date) {
    const font = matchFont({ fontFamily: family, fontSize: Math.round(h * 0.04), fontWeight: 'bold' });
    const text = stampText(c.date);
    const tw = font.measureText(text).width;
    const x = w - tw - w * 0.08;
    const y = h * 0.1;
    const frame = Skia.Paint();
    frame.setColor(Skia.Color('#FFFFFF'));
    frame.setStyle(PaintStyle.Stroke);
    frame.setStrokeWidth(Math.max(2, h * 0.004));
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - h * 0.015, y - h * 0.045, tw + h * 0.03, h * 0.06), 12, 12), frame);
    const ink = Skia.Paint();
    ink.setColor(Skia.Color('#FFFFFF'));
    canvas.drawText(text, x, y, ink, font);
  }
  if (c.caption.trim()) {
    const font = matchFont({ fontFamily: family, fontSize: Math.round(h * 0.045), fontWeight: 'bold' });
    const text = c.caption.trim();
    const tw = font.measureText(text).width;
    const pad = h * 0.03;
    const boxW = tw + pad * 2;
    const boxH = h * 0.08;
    const bx = (w - boxW) / 2;
    const by = h * 0.8;
    const bg = Skia.Paint();
    bg.setColor(Skia.Color('rgba(0,0,0,0.3)'));
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(bx, by, boxW, boxH), boxH / 2, boxH / 2), bg);
    const ink = Skia.Paint();
    ink.setColor(Skia.Color('#FFFFFF'));
    canvas.drawText(text, bx + pad, by + boxH * 0.68, ink, font);
  }

  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 90);
  const out = new File(Paths.cache, `fx-${Date.now()}.jpg`);
  out.create();
  out.write(bytes);
  return out.uri;
}
