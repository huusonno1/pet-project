const STORES: [RegExp, string][] = [
  [/(^|\.)shopee\./, 'Shopee'],
  [/(^|\.)lazada\./, 'Lazada'],
  [/(^|\.)tiki\.vn$/, 'Tiki'],
  [/(^|\.)tiktok\.com$/, 'TikTok Shop'],
];

/** Tên hiển thị cho link mua hàng, suy từ tên miền. */
export function storeLabel(url: string): string {
  const m = /^https?:\/\/([^/]+)/i.exec(url.trim());
  if (!m) return 'Link';
  const host = m[1].toLowerCase().replace(/^www\./, '');
  return STORES.find(([re]) => re.test(host))?.[1] ?? host;
}
