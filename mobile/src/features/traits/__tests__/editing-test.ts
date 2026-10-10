import { canEdit, catalogLabel, linksFromDrafts } from '@/features/traits/editing';

describe('traits editing helpers', () => {
  test('canEdit: creator always, subject only for shared items', () => {
    expect(canEdit({ createdBy: 'u1', subjectUserId: 'u2', visibility: 'AUTHOR_ONLY' }, 'u1')).toBe(true);
    expect(canEdit({ createdBy: 'u1', subjectUserId: 'u2', visibility: 'SHARED' }, 'u2')).toBe(true);
    expect(canEdit({ createdBy: 'u1', subjectUserId: 'u2', visibility: 'AUTHOR_ONLY' }, 'u2')).toBe(false);
  });

  test('linksFromDrafts skips blank rows, parses VND prices and validates urls', () => {
    expect(
      linksFromDrafts([
        { url: 'https://shopee.vn/abc', label: 'Shopee', price: '1.290.000' },
        { url: '  ', label: '', price: '' },
        { url: 'https://tiki.vn/x', label: '', price: '' },
      ]),
    ).toEqual({
      links: [{ url: 'https://shopee.vn/abc', label: 'Shopee', price: 1290000 }, { url: 'https://tiki.vn/x' }],
      error: null,
    });
    expect(linksFromDrafts([{ url: 'shopee.vn/abc', label: '', price: '' }]).error).toBe(
      'Link phải bắt đầu bằng http:// hoặc https://',
    );
  });

  test('catalogLabel falls back to code', () => {
    expect(catalogLabel([{ code: 'SHOE', label: 'Giày' }], 'SHOE')).toBe('Giày');
    expect(catalogLabel([], 'HAT')).toBe('HAT');
  });
});
