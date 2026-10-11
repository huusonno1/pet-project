import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import MomentDetailScreen from '@/features/moments/MomentDetailScreen';
import { MomentFormScreen } from '@/features/moments/MomentFormScreen';
import MomentsScreen from '@/features/moments/MomentsScreen';
import type { Moment } from '@/lib/api/types';
import { toIsoDate } from '@/lib/format';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

function moment(partial: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    type: 'ANNIVERSARY',
    title: 'Ngày yêu nhau',
    occursOn: '2025-02-14',
    occursAt: null,
    recurrence: 'NONE',
    personal: false,
    subjectUserId: null,
    message: 'Lần đầu đi chơi',
    details: {},
    reminderConfig: null,
    effectiveReminderConfig: { milestoneDays: null, yearly: true, offsets: ['P3D', 'P0D'], sendAt: '08:00', recipients: 'BOTH' },
    place: { id: 'pl1', name: 'Hồ Gươm', address: null, lat: 21, lng: 105, category: null },
    media: [],
    createdBy: 'u1',
    createdAt: '2025-02-14T00:00:00Z',
    updatedAt: '2025-02-14T00:00:00Z',
    ...partial,
  };
}

describe('moment screens', () => {
  test('creating a moment posts the form and opens it', async () => {
    const api = mockApi({ 'POST /api/moments': { status: 201, body: moment({ id: 'new-id' }) } });
    await renderWithProviders(<MomentFormScreen meId="u1" partnerId="u2" />);

    await fireEvent.changeText(screen.getByLabelText('Tiêu đề'), 'Ngày yêu nhau');
    await fireEvent.changeText(screen.getByLabelText('Lời nhắn'), 'Nhớ mãi');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu kỷ niệm' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/moments/new-id'));
    expect(api.calls[0].body).toEqual({
      type: 'ANNIVERSARY',
      title: 'Ngày yêu nhau',
      occursOn: toIsoDate(new Date()),
      recurrence: 'NONE',
      message: 'Nhớ mãi',
      mediaIds: [],
    });
  });

  test('shows validation error without calling api', async () => {
    const api = mockApi({});
    await renderWithProviders(<MomentFormScreen meId="u1" partnerId="u2" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Lịch hẹn' }));
    await fireEvent.changeText(screen.getByLabelText('Tiêu đề'), 'Ăn tối');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu kỷ niệm' }));

    expect(screen.getByText('Lịch hẹn cần có giờ')).toBeOnTheScreen();
    expect(api.calls).toHaveLength(0);
  });

  test('detail shows info, upcoming reminders and deletes after confirm', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'm1' });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const api = mockApi({
      'GET /api/moments/m1': { body: moment() },
      'GET /api/moments/m1/reminders': {
        body: [{ id: 'r1', fireAt: '2027-02-11T01:00:00Z', title: '💞 2 năm bên nhau', body: 'Còn 3 ngày nữa', deepLink: null }],
      },
      'DELETE /api/moments/m1': { status: 204 },
    });
    await renderWithProviders(<MomentDetailScreen />);

    expect(await screen.findByText('Ngày yêu nhau')).toBeOnTheScreen();
    expect(screen.getByText('Lần đầu đi chơi')).toBeOnTheScreen();
    expect(screen.getByText('📍 Hồ Gươm')).toBeOnTheScreen();
    expect(await screen.findByText(/Còn 3 ngày nữa/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Xoá kỷ niệm' }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(api.calls.some((c) => c.method === 'DELETE' && c.path === '/api/moments/m1')).toBe(true);
  });

  test('list splits upcoming and past moments and hides cycle', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    mockApi({
      'GET /api/moments': {
        body: [
          moment({ id: 'a', type: 'CUSTOM', title: 'Đi Đà Lạt', occursOn: toIsoDate(future) }),
          moment({ id: 'b', type: 'CUSTOM', title: 'Xem phim', occursOn: '2024-05-01' }),
          moment({ id: 'c', type: 'CYCLE', title: 'Chu kỳ', occursOn: toIsoDate(future) }),
        ],
      },
    });
    await renderWithProviders(<MomentsScreen />);

    expect(await screen.findByText('Đi Đà Lạt')).toBeOnTheScreen();
    expect(screen.getByText('Còn 5 ngày')).toBeOnTheScreen();
    expect(screen.getByText('Xem phim')).toBeOnTheScreen();
    expect(screen.queryByText('Chu kỳ')).toBeNull();
  });
});
