/** URL presigned đổi chữ ký mỗi lần refetch; bỏ query string để expo-image cache theo object key cố định. */
export function imageCacheKey(uri: string): string {
  return uri.split('?')[0];
}
