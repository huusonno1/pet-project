import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import TraitsScreen from '@/features/traits/TraitsScreen';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

const CATALOG = {
  sizeKinds: [
    { code: 'SHIRT', label: 'Áo' },
    { code: 'SHOE', label: 'Giày' },
  ],
  preferenceCategories: [{ code: 'BAG', label: 'Túi' }],
};

function routes(overrides: Record<string, unknown> = {}) {
  return {
    'GET /api/me': { body: { id: 'u1', email: '', displayName: 'Lan', birthday: null, timezone: '', avatarUrl: null } },
    'GET /api/couples/me': { body: { id: 'c1', startedDatingOn: null, createdAt: '', partner: { id: 'u2', displayName: 'Minh' } } },
    'GET /api/traits/catalog': { body: CATALOG },
    'GET /api/traits/u2': {
      body: {
        sizes: [
          { id: 's1', subjectUserId: 'u2', kind: 'SHIRT', value: 'L', note: 'form rộng', visibility: 'SHARED', createdBy: 'u2', updatedAt: '' },
        ],
        preferences: [
          {
            id: 'p1',
            subjectUserId: 'u2',
            category: 'BAG',
            brand: 'Charles & Keith',
            name: null,
            color: 'Đen',
            note: null,
            visibility: 'AUTHOR_ONLY',
            createdBy: 'u1',
            updatedAt: '',
            links: [{ id: 'k1', url: 'https://shopee.vn/abc', label: 'Shopee', price: 1290000 }],
          },
        ],
      },
    },
    'POST /api/traits/sizes': { status: 201, body: {} },
    ...overrides,
  };
}

describe('TraitsScreen', () => {
  test('shows partner sizes, secret preferences and opens shopping links', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockApi(routes());
    await renderWithProviders(<TraitsScreen />);

    expect(await screen.findByText('Áo: L')).toBeOnTheScreen();
    expect(screen.getByText('🔒 Bí mật')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Mở Shopee' }));
    expect(open).toHaveBeenCalledWith('https://shopee.vn/abc');
  });

  test('adds a secret size for the partner', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<TraitsScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: '+ Thêm size' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Giày' }));
    await fireEvent.changeText(screen.getByLabelText('Size'), '42');
    await fireEvent(screen.getByRole('switch', { name: 'Giữ bí mật (chỉ mình tôi thấy)' }), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu size' }));

    await waitFor(() => expect(api.calls.some((c) => c.method === 'POST')).toBe(true));
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      subjectUserId: 'u2',
      kind: 'SHOE',
      value: '42',
      note: '',
      visibility: 'AUTHOR_ONLY',
    });
  });
});
