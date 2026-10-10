import type { CatalogItem, Visibility } from '@/lib/api/types';

/** Khớp quy tắc backend: người tạo luôn sửa được; chủ thể sửa được mục SHARED. */
export function canEdit(item: { createdBy: string; subjectUserId: string; visibility: Visibility }, meId: string) {
  return item.createdBy === meId || (item.visibility === 'SHARED' && item.subjectUserId === meId);
}

export type LinkDraft = { url: string; label: string; price: string };
export type LinkInput = { url: string; label?: string; price?: number };

export function linksFromDrafts(drafts: LinkDraft[]): { links: LinkInput[]; error: string | null } {
  const links: LinkInput[] = [];
  for (const d of drafts) {
    const url = d.url.trim();
    if (!url) continue;
    if (!/^https?:\/\/\S{3,}$/.test(url)) {
      return { links: [], error: 'Link phải bắt đầu bằng http:// hoặc https://' };
    }
    const link: LinkInput = { url };
    if (d.label.trim()) link.label = d.label.trim();
    const digits = d.price.replace(/\D/g, '');
    if (digits) link.price = Number(digits);
    links.push(link);
  }
  return { links, error: null };
}

export function catalogLabel(items: CatalogItem[], code: string): string {
  return items.find((i) => i.code === code)?.label ?? code;
}
