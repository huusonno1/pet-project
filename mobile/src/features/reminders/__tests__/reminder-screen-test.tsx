import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import ReminderConfigScreen from '@/features/reminders/ReminderConfigScreen';
import type { Moment } from '@/lib/api/types';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

const ME = { id: 'u2', email: 'minh@x.vn', displayName: 'Minh', birthday: null, timezone: 'Asia/Ho_Chi_Minh', avatarUrl: null };

function moment(partial: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    type: 'CUSTOM',
    title: 'Mua hoa',
    occursOn: '2027-01-01',
    occursAt: null,
    recurrence: 'NONE',
    personal: false,
    subjectUserId: null,
    message: null,
    details: {},
    reminderConfig: null,
    effectiveReminderConfig: { milestoneDays: null, yearly: null, offsets: ['P1D', 'P0D'], sendAt: '08:00', recipients: 'OWNER' },
    place: null,
    media: [],
    createdBy: 'u1',
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('ReminderConfigScreen', () => {
  beforeEach(() => (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'm1' }));

  test('partner viewer choosing "Mình" saves PARTNER audience', async () => {
    const api = mockApi({
      'GET /api/me': { body: ME },
      'GET /api/moments/m1': { body: moment() },
      'GET /api/moments/m1/reminders': { body: [] },
      'PUT /api/moments/m1/reminder-config': { body: moment() },
    });
    await renderWithProviders(<ReminderConfigScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Mình' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Trước 7 ngày' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const put = api.calls.find((c) => c.method === 'PUT');
    expect(put?.body).toEqual({
      recipients: 'PARTNER',
      offsets: ['P7D', 'P1D', 'P0D'],
      sendAt: '08:00',
      yearly: null,
      milestoneDays: null,
    });
  });

  test('reset sends null', async () => {
    const api = mockApi({
      'GET /api/me': { body: ME },
      'GET /api/moments/m1': { body: moment() },
      'GET /api/moments/m1/reminders': { body: [] },
      'PUT /api/moments/m1/reminder-config': { body: moment() },
    });
    await renderWithProviders(<ReminderConfigScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Khôi phục mặc định' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toBeNull();
  });

  test('partner cannot edit cycle reminders', async () => {
    mockApi({
      'GET /api/me': { body: ME },
      'GET /api/moments/m1': { body: moment({ type: 'CYCLE', subjectUserId: 'u1' }) },
      'GET /api/moments/m1/reminders': { body: [] },
    });
    await renderWithProviders(<ReminderConfigScreen />);

    expect(await screen.findByText('Chỉ người có chu kỳ được chỉnh nhắc nhở này.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull();
  });
});
