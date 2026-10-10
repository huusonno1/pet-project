import { fireEvent, screen } from '@testing-library/react-native';

import PairScreen from '@/features/couple/PairScreen';
import { keys } from '@/lib/query';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

const COUPLE = {
  id: 'c1',
  startedDatingOn: '2025-02-14',
  createdAt: '2026-10-10T00:00:00Z',
  partner: { id: 'u2', displayName: 'Minh' },
};

const NOT_PAIRED = { status: 409, body: { code: 'COUPLE_REQUIRED', detail: 'Bạn chưa ghép đôi' } };

describe('PairScreen', () => {
  test('creates an invite and shows code with expiry time', async () => {
    const expiresAt = new Date(2026, 9, 10, 21, 15).toISOString();
    mockApi({
      'GET /api/couples/me': NOT_PAIRED,
      'POST /api/couples/invites': { status: 201, body: { code: 'ABCD2345', expiresAt } },
    });
    await renderWithProviders(<PairScreen />, { withSession: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Tạo mã mời' }));

    expect(await screen.findByText('ABCD2345')).toBeOnTheScreen();
    expect(screen.getByText('Hết hạn lúc 21:15')).toBeOnTheScreen();
  });

  test('joins with normalized code and start date', async () => {
    const api = mockApi({
      'GET /api/couples/me': NOT_PAIRED,
      'POST /api/couples/join': { status: 201, body: COUPLE },
    });
    const { client } = await renderWithProviders(<PairScreen />, { withSession: true });

    await fireEvent.changeText(screen.getByLabelText('Mã mời của người ấy'), ' abcd2345 ');
    await fireEvent.press(screen.getByRole('button', { name: 'Ngày bắt đầu yêu (không bắt buộc)' }));
    await fireEvent(screen.getByTestId('datetimepicker'), 'valueChange', {}, new Date(2025, 1, 14));
    await fireEvent.press(screen.getByRole('button', { name: 'Ghép đôi' }));

    await screen.findByText('Ghép đôi thành công 💞');
    const join = api.calls.find((c) => c.path === '/api/couples/join');
    expect(join?.body).toEqual({ code: 'ABCD2345', startedDatingOn: '2025-02-14' });
    expect(client.getQueryData(keys.couple)).toEqual(COUPLE);
  });

  test('shows server error when code is invalid', async () => {
    mockApi({
      'GET /api/couples/me': NOT_PAIRED,
      'POST /api/couples/join': {
        status: 400,
        body: { code: 'INVITE_INVALID', detail: 'Mã mời không đúng hoặc đã hết hạn' },
      },
    });
    await renderWithProviders(<PairScreen />, { withSession: true });

    await fireEvent.changeText(screen.getByLabelText('Mã mời của người ấy'), 'ZZZZZZZZ');
    await fireEvent.press(screen.getByRole('button', { name: 'Ghép đôi' }));

    expect(await screen.findByText('Mã mời không đúng hoặc đã hết hạn')).toBeOnTheScreen();
  });

  test('requires a code before calling api', async () => {
    const api = mockApi({ 'GET /api/couples/me': NOT_PAIRED });
    await renderWithProviders(<PairScreen />, { withSession: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Ghép đôi' }));

    expect(screen.getByText('Nhập mã mời')).toBeOnTheScreen();
    expect(api.calls.filter((c) => c.path === '/api/couples/join')).toHaveLength(0);
  });
});
