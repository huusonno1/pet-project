import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import SignInScreen from '@/features/account/SignInScreen';
import SignUpScreen from '@/features/account/SignUpScreen';
import { useSession } from '@/lib/auth/session';
import { tokenStore } from '@/lib/auth/token-store';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

const TOKENS = { accessToken: 'a1', refreshToken: 'r1', expiresIn: 900 };

function StatusProbe() {
  const { status, signOut } = useSession();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="probe-sign-out" onPress={signOut}>
      <Text>status:{status}</Text>
    </Pressable>
  );
}

describe('session & auth screens', () => {
  test('starts signed out without stored token', async () => {
    await renderWithProviders(<StatusProbe />, { withSession: true });
    expect(await screen.findByText('status:signedOut')).toBeOnTheScreen();
  });

  test('starts signed in with stored refresh token', async () => {
    await tokenStore.save({ accessToken: 'a0', refreshToken: 'r0' });
    await renderWithProviders(<StatusProbe />, { withSession: true });
    expect(await screen.findByText('status:signedIn')).toBeOnTheScreen();
  });

  test('sign in stores tokens and switches to signedIn', async () => {
    const api = mockApi({ 'POST /api/auth/login': { body: TOKENS } });
    await renderWithProviders(
      <>
        <SignInScreen />
        <StatusProbe />
      </>,
      { withSession: true },
    );

    await fireEvent.changeText(screen.getByLabelText('Email'), ' lan@x.vn ');
    await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('status:signedIn')).toBeOnTheScreen();
    expect(api.calls[0].body).toEqual({ email: 'lan@x.vn', password: 'password123' });
    await expect(tokenStore.getRefresh()).resolves.toBe('r1');
  });

  test('sign in shows server error message', async () => {
    mockApi({
      'POST /api/auth/login': {
        status: 401,
        body: { code: 'INVALID_CREDENTIALS', detail: 'Email hoặc mật khẩu không đúng' },
      },
    });
    await renderWithProviders(<SignInScreen />, { withSession: true });

    await fireEvent.changeText(screen.getByLabelText('Email'), 'lan@x.vn');
    await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'wrong-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Email hoặc mật khẩu không đúng')).toBeOnTheScreen();
  });

  test('sign up validates password length before calling api', async () => {
    const api = mockApi({});
    await renderWithProviders(<SignUpScreen />, { withSession: true });

    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Lan');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'lan@x.vn');
    await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'short');
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(screen.getByText('Mật khẩu tối thiểu 8 ký tự')).toBeOnTheScreen();
    expect(api.calls).toHaveLength(0);
  });

  test('sign up registers and signs in', async () => {
    const api = mockApi({ 'POST /api/auth/register': { status: 201, body: TOKENS } });
    await renderWithProviders(
      <>
        <SignUpScreen />
        <StatusProbe />
      </>,
      { withSession: true },
    );

    await fireEvent.changeText(screen.getByLabelText('Tên hiển thị'), 'Lan');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'lan@x.vn');
    await fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'password123');
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByText('status:signedIn')).toBeOnTheScreen();
    expect(api.calls[0].body).toEqual({ email: 'lan@x.vn', password: 'password123', displayName: 'Lan' });
  });

  test('sign out revokes refresh token and clears session', async () => {
    await tokenStore.save({ accessToken: 'a0', refreshToken: 'r0' });
    const api = mockApi({ 'POST /api/auth/logout': { status: 204 } });
    await renderWithProviders(<StatusProbe />, { withSession: true });
    await screen.findByText('status:signedIn');

    await fireEvent.press(screen.getByRole('button', { name: 'probe-sign-out' }));

    expect(await screen.findByText('status:signedOut')).toBeOnTheScreen();
    expect(api.calls[0].body).toEqual({ refreshToken: 'r0' });
    await expect(tokenStore.getRefresh()).resolves.toBeNull();
  });
});
