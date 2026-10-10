# GĐ1 Mobile (Expo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App Expo chạy trên Android + iOS dùng toàn bộ API GĐ1 đã có trên `main`: đăng ký/đăng nhập, ghép đôi, khoảng cách, kỷ niệm (ảnh, filter, vị trí, lời nhắn), tuỳ chỉnh nhắc nhở, chu kỳ, đặc điểm đối phương, cài đặt, nhận push.

**Architecture:** Expo Router (file-based) với root `Stack` dùng `Stack.Protected` để tách luồng đăng nhập / chưa ghép đôi / đã ghép đôi; đã ghép đôi thì vào `Tabs`. Dữ liệu server qua TanStack Query, gọi REST bằng `apiFetch` (tự gắn JWT, tự refresh khi 401). Mỗi tính năng là một thư mục `src/features/<tên>` (api hooks + màn hình + logic thuần); file trong `src/app` chỉ re-export màn hình. Logic thuần (định dạng, mốc ngày, payload form, mapping người nhận) được unit test; màn hình được test bằng React Native Testing Library với `fetch` giả lập.

**Tech Stack:** Expo SDK 57 (React Native 0.86, React 19.2, TypeScript), Expo Router 57, TanStack Query v5, expo-secure-store, expo-location, expo-camera, expo-image-picker, expo-image-manipulator, expo-file-system (API `File`), `expo/fetch`, @shopify/react-native-skia 2.6, @react-native-community/datetimepicker 9, expo-notifications, @expo/vector-icons; Jest (`jest-expo`) + @testing-library/react-native 14.

**Spec:** `docs/superpowers/specs/2026-10-10-couple-app-design.md` · API backend: `README.md` mục "API GĐ1", code tại `backend/`.

## Global Constraints

- Thư mục app: `mobile/`. Mọi lệnh `npx`/`npm` chạy trong `mobile/`.
- Cài package native bằng `npx expo install <pkg>` (chọn bản khớp SDK 57). Không sửa tay `ios/`, `android/`.
- Route chỉ nằm trong `src/app/`; file route chỉ `export { default } from '@/features/...'`. Code khác nằm ngoài `src/app/`.
- Alias import `@/` = `src/`.
- Toàn bộ chữ hiển thị bằng **tiếng Việt**.
- Không lưu token ở AsyncStorage: access/refresh token lưu bằng `expo-secure-store`.
- URL API lấy từ `EXPO_PUBLIC_API_URL` (file `mobile/.env`, không commit); điện thoại thật phải dùng IP LAN của máy chạy backend.
- Deep link scheme: `coupleapp` (backend gửi `coupleapp://moments/{id}`, `coupleapp://traits/{userId}`, `coupleapp://home`).
- Ảnh upload: JPEG, cạnh dài tối đa **2048px**, chất lượng 0.85; filter: Gốc, Ấm, Lạnh, Vintage, Đen trắng.
- `reminder_config`: tối đa **5** mốc nhắc, mỗi mốc ≤ **30 ngày**; tối đa **20** mốc ngày kỷ niệm (1..36500); `sendAt` dạng `HH:mm`.
- RNTL 14: `render`, `renderHook`, `fireEvent.*` đều **async** — luôn `await`.
- Test đặt trong thư mục `__tests__`, tên file `*-test.ts(x)`; lệnh: `npm test -- <đường-dẫn>`; kiểm tra kiểu: `npx tsc --noEmit`.
- Push từ xa **không chạy trên Expo Go (Android)** — cần development build (Task 12). Mọi thứ khác chạy được trên Expo Go.
- Commit message dạng Conventional Commits, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Phạm vi & điểm lệch spec (cần người dùng xác nhận khi review plan)

- **Chọn địa điểm trên bản đồ → chuyển sang GĐ2.** GĐ1 chỉ "dùng vị trí hiện tại + đặt tên". Lý do: bản đồ trên Android cần Google Maps API key (cấu hình + tài khoản Google Cloud), và GĐ2 làm màn bản đồ địa điểm nên gộp chung.
- `typedRoutes` của Expo Router tắt (cần chạy `expo start` để sinh type, làm `tsc` trong CI không ổn định).
- Tên hiển thị app: **Couple App**, bundle id `com.coupleapp.mobile` (đổi được sau).

## Review Focus

1. **Access token hết hạn khi nhiều request chạy song song** → chỉ refresh một lần, các request đều thành công; refresh hỏng → về màn đăng nhập. → `concurrent401sRefreshOnce` + `refreshFailureSignsOut` (Task 2).
2. **Sinh nhật 29/02 ở năm không nhuận** → mục "Sắp tới" hiển thị 28/02, không biến mất. → `feb29FallsBackToFeb28` (Task 5).
3. **Người nhận nhắc nhìn từ góc người xem** ("Mình/Người ấy") khi người xem không phải chủ kỷ niệm → map đúng sang OWNER/PARTNER. → `audienceIsRelativeToViewer` (Task 8).
4. **Từ chối quyền vị trí** → màn chính vẫn dùng được, hiện hướng dẫn bật định vị thay vì lỗi. → `showsPermissionHintWhenDenied` (Task 5).
5. **Ảnh rất lớn từ camera/thư viện** → luôn thu nhỏ về ≤ 2048px trước khi upload. → `downscalesLargeImages` (Task 6).

---

## Cấu trúc file

```
mobile/
├── app.json, package.json, tsconfig.json, .env.example, eas.json
└── src/
    ├── app/                                  # chỉ route, re-export màn hình
    │   ├── _layout.tsx                       # providers + Stack.Protected theo phiên
    │   ├── sign-in.tsx, sign-up.tsx
    │   └── (app)/
    │       ├── _layout.tsx                   # Stack.Protected theo trạng thái ghép đôi + push
    │       ├── pair.tsx
    │       ├── (tabs)/_layout.tsx, index.tsx, moments.tsx, cycle.tsx, traits.tsx, settings.tsx
    │       ├── moments/new.tsx
    │       └── moments/[id]/index.tsx, edit.tsx, reminders.tsx
    ├── lib/
    │   ├── config.ts                         # API_URL
    │   ├── format.ts                         # ngày giờ, km, thời gian tương đối
    │   ├── query.ts                          # QueryClient + query keys
    │   ├── push.ts                           # đăng ký Expo push token, map deep link
    │   ├── api/types.ts, api/client.ts       # kiểu DTO + apiFetch/ApiError
    │   └── auth/token-store.ts, auth/session.tsx
    ├── ui/                                   # theme + Button, TextField, DateField, Card, Chip, ErrorText, Screen, Title
    ├── features/
    │   ├── account/   api.ts, SignInScreen.tsx, SignUpScreen.tsx
    │   ├── couple/    api.ts, PairScreen.tsx
    │   ├── home/      HomeScreen.tsx, use-location-sync.ts
    │   ├── media/     upload.ts, filters.ts, apply-filter.ts, CameraSheet.tsx, PhotoStrip.tsx
    │   ├── moments/   api.ts, occurrence.ts, form.ts, labels.ts, MomentsScreen.tsx, MomentFormScreen.tsx,
    │   │              MomentDetailScreen.tsx, NewMomentScreen.tsx, EditMomentScreen.tsx
    │   ├── reminders/ audience.ts, offsets.ts, ReminderConfigScreen.tsx
    │   ├── cycle/     api.ts, CycleScreen.tsx
    │   ├── traits/    api.ts, TraitsScreen.tsx, SizeForm.tsx, PreferenceForm.tsx
    │   └── settings/  SettingsScreen.tsx
    └── test/  setup.ts, api-mock.ts, render.tsx
```

---

### Task 1: Công cụ, cấu hình app, dọn template, UI cơ bản, tiện ích định dạng

**Files:**
- Modify: `mobile/package.json`, `mobile/app.json`
- Delete: `mobile/src/components/`, `mobile/src/hooks/`, `mobile/src/constants/`, `mobile/src/global.css`, `mobile/src/app/explore.tsx`, `mobile/scripts/`
- Create: `mobile/.env.example`, `mobile/src/lib/config.ts`, `mobile/src/lib/format.ts`
- Create: `mobile/src/ui/theme.ts`, `Button.tsx`, `TextField.tsx`, `DateField.tsx`, `Card.tsx`, `Chip.tsx`, `ErrorText.tsx`, `Screen.tsx`, `Title.tsx`
- Create: `mobile/src/test/setup.ts`
- Replace: `mobile/src/app/_layout.tsx`, `mobile/src/app/index.tsx`
- Test: `mobile/src/lib/__tests__/format-test.ts`, `mobile/src/ui/__tests__/ui-test.tsx`

**Interfaces:**
- Produces:
  - `format.ts`: `pad(n)`, `toIsoDate(d: Date): string`, `parseIsoDate(s): Date`, `formatDate(s): string` (dd/MM/yyyy), `formatTime(iso): string` (HH:mm), `formatDateTime(iso): string`, `daysBetween(fromIsoDate, to: Date): number`, `formatKm(km: number | null): string`, `timeAgo(iso, now?): string`, `combineDateTime(date, time): string` (ISO UTC).
  - `ui`: `Button({title,onPress,variant?,loading?,disabled?})`, `TextField(TextInputProps & {label, error?})`, `DateField({label,value,mode?,onChange,placeholder?})`, `Card({children,style?})`, `Chip({label,selected,onPress})`, `ErrorText({message})`, `Screen({children,scroll?})`, `Title({children})`, `colors`, `spacing`, `radius`.
  - `config.ts`: `API_URL: string`.
  - `test/setup.ts`: mock `expo-secure-store` (bộ nhớ trong, xoá trước mỗi test), mock `expo-router` (`router.push/replace/back/dismissTo` là `jest.fn`, `useLocalSearchParams` là `jest.fn`), mock `@react-native-community/datetimepicker` (render `Text testID="datetimepicker"` có prop `onValueChange`).

- [ ] **Step 1: Cài thư viện**

Run (trong `mobile/`):
```bash
npx expo install jest-expo jest @types/jest @testing-library/react-native test-renderer --dev
npx expo install expo-secure-store expo-location expo-camera expo-image-picker expo-image-manipulator expo-file-system expo-notifications @shopify/react-native-skia @react-native-community/datetimepicker @expo/vector-icons
npm install @tanstack/react-query@^5
```
Expected: cài xong không lỗi; `package.json` có các package trên.

- [ ] **Step 2: Cấu hình package.json, tsconfig, app.json; dọn template**

Run (trong `mobile/`):
```bash
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
delete pkg.scripts["reset-project"];
pkg.scripts.test = "jest";
pkg.scripts.typecheck = "tsc --noEmit";
pkg.jest = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["./src/test/setup.ts"],
  testMatch: ["**/__tests__/**/*-test.[jt]s?(x)"]
};
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");

const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
const e = app.expo;
e.name = "Couple App";
e.slug = "couple-app";
e.scheme = "coupleapp";
e.userInterfaceStyle = "light";
e.ios = { ...e.ios, bundleIdentifier: "com.coupleapp.mobile" };
e.android = { ...e.android, package: "com.coupleapp.mobile" };
e.experiments = { ...e.experiments, typedRoutes: false };
e.plugins = [
  "expo-router",
  ["expo-splash-screen", { backgroundColor: "#E8577E", image: "./assets/images/splash-icon.png", imageWidth: 76 }],
  "expo-secure-store",
  ["expo-camera", { cameraPermission: "Cho phép Couple App dùng camera để chụp ảnh kỷ niệm", recordAudioAndroid: false }],
  ["expo-image-picker", { photosPermission: "Cho phép Couple App chọn ảnh từ thư viện để lưu kỷ niệm" }],
  ["expo-location", { locationWhenInUsePermission: "Couple App dùng vị trí để tính khoảng cách giữa hai bạn" }],
  ["expo-notifications", { color: "#E8577E" }]
];
fs.writeFileSync("app.json", JSON.stringify(app, null, 2) + "\n");
'
rm -rf src/components src/hooks src/constants src/global.css src/app/explore.tsx scripts
```
Expected: lệnh chạy không lỗi.

`mobile/.env.example`:
```bash
# Sao chép thành .env. Điện thoại thật: dùng IP LAN của máy chạy backend.
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080
```

`mobile/src/lib/config.ts`:
```ts
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
```

- [ ] **Step 3: Setup test**

`mobile/src/test/setup.ts`:
```ts
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

jest.mock('expo-router', () => {
  const React = require('react');
  const Passthrough = ({ children }: { children?: unknown }) => children ?? null;
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      dismissTo: jest.fn(),
      canGoBack: jest.fn(() => true),
    },
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, []),
    Stack: Object.assign(Passthrough, { Screen: () => null, Protected: Passthrough }),
    Link: Passthrough,
    Redirect: () => null,
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Picker = (props: { mode?: string; onValueChange?: unknown }) =>
    React.createElement(Text, { testID: 'datetimepicker', onValueChange: props.onValueChange }, props.mode ?? 'date');
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() } };
});

beforeEach(() => {
  (require('expo-secure-store').__store as Map<string, string>).clear();
  jest.clearAllMocks();
});
```

- [ ] **Step 4: Viết test (fail)**

`mobile/src/lib/__tests__/format-test.ts`:
```ts
import {
  combineDateTime,
  daysBetween,
  formatDate,
  formatKm,
  timeAgo,
  toIsoDate,
} from '@/lib/format';

describe('format', () => {
  test('toIsoDate uses local calendar date', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  test('formatDate renders dd/MM/yyyy', () => {
    expect(formatDate('2026-03-08')).toBe('08/03/2026');
  });

  test('daysBetween counts calendar days', () => {
    expect(daysBetween('2025-02-14', new Date(2025, 4, 25, 15, 0))).toBe(100);
    expect(daysBetween('2025-02-14', new Date(2025, 1, 14))).toBe(0);
  });

  test('formatKm picks a readable unit', () => {
    expect(formatKm(null)).toBe('—');
    expect(formatKm(0.35)).toBe('350 m');
    expect(formatKm(12.34)).toBe('12,3 km');
    expect(formatKm(1137.4)).toBe('1.137 km');
  });

  test('timeAgo describes elapsed time', () => {
    const now = new Date('2026-10-10T10:00:00Z');
    expect(timeAgo('2026-10-10T09:59:40Z', now)).toBe('vừa xong');
    expect(timeAgo('2026-10-10T09:55:00Z', now)).toBe('5 phút trước');
    expect(timeAgo('2026-10-10T07:00:00Z', now)).toBe('3 giờ trước');
    expect(timeAgo('2026-10-08T10:00:00Z', now)).toBe('2 ngày trước');
  });

  test('combineDateTime keeps the local wall-clock time', () => {
    const d = new Date(combineDateTime('2026-03-10', '19:30'));
    expect(d.getHours()).toBe(19);
    expect(d.getMinutes()).toBe(30);
    expect(toIsoDate(d)).toBe('2026-03-10');
  });
});
```

`mobile/src/ui/__tests__/ui-test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/ui/Button';
import { DateField } from '@/ui/DateField';
import { TextField } from '@/ui/TextField';

describe('ui', () => {
  test('Button calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Lưu" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('loading Button does not call onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Lưu" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('TextField shows label and error', async () => {
    await render(<TextField label="Email" value="" onChangeText={() => {}} error="Email không hợp lệ" />);
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.getByText('Email không hợp lệ')).toBeOnTheScreen();
  });

  test('DateField opens picker and returns ISO date', async () => {
    const onChange = jest.fn();
    await render(<DateField label="Ngày" value="2026-03-08" onChange={onChange} />);
    expect(screen.getByText('08/03/2026')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Ngày' }));
    await fireEvent(screen.getByTestId('datetimepicker'), 'valueChange', {}, new Date(2026, 9, 20));

    expect(onChange).toHaveBeenCalledWith('2026-10-20');
  });
});
```

- [ ] **Step 5: Chạy test, xác nhận fail**

Run: `npm test -- src/lib src/ui`
Expected: FAIL (không tìm thấy module `@/lib/format`, `@/ui/...`).

- [ ] **Step 6: Tiện ích định dạng**

`mobile/src/lib/format.ts`:
```ts
export const pad = (n: number) => String(n).padStart(2, '0');

/** Ngày lịch theo giờ máy, dạng YYYY-MM-DD. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD → Date lúc 00:00 giờ máy. */
export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatTime(iso)} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Số ngày lịch từ `from` (YYYY-MM-DD) tới ngày của `to`. */
export function daysBetween(from: string, to: Date): number {
  const a = parseIsoDate(from);
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatKm(km: number | null): string {
  if (km === null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${groupThousands(Math.round(km))} km`;
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

/** Ghép ngày (YYYY-MM-DD) + giờ (HH:mm) theo giờ máy thành ISO UTC. */
export function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}
```

- [ ] **Step 7: UI cơ bản**

`mobile/src/ui/theme.ts`:
```ts
export const colors = {
  primary: '#E8577E',
  primaryDark: '#C73E66',
  bg: '#FFF7F9',
  card: '#FFFFFF',
  text: '#2B2B2B',
  muted: '#8A8A8A',
  border: '#F0D5DD',
  danger: '#D93025',
  success: '#2E7D32',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 8, md: 12, lg: 20 };
```

`mobile/src/ui/ErrorText.tsx`:
```tsx
import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from './theme';

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: { color: colors.danger, marginTop: spacing.xs, fontSize: 13 },
});
```

`mobile/src/ui/Button.tsx`:
```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from './theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], (pressed || inactive) && styles.dim]}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.text, variant === 'secondary' && styles.textSecondary]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  dim: { opacity: 0.6 },
  text: { color: '#fff', fontWeight: '600', fontSize: 16 },
  textSecondary: { color: colors.primary },
});
```

`mobile/src/ui/TextField.tsx`:
```tsx
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { ErrorText } from './ErrorText';
import { colors, radius, spacing } from './theme';

type Props = TextInputProps & { label: string; error?: string | null };

export function TextField({ label, error, style, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, input.multiline && styles.multiline, error ? styles.inputError : null, style]}
        {...input}
      />
      <ErrorText message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 16,
  },
  multiline: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
});
```

`mobile/src/ui/DateField.tsx`:
```tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, pad, parseIsoDate, toIsoDate } from '@/lib/format';

import { colors, radius, spacing } from './theme';

type Props = {
  label: string;
  /** YYYY-MM-DD khi mode="date", HH:mm khi mode="time". */
  value: string | null;
  mode?: 'date' | 'time';
  onChange: (value: string) => void;
  placeholder?: string;
};

function timeToDate(value: string): Date {
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function DateField({ label, value, mode = 'date', onChange, placeholder = 'Chọn' }: Props) {
  const [open, setOpen] = useState(false);
  const current = value ? (mode === 'date' ? parseIsoDate(value) : timeToDate(value)) : new Date();
  const display = value ? (mode === 'date' ? formatDate(value) : value) : placeholder;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.input}>
        <Text style={value ? styles.value : styles.placeholder}>{display}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={current}
          mode={mode}
          is24Hour
          onValueChange={(_event, date) => {
            setOpen(false);
            onChange(mode === 'date' ? toIsoDate(date) : `${pad(date.getHours())}:${pad(date.getMinutes())}`);
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  value: { color: colors.text, fontSize: 16 },
  placeholder: { color: colors.muted, fontSize: 16 },
});
```

`mobile/src/ui/Card.tsx`:
```tsx
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
```

`mobile/src/ui/Chip.tsx`:
```tsx
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from './theme';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}>
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { color: colors.text },
  textSelected: { color: '#fff', fontWeight: '600' },
});
```

`mobile/src/ui/Title.tsx`:
```tsx
import { StyleSheet, Text } from 'react-native';

import { colors, spacing } from './theme';

export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
});
```

`mobile/src/ui/Screen.tsx`:
```tsx
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from './theme';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const content = <View style={styles.inner}>{children}</View>;
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  inner: { flex: 1, padding: spacing.lg },
});
```

`mobile/src/app/_layout.tsx` (thay toàn bộ — Task 3 sẽ thay tiếp):
```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`mobile/src/app/index.tsx` (thay toàn bộ — Task 3 sẽ xoá):
```tsx
import { Screen } from '@/ui/Screen';
import { Title } from '@/ui/Title';

export default function Index() {
  return (
    <Screen>
      <Title>Couple App</Title>
    </Screen>
  );
}
```

- [ ] **Step 8: Chạy test + kiểm tra kiểu**

Run: `npm test -- src/lib src/ui && npx tsc --noEmit`
Expected: PASS (10 tests), `tsc` không lỗi.

- [ ] **Step 9: Commit**

```bash
git add mobile
git commit -m "chore(mobile): tooling, app config, base ui kit and format helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: API client (JWT + tự refresh) và lưu token

**Files:**
- Create: `mobile/src/lib/api/types.ts`, `mobile/src/lib/api/client.ts`, `mobile/src/lib/auth/token-store.ts`, `mobile/src/lib/query.ts`
- Create: `mobile/src/test/api-mock.ts`
- Test: `mobile/src/lib/api/__tests__/client-test.ts`

**Interfaces:**
- Consumes: `API_URL` (Task 1).
- Produces:
  - `types.ts`: kiểu DTO khớp backend (`TokenResponse`, `Me`, `Settings`, `Couple`, `Partner`, `Invite`, `Distance`, `MomentType`, `Audience`, `ReminderConfig`, `PlaceInput`, `Place`, `MediaDto`, `Moment`, `MomentInput`, `ReminderItem`, `CycleLog`, `Prediction`, `Visibility`, `SizeEntry`, `LinkDto`, `Preference`, `Traits`, `CatalogItem`, `Catalog`, `UploadUrl`).
  - `client.ts`: `class ApiError extends Error { status: number; code: string; fields?: Record<string,string> }`, `apiFetch<T>(path: string, opts?: { method?: string; body?: unknown; auth?: boolean }): Promise<T>`, `errorMessage(e: unknown): string`, `setSessionExpiredHandler(fn: (() => void) | null)`.
  - `token-store.ts`: `tokenStore.getAccess()`, `getRefresh()`, `save({accessToken, refreshToken})`, `clear()`.
  - `query.ts`: `createQueryClient()`, `keys` (query keys).
  - Test: `mockApi(routes) → { calls }` (thay `global.fetch`; key `"METHOD /path"`).

- [ ] **Step 1: Kiểu DTO**

`mobile/src/lib/api/types.ts`:
```ts
export type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number };

export type Me = {
  id: string;
  email: string;
  displayName: string;
  birthday: string | null;
  timezone: string;
  avatarUrl: string | null;
};

export type Settings = {
  shareLocation: boolean;
  shareCycle: boolean;
  cycleLengthDefault: number;
  notifyPrefs: Record<string, boolean>;
};

export type Partner = { id: string; displayName: string };
export type Couple = { id: string; startedDatingOn: string | null; createdAt: string; partner: Partner };
export type Invite = { code: string; expiresAt: string };

export type Distance = {
  distanceKm: number | null;
  me: { updatedAt: string } | null;
  partner: { updatedAt: string } | null;
};

export type MomentType = 'ANNIVERSARY' | 'DATE_PLAN' | 'GIFT_OCCASION' | 'CYCLE' | 'CUSTOM';
export type Recurrence = 'NONE' | 'YEARLY';
export type Audience = 'OWNER' | 'PARTNER' | 'BOTH';

export type ReminderConfig = {
  milestoneDays: number[] | null;
  yearly: boolean | null;
  offsets: string[] | null;
  sendAt: string | null;
  recipients: Audience | null;
};

export type PlaceInput = { name: string; address?: string; lat: number; lng: number; category?: string };
export type Place = { id: string; name: string; address: string | null; lat: number; lng: number; category: string | null };

export type MediaDto = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  filter: string | null;
  takenAt: string | null;
};

export type Moment = {
  id: string;
  type: MomentType;
  title: string;
  occursOn: string;
  occursAt: string | null;
  recurrence: Recurrence;
  subjectUserId: string | null;
  message: string | null;
  details: Record<string, unknown>;
  reminderConfig: ReminderConfig | null;
  effectiveReminderConfig: ReminderConfig;
  place: Place | null;
  media: MediaDto[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MomentInput = {
  type?: MomentType;
  title?: string;
  occursOn?: string;
  occursAt?: string | null;
  recurrence?: Recurrence;
  subjectUserId?: string | null;
  message?: string;
  details?: Record<string, unknown>;
  place?: PlaceInput;
  mediaIds?: string[];
};

export type ReminderItem = { id: string; fireAt: string; title: string; body: string; deepLink: string | null };

export type CycleLog = { id: string; periodStart: string; periodEnd: string | null };
export type Prediction = { nextStart: string; averageLength: number; basedOnCycles: number };

export type Visibility = 'SHARED' | 'AUTHOR_ONLY';

export type SizeEntry = {
  id: string;
  subjectUserId: string;
  kind: string;
  value: string;
  note: string | null;
  visibility: Visibility;
  createdBy: string;
  updatedAt: string;
};

export type LinkDto = { id: string; url: string; label: string | null; price: number | null };

export type Preference = {
  id: string;
  subjectUserId: string;
  category: string;
  brand: string | null;
  name: string | null;
  color: string | null;
  note: string | null;
  visibility: Visibility;
  createdBy: string;
  updatedAt: string;
  links: LinkDto[];
};

export type Traits = { sizes: SizeEntry[]; preferences: Preference[] };
export type CatalogItem = { code: string; label: string };
export type Catalog = { sizeKinds: CatalogItem[]; preferenceCategories: CatalogItem[] };

export type UploadUrl = {
  mediaId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
};
```

- [ ] **Step 2: Hạ tầng test (fetch giả)**

`mobile/src/test/api-mock.ts`:
```ts
import { API_URL } from '@/lib/config';

export type MockRequest = { method: string; path: string; body: unknown; headers: Record<string, string> };
type MockResponse = { status?: number; body?: unknown };
type Route = MockResponse | ((req: MockRequest) => MockResponse);

function response(status: number, body: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

/** Thay global.fetch; route theo key "METHOD /path" (khớp cả có/không query string). */
export function mockApi(routes: Record<string, Route>) {
  const calls: MockRequest[] = [];
  global.fetch = jest.fn(async (input: unknown, init: { method?: string; body?: unknown; headers?: unknown } = {}) => {
    const url = String(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const path = url.startsWith(API_URL) ? url.slice(API_URL.length) : url;
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const req: MockRequest = { method, path, body, headers: (init.headers ?? {}) as Record<string, string> };
    calls.push(req);
    const route = routes[`${method} ${path}`] ?? routes[`${method} ${path.split('?')[0]}`];
    if (!route) {
      return response(404, { code: 'NOT_FOUND', detail: `Không có mock cho ${method} ${path}` });
    }
    const r = typeof route === 'function' ? route(req) : route;
    return response(r.status ?? 200, r.body);
  }) as unknown as typeof fetch;
  return { calls };
}
```

- [ ] **Step 3: Viết test (fail)**

`mobile/src/lib/api/__tests__/client-test.ts`:
```ts
import { ApiError, apiFetch, setSessionExpiredHandler } from '@/lib/api/client';
import { tokenStore } from '@/lib/auth/token-store';
import { mockApi } from '@/test/api-mock';

const TOKENS = { accessToken: 'old-access', refreshToken: 'old-refresh' };

describe('apiFetch', () => {
  afterEach(() => setSessionExpiredHandler(null));

  test('attaches bearer token and parses JSON', async () => {
    await tokenStore.save(TOKENS);
    const api = mockApi({ 'GET /api/me': { body: { id: 'u1' } } });

    await expect(apiFetch('/api/me')).resolves.toEqual({ id: 'u1' });
    expect(api.calls[0].headers.Authorization).toBe('Bearer old-access');
  });

  test('throws ApiError with code, detail and fields', async () => {
    mockApi({
      'POST /api/auth/register': {
        status: 400,
        body: { code: 'VALIDATION_FAILED', detail: 'Dữ liệu không hợp lệ', fields: { email: 'sai' } },
      },
    });

    const error = await apiFetch('/api/auth/register', { method: 'POST', body: {}, auth: false }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('Dữ liệu không hợp lệ');
    expect(error.fields).toEqual({ email: 'sai' });
  });

  test('refreshes once on 401 and retries with new token', async () => {
    await tokenStore.save(TOKENS);
    const api = mockApi({
      'GET /api/me': (req) =>
        req.headers.Authorization === 'Bearer new-access' ? { body: { id: 'u1' } } : { status: 401, body: {} },
      'POST /api/auth/refresh': { body: { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 } },
    });

    await expect(apiFetch('/api/me')).resolves.toEqual({ id: 'u1' });
    expect(api.calls.filter((c) => c.path === '/api/auth/refresh')).toHaveLength(1);
    expect(api.calls.find((c) => c.path === '/api/auth/refresh')?.body).toEqual({ refreshToken: 'old-refresh' });
    await expect(tokenStore.getRefresh()).resolves.toBe('new-refresh');
  });

  test('concurrent401sRefreshOnce', async () => {
    await tokenStore.save(TOKENS);
    const api = mockApi({
      'GET /api/me': (req) =>
        req.headers.Authorization === 'Bearer new-access' ? { body: { id: 'u1' } } : { status: 401, body: {} },
      'GET /api/couples/me': (req) =>
        req.headers.Authorization === 'Bearer new-access' ? { body: { id: 'c1' } } : { status: 401, body: {} },
      'POST /api/auth/refresh': { body: { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 } },
    });

    const [me, couple] = await Promise.all([apiFetch('/api/me'), apiFetch('/api/couples/me')]);

    expect(me).toEqual({ id: 'u1' });
    expect(couple).toEqual({ id: 'c1' });
    expect(api.calls.filter((c) => c.path === '/api/auth/refresh')).toHaveLength(1);
  });

  test('refreshFailureSignsOut', async () => {
    await tokenStore.save(TOKENS);
    const expired = jest.fn();
    setSessionExpiredHandler(expired);
    mockApi({
      'GET /api/me': { status: 401, body: {} },
      'POST /api/auth/refresh': { status: 401, body: { code: 'UNAUTHORIZED' } },
    });

    const error = await apiFetch('/api/me').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(expired).toHaveBeenCalledTimes(1);
    await expect(tokenStore.getAccess()).resolves.toBeNull();
  });

  test('network failure becomes ApiError NETWORK', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;

    const error = await apiFetch('/api/me').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('NETWORK');
  });

  test('explicit null body is sent as JSON null', async () => {
    await tokenStore.save(TOKENS);
    const api = mockApi({ 'PUT /api/moments/m1/reminder-config': { body: { id: 'm1' } } });

    await apiFetch('/api/moments/m1/reminder-config', { method: 'PUT', body: null });

    expect(api.calls[0].body).toBeNull();
    expect(api.calls[0].headers['Content-Type']).toBe('application/json');
  });
});
```

- [ ] **Step 4: Chạy test, xác nhận fail**

Run: `npm test -- src/lib/api`
Expected: FAIL (thiếu `@/lib/api/client`, `@/lib/auth/token-store`).

- [ ] **Step 5: Cài đặt**

`mobile/src/lib/auth/token-store.ts`:
```ts
import * as SecureStore from 'expo-secure-store';

const ACCESS = 'coupleapp.access';
const REFRESH = 'coupleapp.refresh';

export type Tokens = { accessToken: string; refreshToken: string };

export const tokenStore = {
  getAccess: () => SecureStore.getItemAsync(ACCESS),
  getRefresh: () => SecureStore.getItemAsync(REFRESH),
  async save(tokens: Tokens) {
    await SecureStore.setItemAsync(ACCESS, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH, tokens.refreshToken);
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
  },
};
```

`mobile/src/lib/api/client.ts`:
```ts
import { API_URL } from '@/lib/config';
import { tokenStore } from '@/lib/auth/token-store';

import type { TokenResponse } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean };
type RawResponse = { ok: boolean; status: number; text: () => Promise<string> };

let onSessionExpired: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

/** Thông điệp tiếng Việt để hiển thị cho người dùng từ một lỗi bất kỳ. */
export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Có lỗi xảy ra, vui lòng thử lại';
}

/** Được gọi khi refresh token cũng hết hạn (SessionProvider chuyển về màn đăng nhập). */
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 401 && opts.auth !== false) {
    if (await refreshTokens()) {
      return parse<T>(await send(path, opts));
    }
    await tokenStore.clear();
    onSessionExpired?.();
    throw new ApiError(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  }
  return parse<T>(res);
}

async function send(path: string, opts: Options): Promise<RawResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.auth !== false) {
    const token = await tokenStore.getAccess();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  try {
    return await fetch(API_URL + path, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ, kiểm tra mạng và thử lại');
  }
}

async function parse<T>(res: RawResponse): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.code ?? 'UNKNOWN',
      data?.detail ?? 'Có lỗi xảy ra, vui lòng thử lại',
      data?.fields,
    );
  }
  return data as T;
}

/** Chỉ một lần refresh chạy tại một thời điểm; các request 401 khác chờ chung. */
function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await tokenStore.getRefresh();
      if (!refreshToken) return false;
      try {
        const res = await send('/api/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false });
        if (!res.ok) return false;
        await tokenStore.save(await parse<TokenResponse>(res));
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}
```

`mobile/src/lib/query.ts`:
```ts
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
}

export const keys = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  couple: ['couple'] as const,
  distance: ['distance'] as const,
  moments: ['moments'] as const,
  moment: (id: string) => ['moments', id] as const,
  reminders: (id: string) => ['moments', id, 'reminders'] as const,
  cycleLogs: ['cycle', 'logs'] as const,
  prediction: (userId: string) => ['cycle', 'prediction', userId] as const,
  traits: (userId: string) => ['traits', userId] as const,
  catalog: ['traits', 'catalog'] as const,
};
```

- [ ] **Step 6: Chạy test + kiểm tra kiểu**

Run: `npm test -- src/lib/api && npx tsc --noEmit`
Expected: PASS (7 tests), `tsc` không lỗi.

- [ ] **Step 7: Commit**

```bash
git add mobile
git commit -m "feat(mobile): api client with token refresh and secure token storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Phiên đăng nhập, màn Đăng nhập/Đăng ký, layout gốc

**Files:**
- Create: `mobile/src/lib/auth/session.tsx`, `mobile/src/features/account/api.ts`, `mobile/src/features/account/SignInScreen.tsx`, `mobile/src/features/account/SignUpScreen.tsx`
- Create: `mobile/src/test/render.tsx`
- Create: `mobile/src/app/sign-in.tsx`, `mobile/src/app/sign-up.tsx`, `mobile/src/app/(app)/_layout.tsx`, `mobile/src/app/(app)/index.tsx`
- Replace: `mobile/src/app/_layout.tsx`
- Delete: `mobile/src/app/index.tsx`
- Test: `mobile/src/features/account/__tests__/auth-test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `errorMessage`, `setSessionExpiredHandler`, `tokenStore`, `keys`, `createQueryClient`, UI kit.
- Produces:
  - `SessionProvider`, `useSession() → { status: 'loading' | 'signedOut' | 'signedIn'; signIn(email, password); signUp(email, password, displayName); signOut() }` (đặt bên trong `QueryClientProvider`; signOut/hết phiên xoá cache query).
  - `account/api.ts`: `useMe()`, `useUpdateMe()` (PATCH `/api/me`, body `{displayName?, birthday?, timezone?, avatarMediaId?}`), `useSettings()`, `useUpdateSettings()` (PUT `/api/me/settings`, body `Partial<Settings>`).
  - Test: `renderWithProviders(ui, { withSession? }) → RenderResult & { client: QueryClient }`.

- [ ] **Step 1: Helper render cho test**

`mobile/src/test/render.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';

import { SessionProvider } from '@/lib/auth/session';

export async function renderWithProviders(ui: React.ReactElement, { withSession = false } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  const tree = (
    <QueryClientProvider client={client}>{withSession ? <SessionProvider>{ui}</SessionProvider> : ui}</QueryClientProvider>
  );
  const result = await render(tree);
  return { ...result, client };
}
```

- [ ] **Step 2: Viết test (fail)**

`mobile/src/features/account/__tests__/auth-test.tsx`:
```tsx
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
    await fireEvent.changeText(screen.getByLabelText('Nhập lại mật khẩu'), 'short');
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
    await fireEvent.changeText(screen.getByLabelText('Nhập lại mật khẩu'), 'password123');
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
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npm test -- src/features/account`
Expected: FAIL (thiếu `@/lib/auth/session`, màn hình).

- [ ] **Step 4: Phiên đăng nhập**

`mobile/src/lib/auth/session.tsx`:
```tsx
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';

import { apiFetch, setSessionExpiredHandler } from '@/lib/api/client';
import type { TokenResponse } from '@/lib/api/types';

import { tokenStore } from './token-store';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

type SessionValue = {
  status: SessionStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let active = true;
    tokenStore.getRefresh().then((token) => {
      if (active) setStatus(token ? 'signedIn' : 'signedOut');
    });
    setSessionExpiredHandler(() => {
      queryClient.clear();
      setStatus('signedOut');
    });
    return () => {
      active = false;
      setSessionExpiredHandler(null);
    };
  }, [queryClient]);

  async function start(path: string, body: Record<string, string>) {
    const tokens = await apiFetch<TokenResponse>(path, { method: 'POST', body, auth: false });
    await tokenStore.save(tokens);
    queryClient.clear();
    setStatus('signedIn');
  }

  const value: SessionValue = {
    status,
    signIn: (email, password) => start('/api/auth/login', { email, password }),
    signUp: (email, password, displayName) => start('/api/auth/register', { email, password, displayName }),
    async signOut() {
      const refreshToken = await tokenStore.getRefresh();
      if (refreshToken) {
        await apiFetch('/api/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(() => undefined);
      }
      await tokenStore.clear();
      queryClient.clear();
      setStatus('signedOut');
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession phải được dùng bên trong <SessionProvider>');
  }
  return value;
}
```

- [ ] **Step 5: API tài khoản**

`mobile/src/features/account/api.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Me, Settings } from '@/lib/api/types';
import { keys } from '@/lib/query';

export type UpdateMeInput = { displayName?: string; birthday?: string; timezone?: string; avatarMediaId?: string };

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => apiFetch<Me>('/api/me') });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeInput) => apiFetch<Me>('/api/me', { method: 'PATCH', body }),
    onSuccess: (me) => qc.setQueryData(keys.me, me),
  });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => apiFetch<Settings>('/api/me/settings') });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Settings>) => apiFetch<Settings>('/api/me/settings', { method: 'PUT', body }),
    onSuccess: (settings) => {
      qc.setQueryData(keys.settings, settings);
      qc.invalidateQueries({ queryKey: keys.distance });
      qc.invalidateQueries({ queryKey: keys.moments });
      qc.invalidateQueries({ queryKey: ['cycle'] });
    },
  });
}
```

- [ ] **Step 6: Màn Đăng nhập / Đăng ký**

`mobile/src/features/account/SignInScreen.tsx`:
```tsx
import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { Title } from '@/ui/Title';

export default function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Nhập email và mật khẩu');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Đăng nhập 💞</Title>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextField label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      <ErrorText message={error} />
      <Button title="Đăng nhập" onPress={submit} loading={loading} />
      <Button title="Chưa có tài khoản? Đăng ký" variant="secondary" onPress={() => router.push('/sign-up')} />
    </Screen>
  );
}
```

`mobile/src/features/account/SignUpScreen.tsx`:
```tsx
import { router } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { Title } from '@/ui/Title';

export function validateSignUp(name: string, email: string, password: string, confirm: string): string | null {
  if (!name.trim()) return 'Nhập tên hiển thị';
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Email không hợp lệ';
  if (password.length < 8) return 'Mật khẩu tối thiểu 8 ký tự';
  if (password !== confirm) return 'Mật khẩu nhập lại không khớp';
  return null;
}

export default function SignUpScreen() {
  const { signUp } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const problem = validateSignUp(name, email, password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signUp(email.trim(), password, name.trim());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Tạo tài khoản</Title>
      <TextField label="Tên hiển thị" value={name} onChangeText={setName} />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextField label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry />
      <TextField label="Nhập lại mật khẩu" value={confirm} onChangeText={setConfirm} secureTextEntry />
      <ErrorText message={error} />
      <Button title="Tạo tài khoản" onPress={submit} loading={loading} />
      <Button title="Đã có tài khoản? Đăng nhập" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
```

- [ ] **Step 7: Route + layout gốc**

`mobile/src/app/sign-in.tsx`:
```tsx
export { default } from '@/features/account/SignInScreen';
```

`mobile/src/app/sign-up.tsx`:
```tsx
export { default } from '@/features/account/SignUpScreen';
```

`mobile/src/app/_layout.tsx` (thay toàn bộ):
```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { SessionProvider, useSession } from '@/lib/auth/session';
import { createQueryClient } from '@/lib/query';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootNavigator() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== 'loading') {
      SplashScreen.hideAsync();
    }
  }, [status]);

  if (status === 'loading') {
    return null;
  }
  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
    </Stack>
  );
}
```

`mobile/src/app/(app)/_layout.tsx` (Task 4 sẽ thay):
```tsx
import { Stack } from 'expo-router';

export default function AppLayout() {
  return <Stack />;
}
```

`mobile/src/app/(app)/index.tsx` (Task 5 sẽ xoá khi có tab Trang chủ):
```tsx
import { Text } from 'react-native';

import { useSession } from '@/lib/auth/session';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Title } from '@/ui/Title';

export default function SignedInHome() {
  const { signOut } = useSession();
  return (
    <Screen>
      <Title>Couple App</Title>
      <Text>Bạn đã đăng nhập.</Text>
      <Button title="Đăng xuất" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
```

Run: `rm mobile/src/app/index.tsx`

- [ ] **Step 8: Chạy test + kiểm tra kiểu**

Run: `npm test -- src/features/account && npx tsc --noEmit`
Expected: PASS (7 tests), `tsc` không lỗi.

- [ ] **Step 9: Commit**

```bash
git add -A mobile
git commit -m "feat(mobile): session handling, sign-in/sign-up screens and auth-guarded root layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ghép đôi (mã mời) + layout theo trạng thái cặp đôi

**Files:**
- Create: `mobile/src/features/couple/api.ts`, `mobile/src/features/couple/PairScreen.tsx`, `mobile/src/app/(app)/pair.tsx`
- Replace: `mobile/src/app/(app)/_layout.tsx`
- Test: `mobile/src/features/couple/__tests__/pair-test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError`, `errorMessage`, `keys`, `useSession`, UI kit, `renderWithProviders`, `mockApi`.
- Produces: `useCouple(refetchInterval?: number)` (data `Couple | null`; `COUPLE_REQUIRED` → `null`), `useCreateInvite()`, `useJoinCouple()` (body `{code, startedDatingOn?}`), `useEndCouple()`, `useDistance()`.

- [ ] **Step 1: Viết test (fail)**

`mobile/src/features/couple/__tests__/pair-test.tsx`:
```tsx
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- src/features/couple`
Expected: FAIL.

- [ ] **Step 3: API cặp đôi**

`mobile/src/features/couple/api.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiFetch } from '@/lib/api/client';
import type { Couple, Distance, Invite } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useCouple(refetchInterval?: number) {
  return useQuery({
    queryKey: keys.couple,
    queryFn: async (): Promise<Couple | null> => {
      try {
        return await apiFetch<Couple>('/api/couples/me');
      } catch (e) {
        if (e instanceof ApiError && e.code === 'COUPLE_REQUIRED') return null;
        throw e;
      }
    },
    refetchInterval,
  });
}

export function useCreateInvite() {
  return useMutation({ mutationFn: () => apiFetch<Invite>('/api/couples/invites', { method: 'POST' }) });
}

export function useJoinCouple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; startedDatingOn?: string }) =>
      apiFetch<Couple>('/api/couples/join', { method: 'POST', body }),
    onSuccess: (couple) => {
      qc.setQueryData(keys.couple, couple);
      qc.invalidateQueries({ queryKey: keys.moments });
    },
  });
}

export function useEndCouple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/couples/me/end', { method: 'POST' }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: keys.moments });
      qc.removeQueries({ queryKey: keys.distance });
      qc.removeQueries({ queryKey: ['traits'] });
      qc.setQueryData(keys.couple, null);
    },
  });
}

export function useDistance() {
  return useQuery({ queryKey: keys.distance, queryFn: () => apiFetch<Distance>('/api/couples/distance') });
}
```

- [ ] **Step 4: Màn ghép đôi**

`mobile/src/features/couple/PairScreen.tsx`:
```tsx
import { useState } from 'react';
import { Share, StyleSheet, Text } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import type { Invite } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { formatTime } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useCouple, useCreateInvite, useJoinCouple } from './api';

export default function PairScreen() {
  const { signOut } = useSession();
  const [invite, setInvite] = useState<Invite | null>(null);
  // Đang chờ người ấy nhập mã → hỏi lại server mỗi 5 giây
  useCouple(invite ? 5000 : undefined);
  const createInvite = useCreateInvite();
  const join = useJoinCouple();
  const [code, setCode] = useState('');
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  async function onCreate() {
    setError(null);
    try {
      setInvite(await createInvite.mutateAsync());
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onJoin() {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError('Nhập mã mời');
      return;
    }
    setError(null);
    try {
      await join.mutateAsync(startedOn ? { code: normalized, startedDatingOn: startedOn } : { code: normalized });
      setJoined(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Title>Ghép đôi với người ấy</Title>
      <Card>
        <Text style={styles.heading}>Bạn mời người ấy</Text>
        {invite ? (
          <>
            <Text style={styles.code} selectable>
              {invite.code}
            </Text>
            <Text style={styles.muted}>Hết hạn lúc {formatTime(invite.expiresAt)}</Text>
            <Text style={styles.muted}>Đang chờ người ấy nhập mã…</Text>
            <Button
              title="Gửi mã cho người ấy"
              variant="secondary"
              onPress={() => Share.share({ message: `Mã ghép đôi Couple App của mình: ${invite.code}` })}
            />
          </>
        ) : (
          <Button title="Tạo mã mời" onPress={onCreate} loading={createInvite.isPending} />
        )}
      </Card>
      <Card>
        <Text style={styles.heading}>Người ấy đã gửi mã cho bạn?</Text>
        <TextField label="Mã mời của người ấy" value={code} onChangeText={setCode} autoCapitalize="characters" />
        <DateField label="Ngày bắt đầu yêu (không bắt buộc)" value={startedOn} onChange={setStartedOn} />
        <Button title="Ghép đôi" onPress={onJoin} loading={join.isPending} />
      </Card>
      <ErrorText message={error} />
      {joined && <Text style={styles.success}>Ghép đôi thành công 💞</Text>}
      <Button title="Đăng xuất" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: '600', fontSize: 16, marginBottom: spacing.sm, color: colors.text },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 4, color: colors.primary, textAlign: 'center' },
  muted: { color: colors.muted, textAlign: 'center', marginTop: spacing.xs },
  success: { color: colors.success, fontWeight: '600', textAlign: 'center', marginVertical: spacing.md },
});
```

- [ ] **Step 5: Layout theo trạng thái cặp đôi**

`mobile/src/app/(app)/pair.tsx`:
```tsx
export { default } from '@/features/couple/PairScreen';
```

`mobile/src/app/(app)/_layout.tsx` (thay toàn bộ):
```tsx
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useCouple } from '@/features/couple/api';
import { errorMessage } from '@/lib/api/client';
import { Button } from '@/ui/Button';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';

export default function AppLayout() {
  const couple = useCouple();

  if (couple.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (couple.isError) {
    return (
      <Screen>
        <ErrorText message={errorMessage(couple.error)} />
        <Button title="Thử lại" onPress={() => couple.refetch()} />
      </Screen>
    );
  }

  const paired = couple.data !== null;
  return (
    <Stack screenOptions={{ headerTintColor: colors.primary }}>
      <Stack.Protected guard={paired}>
        <Stack.Screen name="index" options={{ title: 'Couple App' }} />
      </Stack.Protected>
      <Stack.Protected guard={!paired}>
        <Stack.Screen name="pair" options={{ title: 'Ghép đôi' }} />
      </Stack.Protected>
    </Stack>
  );
}
```

- [ ] **Step 6: Chạy test + kiểm tra kiểu**

Run: `npm test -- src/features/couple && npx tsc --noEmit`
Expected: PASS (4 tests), `tsc` không lỗi.

- [ ] **Step 7: Commit**

```bash
git add -A mobile
git commit -m "feat(mobile): invite-code pairing and couple-aware navigation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Tab bar + Trang chủ (ngày bên nhau, khoảng cách, sắp tới)

**Files:**
- Create: `mobile/src/features/moments/api.ts`, `mobile/src/features/moments/occurrence.ts`, `mobile/src/features/moments/labels.ts`
- Create: `mobile/src/features/home/use-location-sync.ts`, `mobile/src/features/home/HomeScreen.tsx`
- Create: `mobile/src/app/(app)/(tabs)/_layout.tsx`, `mobile/src/app/(app)/(tabs)/index.tsx`
- Modify: `mobile/src/app/(app)/_layout.tsx`, `mobile/src/test/setup.ts`
- Delete: `mobile/src/app/(app)/index.tsx`
- Test: `mobile/src/features/moments/__tests__/occurrence-test.ts`, `mobile/src/features/home/__tests__/home-test.tsx`

**Interfaces:**
- Consumes: `useMe`, `useSettings`, `useCouple`, `useDistance`, `apiFetch`, `keys`, format helpers, UI kit.
- Produces:
  - `moments/api.ts`: `useMoments()` (GET `/api/moments` → `Moment[]`).
  - `occurrence.ts`: `nextOccurrence(m: Moment, today: Date): string | null`, `upcomingMoments(list: Moment[], today: Date, limit: number): { moment: Moment; date: string; daysLeft: number }[]` (bỏ qua `CYCLE`).
  - `labels.ts`: `TYPE_LABELS: Record<MomentType, string>`, `CREATABLE_TYPES: MomentType[]`, `OCCASIONS: { code: string; label: string; monthDay: string | null }[]`, `daysLeftLabel(days: number): string`.
  - `use-location-sync.ts`: `useLocationSync(): 'checking' | 'denied' | 'disabled' | 'ok' | 'error'`.
  - Tabs: `(tabs)/_layout.tsx` dùng `Tabs` từ `expo-router/js-tabs`; các task sau thêm `<Tabs.Screen>` của mình.

- [ ] **Step 1: Mock vị trí cho test**

Thêm vào cuối phần `jest.mock` (trước `beforeEach`) trong `mobile/src/test/setup.ts`:
```ts
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    granted: true,
    status: 'granted',
    canAskAgain: true,
    expires: 'never',
  })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 21.0285, longitude: 105.8542, accuracy: 20 },
    timestamp: 0,
  })),
  Accuracy: { Balanced: 3 },
}));
```

- [ ] **Step 2: Viết test (fail)**

`mobile/src/features/moments/__tests__/occurrence-test.ts`:
```ts
import type { Moment } from '@/lib/api/types';
import { nextOccurrence, upcomingMoments } from '@/features/moments/occurrence';

function moment(partial: Partial<Moment>): Moment {
  return {
    id: 'm',
    type: 'CUSTOM',
    title: 'X',
    occursOn: '2026-01-01',
    occursAt: null,
    recurrence: 'NONE',
    subjectUserId: null,
    message: null,
    details: {},
    reminderConfig: null,
    effectiveReminderConfig: { milestoneDays: null, yearly: null, offsets: [], sendAt: '08:00', recipients: 'OWNER' },
    place: null,
    media: [],
    createdBy: 'u1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

const TODAY = new Date(2026, 0, 10);

describe('occurrence', () => {
  test('one-off moments only count when today or later', () => {
    expect(nextOccurrence(moment({ occursOn: '2026-01-10' }), TODAY)).toBe('2026-01-10');
    expect(nextOccurrence(moment({ occursOn: '2026-01-09' }), TODAY)).toBeNull();
  });

  test('yearly moments roll to this or next year', () => {
    expect(nextOccurrence(moment({ occursOn: '2020-03-08', recurrence: 'YEARLY' }), TODAY)).toBe('2026-03-08');
    expect(nextOccurrence(moment({ occursOn: '2020-01-05', recurrence: 'YEARLY' }), TODAY)).toBe('2027-01-05');
  });

  test('anniversaries repeat yearly even without recurrence', () => {
    expect(nextOccurrence(moment({ type: 'ANNIVERSARY', occursOn: '2025-02-14' }), TODAY)).toBe('2026-02-14');
  });

  test('feb29FallsBackToFeb28', () => {
    expect(nextOccurrence(moment({ occursOn: '2024-02-29', recurrence: 'YEARLY' }), TODAY)).toBe('2026-02-28');
  });

  test('a yearly moment that starts in the future waits for its first date', () => {
    expect(nextOccurrence(moment({ occursOn: '2027-06-01', recurrence: 'YEARLY' }), TODAY)).toBe('2027-06-01');
  });

  test('upcomingMoments sorts, skips cycle and limits', () => {
    const list = [
      moment({ id: 'a', occursOn: '2026-05-01' }),
      moment({ id: 'b', occursOn: '2026-01-12' }),
      moment({ id: 'c', type: 'CYCLE', occursOn: '2026-01-11' }),
      moment({ id: 'd', occursOn: '2025-12-01' }),
      moment({ id: 'e', occursOn: '2026-02-01' }),
    ];
    const result = upcomingMoments(list, TODAY, 2);
    expect(result.map((r) => r.moment.id)).toEqual(['b', 'e']);
    expect(result[0].daysLeft).toBe(2);
  });
});
```

`mobile/src/features/home/__tests__/home-test.tsx`:
```tsx
import { screen } from '@testing-library/react-native';
import * as Location from 'expo-location';

import HomeScreen from '@/features/home/HomeScreen';
import { toIsoDate } from '@/lib/format';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

function routes(overrides: Record<string, unknown> = {}) {
  const start = new Date();
  start.setDate(start.getDate() - 100);
  return {
    'GET /api/me': { body: { id: 'u1', email: 'lan@x.vn', displayName: 'Lan', birthday: null, timezone: 'Asia/Ho_Chi_Minh', avatarUrl: null } },
    'GET /api/couples/me': {
      body: { id: 'c1', startedDatingOn: toIsoDate(start), createdAt: '2026-01-01T00:00:00Z', partner: { id: 'u2', displayName: 'Minh' } },
    },
    'GET /api/me/settings': { body: { shareLocation: true, shareCycle: true, cycleLengthDefault: 28, notifyPrefs: {} } },
    'GET /api/couples/distance': {
      body: { distanceKm: 1137.4, me: { updatedAt: new Date().toISOString() }, partner: { updatedAt: new Date().toISOString() } },
    },
    'GET /api/moments': { body: [] },
    'PUT /api/me/location': { status: 204 },
    ...overrides,
  };
}

describe('HomeScreen', () => {
  test('shows names, days together and distance', async () => {
    mockApi(routes());
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Lan ❤ Minh')).toBeOnTheScreen();
    expect(await screen.findByText('100 ngày bên nhau')).toBeOnTheScreen();
    expect(await screen.findByText('1.137 km')).toBeOnTheScreen();
  });

  test('sends current location when permission is granted', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<HomeScreen />);

    await screen.findByText('1.137 km');
    await screen.findByText('Lan ❤ Minh');
    const put = api.calls.find((c) => c.method === 'PUT' && c.path === '/api/me/location');
    expect(put?.body).toEqual({ lat: 21.0285, lng: 105.8542, accuracy: 20 });
  });

  test('showsPermissionHintWhenDenied', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
      status: 'denied',
      canAskAgain: false,
      expires: 'never',
    });
    const api = mockApi(routes({ 'GET /api/couples/distance': { body: { distanceKm: null, me: null, partner: null } } }));
    await renderWithProviders(<HomeScreen />);

    expect(await screen.findByText('Bạn chưa cho phép truy cập vị trí.')).toBeOnTheScreen();
    expect(api.calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  test('explains when partner has not shared location', async () => {
    mockApi(
      routes({
        'GET /api/couples/distance': { body: { distanceKm: null, me: { updatedAt: new Date().toISOString() }, partner: null } },
      }),
    );
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('Người ấy chưa bật chia sẻ vị trí')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npm test -- src/features/moments src/features/home`
Expected: FAIL.

- [ ] **Step 4: Moments — api, mốc ngày, nhãn**

`mobile/src/features/moments/api.ts`:
```ts
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Moment } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useMoments() {
  return useQuery({ queryKey: keys.moments, queryFn: () => apiFetch<Moment[]>('/api/moments') });
}
```

`mobile/src/features/moments/occurrence.ts`:
```ts
import type { Moment } from '@/lib/api/types';
import { daysBetween, parseIsoDate, toIsoDate } from '@/lib/format';

/** Ngày hợp lệ gần nhất: 29/02 ở năm không nhuận → 28/02. */
function safeDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay));
}

/** Lần diễn ra kế tiếp (YYYY-MM-DD) tính từ hôm nay, hoặc null nếu đã qua và không lặp. */
export function nextOccurrence(m: Moment, today: Date): string | null {
  const todayIso = toIsoDate(today);
  const yearly = m.recurrence === 'YEARLY' || m.type === 'ANNIVERSARY';
  if (!yearly) {
    return m.occursOn >= todayIso ? m.occursOn : null;
  }
  if (m.occursOn >= todayIso) {
    return m.occursOn;
  }
  const [, month, day] = m.occursOn.split('-').map(Number);
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const candidate = toIsoDate(safeDate(year, month, day));
    if (candidate >= todayIso) return candidate;
  }
  return null;
}

export function upcomingMoments(list: Moment[], today: Date, limit: number) {
  const todayIso = toIsoDate(today);
  return list
    .filter((m) => m.type !== 'CYCLE')
    .map((m) => ({ moment: m, date: nextOccurrence(m, today) }))
    .filter((x): x is { moment: Moment; date: string } => x.date !== null)
    .map((x) => ({ ...x, daysLeft: daysBetween(todayIso, parseIsoDate(x.date)) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}
```

`mobile/src/features/moments/labels.ts`:
```ts
import type { MomentType } from '@/lib/api/types';

export const TYPE_LABELS: Record<MomentType, string> = {
  ANNIVERSARY: 'Kỷ niệm',
  DATE_PLAN: 'Lịch hẹn',
  GIFT_OCCASION: 'Dịp tặng quà',
  CYCLE: 'Chu kỳ',
  CUSTOM: 'Khác',
};

export const CREATABLE_TYPES: MomentType[] = ['ANNIVERSARY', 'DATE_PLAN', 'GIFT_OCCASION', 'CUSTOM'];

/** Dịp tặng quà gợi ý sẵn; monthDay = MM-DD nếu là ngày cố định hằng năm. */
export const OCCASIONS: { code: string; label: string; monthDay: string | null }[] = [
  { code: 'BIRTHDAY', label: 'Sinh nhật', monthDay: null },
  { code: 'VALENTINE', label: 'Valentine 14/2', monthDay: '02-14' },
  { code: 'WOMENS_DAY_8_3', label: 'Quốc tế Phụ nữ 8/3', monthDay: '03-08' },
  { code: 'WOMENS_DAY_20_10', label: 'Phụ nữ Việt Nam 20/10', monthDay: '10-20' },
  { code: 'CHRISTMAS', label: 'Giáng sinh 24/12', monthDay: '12-24' },
  { code: 'OTHER', label: 'Dịp khác', monthDay: null },
];

export function daysLeftLabel(days: number): string {
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Ngày mai';
  return `Còn ${days} ngày`;
}
```

- [ ] **Step 5: Đồng bộ vị trí + màn Trang chủ**

`mobile/src/features/home/use-location-sync.ts`:
```ts
import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useSettings } from '@/features/account/api';
import { apiFetch } from '@/lib/api/client';
import { keys } from '@/lib/query';

export type LocationStatus = 'checking' | 'denied' | 'disabled' | 'ok' | 'error';

/** Gửi vị trí hiện tại lên server khi mở màn hình và mỗi lần app trở lại foreground. */
export function useLocationSync(): LocationStatus {
  const settings = useSettings();
  const qc = useQueryClient();
  const [status, setStatus] = useState<LocationStatus>('checking');
  const shareLocation = settings.data?.shareLocation;

  useEffect(() => {
    if (shareLocation === undefined) return;
    if (!shareLocation) {
      setStatus('disabled');
      return;
    }
    let cancelled = false;
    const sync = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (!permission.granted) {
        setStatus('denied');
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await apiFetch('/api/me/location', {
          method: 'PUT',
          body: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy ?? undefined,
          },
        });
        if (!cancelled) {
          setStatus('ok');
          qc.invalidateQueries({ queryKey: keys.distance });
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [shareLocation, qc]);

  return status;
}
```

`mobile/src/features/home/HomeScreen.tsx`:
```tsx
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple, useDistance } from '@/features/couple/api';
import { useMoments } from '@/features/moments/api';
import { daysLeftLabel, TYPE_LABELS } from '@/features/moments/labels';
import { upcomingMoments } from '@/features/moments/occurrence';
import { daysBetween, formatDate, formatKm, timeAgo } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { LocationStatus, useLocationSync } from './use-location-sync';

export default function HomeScreen() {
  const me = useMe();
  const couple = useCouple();
  const distance = useDistance();
  const moments = useMoments();
  const location = useLocationSync();
  const today = new Date();
  const upcoming = moments.data ? upcomingMoments(moments.data, today, 3) : [];
  const startedOn = couple.data?.startedDatingOn;

  return (
    <Screen>
      <Card style={styles.hero}>
        <Text style={styles.names}>
          {me.data?.displayName ?? '…'} ❤ {couple.data?.partner.displayName ?? '…'}
        </Text>
        {startedOn ? (
          <Text style={styles.days}>{daysBetween(startedOn, today)} ngày bên nhau</Text>
        ) : (
          <Text style={styles.muted}>Thêm ngày bắt đầu yêu bằng một kỷ niệm "Ngày yêu nhau"</Text>
        )}
      </Card>

      <Card>
        <Title>Khoảng cách</Title>
        <DistanceBody location={location} distance={distance.data} />
      </Card>

      <Card>
        <Title>Sắp tới</Title>
        {upcoming.length === 0 ? (
          <Text style={styles.muted}>Chưa có ngày đặc biệt nào sắp tới.</Text>
        ) : (
          upcoming.map(({ moment, date, daysLeft }) => (
            <Pressable
              key={moment.id}
              accessibilityRole="button"
              onPress={() => router.push(`/moments/${moment.id}`)}
              style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{moment.title}</Text>
                <Text style={styles.muted}>
                  {TYPE_LABELS[moment.type]} · {formatDate(date)}
                </Text>
              </View>
              <Text style={styles.badge}>{daysLeftLabel(daysLeft)}</Text>
            </Pressable>
          ))
        )}
      </Card>
    </Screen>
  );
}

function DistanceBody({
  location,
  distance,
}: {
  location: LocationStatus;
  distance: ReturnType<typeof useDistance>['data'];
}) {
  if (location === 'denied') {
    return (
      <>
        <Text style={styles.muted}>Bạn chưa cho phép truy cập vị trí.</Text>
        <Button title="Mở cài đặt" variant="secondary" onPress={() => Linking.openSettings()} />
      </>
    );
  }
  if (location === 'disabled') {
    return <Text style={styles.muted}>Bạn đang tắt chia sẻ vị trí (bật lại trong Cài đặt).</Text>;
  }
  if (!distance) {
    return <Text style={styles.muted}>Đang tải…</Text>;
  }
  if (distance.distanceKm !== null) {
    return (
      <>
        <Text style={styles.km}>{formatKm(distance.distanceKm)}</Text>
        {distance.partner && <Text style={styles.muted}>Người ấy cập nhật {timeAgo(distance.partner.updatedAt)}</Text>}
      </>
    );
  }
  if (!distance.partner) {
    return <Text style={styles.muted}>Người ấy chưa bật chia sẻ vị trí</Text>;
  }
  return <Text style={styles.muted}>Đang lấy vị trí của bạn…</Text>;
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', backgroundColor: colors.primary, borderColor: colors.primary },
  names: { color: '#fff', fontSize: 22, fontWeight: '700' },
  days: { color: '#fff', fontSize: 16, marginTop: spacing.xs },
  km: { fontSize: 36, fontWeight: '800', color: colors.primary },
  muted: { color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowTitle: { fontWeight: '600', color: colors.text },
  badge: { color: colors.primary, fontWeight: '600' },
});
```

- [ ] **Step 6: Tabs + route Trang chủ**

`mobile/src/app/(app)/(tabs)/_layout.tsx`:
```tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { colors } from '@/ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function tabIcon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerTintColor: colors.text }}>
      <Tabs.Screen name="index" options={{ title: 'Trang chủ', tabBarIcon: tabIcon('heart') }} />
    </Tabs>
  );
}
```

`mobile/src/app/(app)/(tabs)/index.tsx`:
```tsx
export { default } from '@/features/home/HomeScreen';
```

Trong `mobile/src/app/(app)/_layout.tsx` thay dòng:
```tsx
        <Stack.Screen name="index" options={{ title: 'Couple App' }} />
```
bằng:
```tsx
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
```

Run: `rm "mobile/src/app/(app)/index.tsx"`

- [ ] **Step 7: Chạy test + kiểm tra kiểu**

Run: `npm test -- src/features/moments src/features/home && npx tsc --noEmit`
Expected: PASS (10 tests), `tsc` không lỗi.

- [ ] **Step 8: Commit**

```bash
git add -A mobile
git commit -m "feat(mobile): tab bar and home screen with distance and upcoming moments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ảnh — thu nhỏ, upload presigned, filter, camera, dải ảnh

**Files:**
- Create: `mobile/src/features/media/upload.ts`, `filters.ts`, `apply-filter.ts`, `CameraSheet.tsx`, `PhotoStrip.tsx`
- Modify: `mobile/src/test/setup.ts`
- Test: `mobile/src/features/media/__tests__/upload-test.ts`, `mobile/src/features/media/__tests__/filters-test.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError`, `MediaDto`, `UploadUrl`, UI kit.
- Produces:
  - `upload.ts`: `MAX_SIDE = 2048`, `prepareImage(uri): Promise<{ uri; width; height }>` (JPEG 0.85, cạnh dài ≤ 2048), `uploadImage(uri, { purpose?: 'SHARED' | 'AVATAR'; filter?: string | null; takenAt?: string }): Promise<MediaDto>`.
  - `filters.ts`: `type FilterId = 'ORIGINAL' | 'WARM' | 'COOL' | 'VINTAGE' | 'BW'`, `FILTERS: { id: FilterId; label: string; matrix: number[] }[]`, `matrixOf(id): number[]`, `applyMatrix(matrix, rgba: [r,g,b,a]): [r,g,b,a]` (giá trị 0..1).
  - `apply-filter.ts`: `applyFilter(uri, filter: FilterId): Promise<string>` (Skia offscreen → file JPEG trong cache).
  - `CameraSheet({ visible, onClose, onDone(uri, filter) })`, `PhotoStrip({ items, onChange, max? })`, `type PhotoItem = { key; kind: 'remote'; media: MediaDto } | { key; kind: 'local'; uri; filter: FilterId }`.
  - Setup test: mock `@/features/media/CameraSheet` (render `null`), `@/features/media/apply-filter`, `expo-image-picker` (mặc định huỷ chọn).

- [ ] **Step 1: Viết test (fail)**

`mobile/src/features/media/__tests__/filters-test.ts`:
```ts
import { applyMatrix, FILTERS, matrixOf } from '@/features/media/filters';

describe('filters', () => {
  test('every filter has a 4x5 matrix and a Vietnamese label', () => {
    expect(FILTERS.map((f) => f.id)).toEqual(['ORIGINAL', 'WARM', 'COOL', 'VINTAGE', 'BW']);
    FILTERS.forEach((f) => {
      expect(f.matrix).toHaveLength(20);
      expect(f.label.length).toBeGreaterThan(0);
    });
  });

  test('original keeps colors unchanged', () => {
    expect(applyMatrix(matrixOf('ORIGINAL'), [0.2, 0.4, 0.6, 1])).toEqual([0.2, 0.4, 0.6, 1]);
  });

  test('black and white produces equal channels', () => {
    const [r, g, b, a] = applyMatrix(matrixOf('BW'), [0.9, 0.2, 0.1, 1]);
    expect(r).toBeCloseTo(g, 5);
    expect(g).toBeCloseTo(b, 5);
    expect(a).toBe(1);
  });

  test('warm boosts red and lowers blue', () => {
    const [r, , b] = applyMatrix(matrixOf('WARM'), [0.5, 0.5, 0.5, 1]);
    expect(r).toBeGreaterThan(0.5);
    expect(b).toBeLessThan(0.5);
  });

  test('results are clamped to 0..1', () => {
    applyMatrix(matrixOf('VINTAGE'), [1, 1, 1, 1]).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});
```

`mobile/src/features/media/__tests__/upload-test.ts`:
```ts
import { fetch as expoFetch } from 'expo/fetch';
import { ImageManipulator } from 'expo-image-manipulator';

import { prepareImage, uploadImage } from '@/features/media/upload';
import { ApiError } from '@/lib/api/client';
import { mockApi } from '@/test/api-mock';

jest.mock('expo/fetch', () => ({ fetch: jest.fn(async () => ({ ok: true, status: 200 })) }));
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ uri, size: 123456 })),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: jest.fn() },
}));

type Ctx = { resize: jest.Mock; renderAsync: jest.Mock };

/** Lần manipulate đầu trả kích thước gốc; lần sau trả ảnh đã xử lý. */
function setupManipulator(original: { width: number; height: number }, saved: { width: number; height: number }) {
  const contexts: Ctx[] = [];
  (ImageManipulator.manipulate as jest.Mock).mockImplementation(() => {
    const first = contexts.length === 0;
    const ctx: Ctx = {
      resize: jest.fn().mockReturnThis(),
      renderAsync: jest.fn(async () =>
        first
          ? { ...original, saveAsync: jest.fn() }
          : { ...saved, saveAsync: jest.fn(async () => ({ uri: 'file:///cache/out.jpg', ...saved })) },
      ),
    };
    contexts.push(ctx);
    return ctx;
  });
  return contexts;
}

const MEDIA = { id: 'p1', url: 'http://minio/p1.jpg', width: 2048, height: 1536, filter: 'WARM', takenAt: null };

describe('media upload', () => {
  test('downscalesLargeImages', async () => {
    const contexts = setupManipulator({ width: 4000, height: 3000 }, { width: 2048, height: 1536 });

    const result = await prepareImage('file:///camera/big.jpg');

    expect(contexts[1].resize).toHaveBeenCalledWith({ width: 2048, height: 1536 });
    expect(result).toEqual({ uri: 'file:///cache/out.jpg', width: 2048, height: 1536 });
  });

  test('keeps small images at original size', async () => {
    const contexts = setupManipulator({ width: 800, height: 600 }, { width: 800, height: 600 });
    await prepareImage('file:///small.jpg');
    expect(contexts[1].resize).not.toHaveBeenCalled();
  });

  test('requests presigned url, uploads the file and confirms', async () => {
    setupManipulator({ width: 4000, height: 3000 }, { width: 2048, height: 1536 });
    const api = mockApi({
      'POST /api/media/upload-url': {
        status: 201,
        body: { mediaId: 'p1', uploadUrl: 'http://minio/put', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, expiresAt: '' },
      },
      'POST /api/media/p1/confirm': { body: MEDIA },
    });

    const media = await uploadImage('file:///camera/big.jpg', { filter: 'WARM' });

    expect(media).toEqual(MEDIA);
    expect(api.calls[0].body).toEqual({
      contentType: 'image/jpeg',
      sizeBytes: 123456,
      width: 2048,
      height: 1536,
      filter: 'WARM',
      purpose: 'SHARED',
    });
    expect(expoFetch).toHaveBeenCalledWith('http://minio/put', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: { uri: 'file:///cache/out.jpg', size: 123456 },
    });
  });

  test('failed upload does not confirm', async () => {
    setupManipulator({ width: 800, height: 600 }, { width: 800, height: 600 });
    (expoFetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403 });
    const api = mockApi({
      'POST /api/media/upload-url': {
        status: 201,
        body: { mediaId: 'p1', uploadUrl: 'http://minio/put', method: 'PUT', headers: {}, expiresAt: '' },
      },
    });

    const error = await uploadImage('file:///small.jpg').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('UPLOAD_FAILED');
    expect(api.calls.some((c) => c.path.endsWith('/confirm'))).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- src/features/media`
Expected: FAIL.

- [ ] **Step 3: Filter + upload**

`mobile/src/features/media/filters.ts`:
```ts
export type FilterId = 'ORIGINAL' | 'WARM' | 'COOL' | 'VINTAGE' | 'BW';

const IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** Ma trận màu 4x5 (hàng R, G, B, A; cột cuối là độ lệch 0..1) dùng cho Skia ColorMatrix. */
export const FILTERS: { id: FilterId; label: string; matrix: number[] }[] = [
  { id: 'ORIGINAL', label: 'Gốc', matrix: IDENTITY },
  { id: 'WARM', label: 'Ấm', matrix: [1.08, 0, 0, 0, 0.03, 0, 1, 0, 0, 0.01, 0, 0, 0.88, 0, 0, 0, 0, 0, 1, 0] },
  { id: 'COOL', label: 'Lạnh', matrix: [0.9, 0, 0, 0, 0, 0, 1, 0, 0, 0.01, 0, 0, 1.1, 0, 0.03, 0, 0, 0, 1, 0] },
  {
    id: 'VINTAGE',
    label: 'Vintage',
    matrix: [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    id: 'BW',
    label: 'Đen trắng',
    matrix: [0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0],
  },
];

export function matrixOf(id: FilterId): number[] {
  return FILTERS.find((f) => f.id === id)?.matrix ?? IDENTITY;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Áp ma trận lên một điểm ảnh (0..1) — dùng để kiểm thử ma trận. */
export function applyMatrix(m: number[], [r, g, b, a]: [number, number, number, number]): [number, number, number, number] {
  const row = (i: number) => clamp(m[i] * r + m[i + 1] * g + m[i + 2] * b + m[i + 3] * a + m[i + 4]);
  return [row(0), row(5), row(10), row(15)];
}
```

`mobile/src/features/media/upload.ts`:
```ts
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { ApiError, apiFetch } from '@/lib/api/client';
import type { MediaDto, UploadUrl } from '@/lib/api/types';

export const MAX_SIDE = 2048;

export type PreparedImage = { uri: string; width: number; height: number };

/** Thu nhỏ để cạnh dài ≤ 2048px và nén JPEG 0.85. */
export async function prepareImage(uri: string): Promise<PreparedImage> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const scale = Math.min(1, MAX_SIDE / Math.max(original.width, original.height));
  const context = ImageManipulator.manipulate(uri);
  if (scale < 1) {
    context.resize({ width: Math.round(original.width * scale), height: Math.round(original.height * scale) });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export type UploadOptions = { purpose?: 'SHARED' | 'AVATAR'; filter?: string | null; takenAt?: string };

/** Xin presigned URL → PUT file thẳng lên MinIO → xác nhận với backend. */
export async function uploadImage(uri: string, opts: UploadOptions = {}): Promise<MediaDto> {
  const image = await prepareImage(uri);
  const file = new File(image.uri);
  const target = await apiFetch<UploadUrl>('/api/media/upload-url', {
    method: 'POST',
    body: {
      contentType: 'image/jpeg',
      sizeBytes: file.size,
      width: image.width,
      height: image.height,
      filter: opts.filter ?? undefined,
      takenAt: opts.takenAt,
      purpose: opts.purpose ?? 'SHARED',
    },
  });
  const res = await expoFetch(target.uploadUrl, { method: 'PUT', headers: target.headers, body: file });
  if (!res.ok) {
    throw new ApiError(res.status, 'UPLOAD_FAILED', 'Tải ảnh lên thất bại, thử lại nhé');
  }
  return apiFetch<MediaDto>(`/api/media/${target.mediaId}/confirm`, { method: 'POST' });
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npm test -- src/features/media`
Expected: PASS (9 tests).

- [ ] **Step 5: Áp filter bằng Skia, camera, dải ảnh**

`mobile/src/features/media/apply-filter.ts`:
```ts
import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';

import { FilterId, matrixOf } from './filters';

/** Vẽ ảnh qua ma trận màu trên surface offscreen, lưu JPEG vào cache, trả về URI mới. */
export async function applyFilter(uri: string, filter: FilterId): Promise<string> {
  if (filter === 'ORIGINAL') return uri;
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error('Không đọc được ảnh');
  const surface = Skia.Surface.MakeOffscreen(image.width(), image.height());
  if (!surface) throw new Error('Không tạo được bề mặt vẽ');
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrixOf(filter)));
  surface.getCanvas().drawImage(image, 0, 0, paint);
  surface.flush();
  const bytes = surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 90);
  const out = new File(Paths.cache, `filtered-${Date.now()}.jpg`);
  out.create();
  out.write(bytes);
  return out.uri;
}
```

`mobile/src/features/media/CameraSheet.tsx`:
```tsx
import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { colors, spacing } from '@/ui/theme';

import { applyFilter } from './apply-filter';
import { FilterId, FILTERS, matrixOf } from './filters';
import { prepareImage } from './upload';

type Props = { visible: boolean; onClose: () => void; onDone: (uri: string, filter: FilterId) => void };

export function CameraSheet({ visible, onClose, onDone }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [captured, setCaptured] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('ORIGINAL');
  const [busy, setBusy] = useState(false);
  const preview = useImage(captured);
  const { width } = useWindowDimensions();
  const previewHeight = width * (4 / 3);

  function reset() {
    setCaptured(null);
    setFilter('ORIGINAL');
    setBusy(false);
  }

  async function capture() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
    if (photo) setCaptured(photo.uri);
  }

  async function usePhoto() {
    if (!captured) return;
    setBusy(true);
    try {
      const prepared = await prepareImage(captured);
      const out = await applyFilter(prepared.uri, filter);
      onDone(out, filter);
      reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {!permission ? null : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.text}>Cần quyền camera để chụp ảnh kỷ niệm.</Text>
            <Button title="Cho phép camera" onPress={requestPermission} />
            <Button title="Đóng" variant="secondary" onPress={onClose} />
          </View>
        ) : captured ? (
          <>
            <Canvas style={{ width, height: previewHeight }}>
              {preview && (
                <SkiaImage image={preview} x={0} y={0} width={width} height={previewHeight} fit="contain">
                  <ColorMatrix matrix={matrixOf(filter)} />
                </SkiaImage>
              )}
            </Canvas>
            <ScrollView horizontal style={styles.filters} contentContainerStyle={{ padding: spacing.md }}>
              {FILTERS.map((f) => (
                <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
              ))}
            </ScrollView>
            <View style={styles.actions}>
              <Button title="Dùng ảnh này" onPress={usePhoto} loading={busy} />
              <Button title="Chụp lại" variant="secondary" onPress={reset} />
            </View>
          </>
        ) : (
          <>
            <CameraView ref={cameraRef} style={{ width, height: previewHeight }} facing={facing} />
            <View style={styles.actions}>
              <Button title="Chụp" onPress={capture} />
              <Button
                title="Đổi camera"
                variant="secondary"
                onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
              />
              <Button title="Đóng" variant="secondary" onPress={onClose} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingTop: spacing.xl },
  center: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.bg },
  text: { color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  filters: { flexGrow: 0 },
  actions: { padding: spacing.lg, backgroundColor: colors.bg, flex: 1 },
});
```

`mobile/src/features/media/PhotoStrip.tsx`:
```tsx
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MediaDto } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { colors, radius, spacing } from '@/ui/theme';

import { CameraSheet } from './CameraSheet';
import type { FilterId } from './filters';

export type PhotoItem =
  | { key: string; kind: 'remote'; media: MediaDto }
  | { key: string; kind: 'local'; uri: string; filter: FilterId };

let localCounter = 0;
const newKey = () => `local-${Date.now()}-${localCounter++}`;

type Props = { items: PhotoItem[]; onChange: (items: PhotoItem[]) => void; max?: number };

export function PhotoStrip({ items, onChange, max = 30 }: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const remaining = max - items.length;

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (result.canceled) return;
    const added: PhotoItem[] = result.assets.map((a) => ({ key: newKey(), kind: 'local', uri: a.uri, filter: 'ORIGINAL' }));
    onChange([...items, ...added].slice(0, max));
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {items.map((item) => (
          <View key={item.key} style={styles.thumbWrap}>
            <Image source={{ uri: item.kind === 'remote' ? item.media.url : item.uri }} style={styles.thumb} contentFit="cover" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bỏ ảnh"
              onPress={() => onChange(items.filter((x) => x.key !== item.key))}
              style={styles.remove}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      {remaining > 0 && (
        <View style={styles.buttons}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Button title="Chọn từ thư viện" variant="secondary" onPress={pickFromLibrary} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Chụp ảnh" variant="secondary" onPress={() => setCameraOpen(true)} />
          </View>
        </View>
      )}
      <CameraSheet
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDone={(uri, filter) => {
          setCameraOpen(false);
          onChange([...items, { key: newKey(), kind: 'local', uri, filter }]);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumbWrap: { marginRight: spacing.sm, marginBottom: spacing.sm },
  thumb: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: colors.border },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 12 },
  buttons: { flexDirection: 'row' },
});
```

- [ ] **Step 6: Mock module native cho các test màn hình sau**

Thêm vào `mobile/src/test/setup.ts` (trước `beforeEach`):
```ts
jest.mock('@/features/media/CameraSheet', () => ({ CameraSheet: () => null }));
jest.mock('@/features/media/apply-filter', () => ({ applyFilter: jest.fn(async (uri: string) => uri) }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
// Màn hình import gián tiếp upload.ts — mock module native để import không lỗi (upload-test tự mock lại chi tiết)
jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((uri: string) => ({ uri, size: 1 })),
  Paths: { cache: 'file:///cache' },
}));
jest.mock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: jest.fn() } }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn(async () => ({ ok: true, status: 200 })) }));
```

- [ ] **Step 7: Chạy test + kiểm tra kiểu**

Run: `npm test && npx tsc --noEmit`
Expected: PASS toàn bộ, `tsc` không lỗi.

- [ ] **Step 8: Commit**

```bash
git add -A mobile
git commit -m "feat(mobile): photo downscale, presigned upload, skia filters and camera sheet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Kỷ niệm — danh sách, chi tiết, tạo/sửa (loại, dịp tặng quà, giờ hẹn, vị trí, ảnh)

**Files:**
- Modify: `mobile/src/features/moments/api.ts`, `mobile/src/app/(app)/_layout.tsx`, `mobile/src/app/(app)/(tabs)/_layout.tsx`
- Create: `mobile/src/features/moments/form.ts`, `MomentsScreen.tsx`, `MomentFormScreen.tsx`, `NewMomentScreen.tsx`, `EditMomentScreen.tsx`, `MomentDetailScreen.tsx`
- Create: `mobile/src/app/(app)/(tabs)/moments.tsx`, `mobile/src/app/(app)/moments/new.tsx`, `mobile/src/app/(app)/moments/[id]/index.tsx`, `mobile/src/app/(app)/moments/[id]/edit.tsx`
- Test: `mobile/src/features/moments/__tests__/form-test.ts`, `moment-screens-test.tsx`

**Interfaces:**
- Consumes: `useMoments`, `nextOccurrence`, `TYPE_LABELS`, `CREATABLE_TYPES`, `OCCASIONS`, `daysLeftLabel`, `useMe`, `useCouple`, `uploadImage`, `PhotoStrip`/`PhotoItem`, UI kit, format helpers.
- Produces:
  - `api.ts` thêm: `useMoment(id)`, `useMomentReminders(id)`, `useCreateMoment()`, `useUpdateMoment(id)`, `useDeleteMoment()`, `useSetReminderConfig(id)` (body `ReminderConfig | null`).
  - `form.ts`: `type MomentForm`, `emptyForm(today)`, `formFromMoment(m, meId)`, `applyOccasion(form, code, today)`, `validateForm(form): string | null`, `toMomentInput(form, ids: { me; partner }, mediaIds, mode: 'create' | 'edit'): MomentInput`.
  - `MomentFormScreen({ initial?, meId, partnerId })`.

- [ ] **Step 1: Viết test (fail)**

`mobile/src/features/moments/__tests__/form-test.ts`:
```ts
import { applyOccasion, emptyForm, toMomentInput, validateForm } from '@/features/moments/form';
import { toIsoDate } from '@/lib/format';

const TODAY = new Date(2026, 0, 10);
const IDS = { me: 'u1', partner: 'u2' };

describe('moment form', () => {
  test('empty form defaults to an anniversary today', () => {
    const f = emptyForm(TODAY);
    expect(f.type).toBe('ANNIVERSARY');
    expect(f.date).toBe('2026-01-10');
  });

  test('validation messages', () => {
    const base = emptyForm(TODAY);
    expect(validateForm(base)).toBe('Nhập tiêu đề');
    expect(validateForm({ ...base, title: 'Hẹn', type: 'DATE_PLAN' })).toBe('Lịch hẹn cần có giờ');
    expect(validateForm({ ...base, title: 'Quà', type: 'GIFT_OCCASION' })).toBe('Chọn dịp tặng quà');
    expect(validateForm({ ...base, title: 'Quà', type: 'GIFT_OCCASION', occasion: 'BIRTHDAY' })).toBe('Chọn người nhận quà');
    expect(validateForm({ ...base, title: 'Đi chơi', place: { name: ' ', lat: 1, lng: 2 } })).toBe('Đặt tên cho địa điểm');
    expect(validateForm({ ...base, title: 'Ngày yêu' })).toBeNull();
  });

  test('date plan combines date and time', () => {
    const input = toMomentInput(
      { ...emptyForm(TODAY), type: 'DATE_PLAN', title: ' Ăn tối ', date: '2026-03-10', time: '19:30', message: 'Nhà hàng Ý' },
      IDS,
      ['p1'],
      'create',
    );
    expect(input.type).toBe('DATE_PLAN');
    expect(input.title).toBe('Ăn tối');
    expect(input.recurrence).toBe('NONE');
    expect(input.mediaIds).toEqual(['p1']);
    const at = new Date(input.occursAt as string);
    expect(toIsoDate(at)).toBe('2026-03-10');
    expect(at.getHours()).toBe(19);
  });

  test('gift occasion sends subject, occasion and yearly recurrence', () => {
    const input = toMomentInput(
      { ...emptyForm(TODAY), type: 'GIFT_OCCASION', title: 'Sinh nhật Minh', occasion: 'BIRTHDAY', subject: 'partner' },
      IDS,
      [],
      'create',
    );
    expect(input.subjectUserId).toBe('u2');
    expect(input.details).toEqual({ occasion: 'BIRTHDAY' });
    expect(input.recurrence).toBe('YEARLY');
  });

  test('edit mode does not send type', () => {
    const input = toMomentInput({ ...emptyForm(TODAY), title: 'X' }, IDS, [], 'edit');
    expect(input.type).toBeUndefined();
  });

  test('place is sent with trimmed name', () => {
    const input = toMomentInput(
      { ...emptyForm(TODAY), title: 'X', place: { name: ' Hồ Gươm ', lat: 21.02, lng: 105.85 } },
      IDS,
      [],
      'create',
    );
    expect(input.place).toEqual({ name: 'Hồ Gươm', lat: 21.02, lng: 105.85 });
  });

  test('applyOccasion fills a fixed-date occasion for this year', () => {
    const f = applyOccasion({ ...emptyForm(TODAY), type: 'GIFT_OCCASION' }, 'WOMENS_DAY_8_3', TODAY);
    expect(f.occasion).toBe('WOMENS_DAY_8_3');
    expect(f.date).toBe('2026-03-08');
    expect(f.title).toBe('Quốc tế Phụ nữ 8/3');
  });

  test('applyOccasion keeps a custom title', () => {
    const f = applyOccasion({ ...emptyForm(TODAY), type: 'GIFT_OCCASION', title: 'Quà cho em' }, 'VALENTINE', TODAY);
    expect(f.title).toBe('Quà cho em');
  });
});
```

`mobile/src/features/moments/__tests__/moment-screens-test.tsx`:
```tsx
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- src/features/moments`
Expected: FAIL (thiếu `form.ts`, các màn hình).

- [ ] **Step 3: API kỷ niệm (thay toàn bộ `api.ts`)**

`mobile/src/features/moments/api.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Moment, MomentInput, ReminderConfig, ReminderItem } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useMoments() {
  return useQuery({ queryKey: keys.moments, queryFn: () => apiFetch<Moment[]>('/api/moments') });
}

export function useMoment(id: string) {
  return useQuery({ queryKey: keys.moment(id), queryFn: () => apiFetch<Moment>(`/api/moments/${id}`), enabled: !!id });
}

export function useMomentReminders(id: string) {
  return useQuery({
    queryKey: keys.reminders(id),
    queryFn: () => apiFetch<ReminderItem[]>(`/api/moments/${id}/reminders`),
    enabled: !!id,
  });
}

export function useCreateMoment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MomentInput) => apiFetch<Moment>('/api/moments', { method: 'POST', body: input }),
    onSuccess: (m) => {
      qc.setQueryData(keys.moment(m.id), m);
      qc.invalidateQueries({ queryKey: keys.moments, exact: true });
    },
  });
}

export function useUpdateMoment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MomentInput) => apiFetch<Moment>(`/api/moments/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (m) => {
      qc.setQueryData(keys.moment(id), m);
      qc.invalidateQueries({ queryKey: keys.moments, exact: true });
      qc.invalidateQueries({ queryKey: keys.reminders(id) });
    },
  });
}

export function useDeleteMoment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/moments/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: keys.moment(id) });
      qc.invalidateQueries({ queryKey: keys.moments, exact: true });
    },
  });
}

/** `null` = khôi phục cấu hình nhắc mặc định. */
export function useSetReminderConfig(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: ReminderConfig | null) =>
      apiFetch<Moment>(`/api/moments/${id}/reminder-config`, { method: 'PUT', body: config }),
    onSuccess: (m) => {
      qc.setQueryData(keys.moment(id), m);
      qc.invalidateQueries({ queryKey: keys.reminders(id) });
    },
  });
}
```

- [ ] **Step 4: Logic form**

`mobile/src/features/moments/form.ts`:
```ts
import type { Moment, MomentInput, MomentType, PlaceInput } from '@/lib/api/types';
import { combineDateTime, formatTime, toIsoDate } from '@/lib/format';

import { OCCASIONS } from './labels';

export type SubjectChoice = 'me' | 'partner';

export type MomentForm = {
  type: MomentType;
  title: string;
  date: string;
  time: string | null;
  message: string;
  occasion: string | null;
  subject: SubjectChoice | null;
  yearly: boolean;
  place: PlaceInput | null;
};

export function emptyForm(today: Date): MomentForm {
  return {
    type: 'ANNIVERSARY',
    title: '',
    date: toIsoDate(today),
    time: null,
    message: '',
    occasion: null,
    subject: null,
    yearly: false,
    place: null,
  };
}

export function formFromMoment(m: Moment, meId: string): MomentForm {
  return {
    type: m.type,
    title: m.title,
    date: m.occursOn,
    time: m.occursAt ? formatTime(m.occursAt) : null,
    message: m.message ?? '',
    occasion: typeof m.details.occasion === 'string' ? m.details.occasion : null,
    subject: m.subjectUserId ? (m.subjectUserId === meId ? 'me' : 'partner') : null,
    yearly: m.recurrence === 'YEARLY',
    place: null,
  };
}

/** Chọn dịp tặng quà: ngày cố định (8/3, 20/10…) tự điền ngày năm nay; tiêu đề trống thì điền tên dịp. */
export function applyOccasion(form: MomentForm, code: string, today: Date): MomentForm {
  const occasion = OCCASIONS.find((o) => o.code === code);
  if (!occasion) return form;
  return {
    ...form,
    occasion: code,
    title: form.title.trim() ? form.title : occasion.label,
    date: occasion.monthDay ? `${today.getFullYear()}-${occasion.monthDay}` : form.date,
  };
}

export function validateForm(f: MomentForm): string | null {
  if (!f.title.trim()) return 'Nhập tiêu đề';
  if (f.type === 'DATE_PLAN' && !f.time) return 'Lịch hẹn cần có giờ';
  if (f.type === 'GIFT_OCCASION' && !f.occasion) return 'Chọn dịp tặng quà';
  if (f.type === 'GIFT_OCCASION' && !f.subject) return 'Chọn người nhận quà';
  if (f.place && !f.place.name.trim()) return 'Đặt tên cho địa điểm';
  return null;
}

export function toMomentInput(
  f: MomentForm,
  ids: { me: string; partner: string },
  mediaIds: string[],
  mode: 'create' | 'edit',
): MomentInput {
  const input: MomentInput = {
    title: f.title.trim(),
    occursOn: f.date,
    recurrence: f.type === 'GIFT_OCCASION' || (f.type === 'CUSTOM' && f.yearly) ? 'YEARLY' : 'NONE',
    message: f.message.trim(),
    mediaIds,
  };
  if (mode === 'create') {
    input.type = f.type;
  }
  if (f.type === 'DATE_PLAN' && f.time) {
    input.occursAt = combineDateTime(f.date, f.time);
  }
  if ((f.type === 'GIFT_OCCASION' || f.type === 'CUSTOM') && f.subject) {
    input.subjectUserId = f.subject === 'me' ? ids.me : ids.partner;
  }
  if (f.type === 'GIFT_OCCASION' && f.occasion) {
    input.details = { occasion: f.occasion };
  }
  if (f.place) {
    input.place = { ...f.place, name: f.place.name.trim() };
  }
  return input;
}
```

> Lưu ý thứ tự key: test "creating a moment" so sánh object bằng `toEqual` (không phụ thuộc thứ tự key); `message: ''` khi trống vẫn được gửi để xoá lời nhắn khi sửa.

- [ ] **Step 5: Màn hình form, tạo, sửa**

`mobile/src/features/moments/MomentFormScreen.tsx`:
```tsx
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { PhotoItem, PhotoStrip } from '@/features/media/PhotoStrip';
import { uploadImage } from '@/features/media/upload';
import { errorMessage } from '@/lib/api/client';
import type { Moment, MomentType } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';

import { useCreateMoment, useUpdateMoment } from './api';
import { applyOccasion, emptyForm, formFromMoment, MomentForm, toMomentInput, validateForm } from './form';
import { CREATABLE_TYPES, OCCASIONS, TYPE_LABELS } from './labels';

type Props = { initial?: Moment; meId: string; partnerId: string };

export function MomentFormScreen({ initial, meId, partnerId }: Props) {
  const create = useCreateMoment();
  const update = useUpdateMoment(initial?.id ?? '');
  const [form, setForm] = useState<MomentForm>(() => (initial ? formFromMoment(initial, meId) : emptyForm(new Date())));
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    initial ? initial.media.map((m) => ({ key: m.id, kind: 'remote' as const, media: m })) : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = (patch: Partial<MomentForm>) => setForm((f) => ({ ...f, ...patch }));

  async function addCurrentLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Cần quyền vị trí để gắn địa điểm');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      set({ place: { name: '', lat: position.coords.latitude, lng: position.coords.longitude } });
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    const problem = validateForm(form);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const mediaIds: string[] = [];
      for (const p of photos) {
        if (p.kind === 'remote') {
          mediaIds.push(p.media.id);
        } else {
          const media = await uploadImage(p.uri, { filter: p.filter === 'ORIGINAL' ? null : p.filter });
          mediaIds.push(media.id);
        }
      }
      const input = toMomentInput(form, { me: meId, partner: partnerId }, mediaIds, initial ? 'edit' : 'create');
      if (initial) {
        await update.mutateAsync(input);
        router.back();
      } else {
        const created = await create.mutateAsync(input);
        router.replace(`/moments/${created.id}`);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const showSubject = form.type === 'GIFT_OCCASION' || form.type === 'CUSTOM';

  return (
    <Screen>
      {!initial && (
        <View style={styles.chips}>
          {CREATABLE_TYPES.map((t: MomentType) => (
            <Chip key={t} label={TYPE_LABELS[t]} selected={form.type === t} onPress={() => set({ type: t })} />
          ))}
        </View>
      )}

      {form.type === 'GIFT_OCCASION' && (
        <>
          <Text style={styles.label}>Dịp</Text>
          <View style={styles.chips}>
            {OCCASIONS.map((o) => (
              <Chip
                key={o.code}
                label={o.label}
                selected={form.occasion === o.code}
                onPress={() => setForm((f) => applyOccasion(f, o.code, new Date()))}
              />
            ))}
          </View>
        </>
      )}

      {showSubject && (
        <>
          <Text style={styles.label}>{form.type === 'GIFT_OCCASION' ? 'Người nhận quà' : 'Kỷ niệm của ai (không bắt buộc)'}</Text>
          <View style={styles.chips}>
            <Chip label="Tôi" selected={form.subject === 'me'} onPress={() => set({ subject: 'me' })} />
            <Chip label="Người ấy" selected={form.subject === 'partner'} onPress={() => set({ subject: 'partner' })} />
          </View>
        </>
      )}

      <TextField label="Tiêu đề" value={form.title} onChangeText={(title) => set({ title })} />
      <DateField label="Ngày" value={form.date} onChange={(date) => set({ date })} />
      {form.type === 'DATE_PLAN' && (
        <DateField label="Giờ hẹn" mode="time" value={form.time} onChange={(time) => set({ time })} />
      )}
      {form.type === 'CUSTOM' && (
        <View style={styles.switchRow}>
          <Text style={styles.label}>Lặp lại hằng năm</Text>
          <Switch
            accessibilityLabel="Lặp lại hằng năm"
            value={form.yearly}
            onValueChange={(yearly) => set({ yearly })}
            trackColor={{ true: colors.primary }}
          />
        </View>
      )}
      <TextField label="Lời nhắn" value={form.message} onChangeText={(message) => set({ message })} multiline />

      <Card>
        <Text style={styles.label}>Địa điểm</Text>
        {initial?.place && !form.place && <Text style={styles.muted}>📍 {initial.place.name}</Text>}
        {form.place ? (
          <>
            <TextField
              label="Tên địa điểm"
              value={form.place.name}
              onChangeText={(name) => setForm((f) => (f.place ? { ...f, place: { ...f.place, name } } : f))}
            />
            <Button title="Bỏ địa điểm" variant="secondary" onPress={() => set({ place: null })} />
          </>
        ) : (
          <Button title="Gắn vị trí hiện tại" variant="secondary" onPress={addCurrentLocation} loading={locating} />
        )}
      </Card>

      <Card>
        <Text style={styles.label}>Ảnh</Text>
        <PhotoStrip items={photos} onChange={setPhotos} />
      </Card>

      <ErrorText message={error} />
      <Button title="Lưu kỷ niệm" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  label: { color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  muted: { color: colors.muted, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
});
```

`mobile/src/features/moments/NewMomentScreen.tsx`:
```tsx
import { ActivityIndicator } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { colors } from '@/ui/theme';

import { MomentFormScreen } from './MomentFormScreen';

export default function NewMomentScreen() {
  const me = useMe();
  const couple = useCouple();
  if (!me.data || !couple.data) return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;
  return <MomentFormScreen meId={me.data.id} partnerId={couple.data.partner.id} />;
}
```

`mobile/src/features/moments/EditMomentScreen.tsx`:
```tsx
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { colors } from '@/ui/theme';

import { useMoment } from './api';
import { MomentFormScreen } from './MomentFormScreen';

export default function EditMomentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const moment = useMoment(id);
  const me = useMe();
  const couple = useCouple();
  if (!moment.data || !me.data || !couple.data) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;
  }
  return <MomentFormScreen initial={moment.data} meId={me.data.id} partnerId={couple.data.partner.id} />;
}
```

- [ ] **Step 6: Danh sách + chi tiết**

`mobile/src/features/moments/MomentsScreen.tsx`:
```tsx
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Moment } from '@/lib/api/types';
import { daysBetween, formatDate, parseIsoDate, toIsoDate } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useMoments } from './api';
import { daysLeftLabel, TYPE_LABELS } from './labels';
import { nextOccurrence } from './occurrence';

export default function MomentsScreen() {
  const moments = useMoments();
  const today = new Date();
  const todayIso = toIsoDate(today);
  const visible = (moments.data ?? []).filter((m) => m.type !== 'CYCLE');
  const upcoming = visible
    .map((m) => ({ m, date: nextOccurrence(m, today) }))
    .filter((x): x is { m: Moment; date: string } => x.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcomingIds = new Set(upcoming.map((x) => x.m.id));
  const past = visible.filter((m) => !upcomingIds.has(m.id)).sort((a, b) => b.occursOn.localeCompare(a.occursOn));

  return (
    <Screen>
      <Button title="+ Thêm kỷ niệm" onPress={() => router.push('/moments/new')} />
      <Title>Sắp tới</Title>
      {upcoming.length === 0 && <Text style={styles.muted}>Chưa có gì sắp tới.</Text>}
      {upcoming.map(({ m, date }) => (
        <Row key={m.id} moment={m} date={date} badge={daysLeftLabel(daysBetween(todayIso, parseIsoDate(date)))} />
      ))}
      <Title>Đã qua</Title>
      {past.length === 0 && <Text style={styles.muted}>Chưa có kỷ niệm nào.</Text>}
      {past.map((m) => (
        <Row key={m.id} moment={m} date={m.occursOn} />
      ))}
    </Screen>
  );
}

function Row({ moment, date, badge }: { moment: Moment; date: string; badge?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/moments/${moment.id}`)}>
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{moment.title}</Text>
          <Text style={styles.muted}>
            {TYPE_LABELS[moment.type]} · {formatDate(date)}
          </Text>
        </View>
        {badge && <Text style={styles.badge}>{badge}</Text>}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  muted: { color: colors.muted, marginBottom: spacing.sm },
  badge: { color: colors.primary, fontWeight: '700' },
});
```

`mobile/src/features/moments/MomentDetailScreen.tsx`:
```tsx
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import { daysBetween, formatDate, formatDateTime, formatTime, parseIsoDate, toIsoDate } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { colors, radius, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useDeleteMoment, useMoment, useMomentReminders } from './api';
import { daysLeftLabel, TYPE_LABELS } from './labels';
import { nextOccurrence } from './occurrence';

export default function MomentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const moment = useMoment(id);
  const reminders = useMomentReminders(id);
  const remove = useDeleteMoment();

  if (moment.isError) return <Screen><ErrorText message={errorMessage(moment.error)} /></Screen>;
  if (!moment.data) return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;

  const m = moment.data;
  const today = new Date();
  const next = nextOccurrence(m, today);

  function confirmDelete() {
    Alert.alert('Xoá kỷ niệm?', 'Ảnh và nhắc nhở của kỷ niệm này cũng bị xoá.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(m.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Title>{m.title}</Title>
      <Text style={styles.meta}>
        {TYPE_LABELS[m.type]} · {formatDate(m.occursOn)}
        {m.occursAt ? ` · ${formatTime(m.occursAt)}` : ''}
      </Text>
      {next && <Text style={styles.badge}>{daysLeftLabel(daysBetween(toIsoDate(today), parseIsoDate(next)))}</Text>}
      {m.message ? <Text style={styles.message}>{m.message}</Text> : null}
      {m.place && <Text style={styles.meta}>📍 {m.place.name}</Text>}

      {m.media.length > 0 && (
        <ScrollView horizontal style={{ marginVertical: spacing.md }}>
          {m.media.map((p) => (
            <Image key={p.id} source={{ uri: p.url }} style={styles.photo} contentFit="cover" />
          ))}
        </ScrollView>
      )}

      <Card>
        <Text style={styles.heading}>Nhắc nhở sắp tới của bạn</Text>
        {(reminders.data ?? []).slice(0, 3).map((r) => (
          <Text key={r.id} style={styles.reminder}>
            <Text style={styles.reminderTime}>{formatDateTime(r.fireAt)}</Text>
            {'\n'}
            {r.body}
          </Text>
        ))}
        {reminders.data?.length === 0 && <Text style={styles.meta}>Không có nhắc nhở nào cho bạn.</Text>}
        <Button title="Tuỳ chỉnh nhắc nhở" variant="secondary" onPress={() => router.push(`/moments/${m.id}/reminders`)} />
      </Card>

      {m.type !== 'CYCLE' && (
        <>
          <Button title="Sửa kỷ niệm" variant="secondary" onPress={() => router.push(`/moments/${m.id}/edit`)} />
          <Button title="Xoá kỷ niệm" variant="danger" onPress={confirmDelete} loading={remove.isPending} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.muted, marginBottom: spacing.xs },
  badge: { color: colors.primary, fontWeight: '700', marginBottom: spacing.sm },
  message: { color: colors.text, fontSize: 16, marginVertical: spacing.sm },
  photo: { width: 220, height: 220, borderRadius: radius.md, marginRight: spacing.sm, backgroundColor: colors.border },
  heading: { fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  reminder: { color: colors.text, marginBottom: spacing.sm },
  reminderTime: { color: colors.muted, fontSize: 12 },
});
```

- [ ] **Step 7: Route + đăng ký màn hình**

`mobile/src/app/(app)/(tabs)/moments.tsx`:
```tsx
export { default } from '@/features/moments/MomentsScreen';
```

`mobile/src/app/(app)/moments/new.tsx`:
```tsx
export { default } from '@/features/moments/NewMomentScreen';
```

`mobile/src/app/(app)/moments/[id]/index.tsx`:
```tsx
export { default } from '@/features/moments/MomentDetailScreen';
```

`mobile/src/app/(app)/moments/[id]/edit.tsx`:
```tsx
export { default } from '@/features/moments/EditMomentScreen';
```

Trong `mobile/src/app/(app)/(tabs)/_layout.tsx`, ngay sau `<Tabs.Screen name="index" … />` thêm:
```tsx
      <Tabs.Screen name="moments" options={{ title: 'Kỷ niệm', tabBarIcon: tabIcon('images') }} />
```

Trong `mobile/src/app/(app)/_layout.tsx`, ngay sau `<Stack.Screen name="(tabs)" options={{ headerShown: false }} />` thêm:
```tsx
        <Stack.Screen name="moments/new" options={{ title: 'Kỷ niệm mới' }} />
        <Stack.Screen name="moments/[id]/index" options={{ title: 'Kỷ niệm' }} />
        <Stack.Screen name="moments/[id]/edit" options={{ title: 'Sửa kỷ niệm' }} />
```

- [ ] **Step 8: Chạy test + kiểm tra kiểu**

Run: `npm test -- src/features/moments && npx tsc --noEmit`
Expected: PASS (form 8 + màn hình 4 + occurrence 6 = 18 tests), `tsc` không lỗi.

- [ ] **Step 9: Commit**

```bash
git add -A mobile
git commit -m "feat(mobile): moments list, detail and create/edit form with photos and place

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tuỳ chỉnh nhắc nhở

**Files:**
- Create: `mobile/src/features/reminders/audience.ts`, `offsets.ts`, `ReminderConfigScreen.tsx`
- Create: `mobile/src/app/(app)/moments/[id]/reminders.tsx`
- Modify: `mobile/src/app/(app)/_layout.tsx`
- Test: `mobile/src/features/reminders/__tests__/reminders-test.ts`, `reminder-screen-test.tsx`

**Interfaces:**
- Consumes: `useMoment`, `useMomentReminders`, `useSetReminderConfig`, `useMe`, UI kit, `formatDateTime`.
- Produces:
  - `audience.ts`: `type Choice = 'me' | 'partner' | 'both'`, `ownerOf(m: Moment): string`, `toAudience(choice, viewerId, ownerId): Audience`, `fromAudience(audience, viewerId, ownerId): Choice`.
  - `offsets.ts`: `OFFSET_PRESETS: string[]`, `MAX_OFFSETS = 5`, `offsetLabel(iso): string`, `toggleOffset(list, iso): { list: string[]; error: string | null }`, `parseMilestones(text): { days: number[]; error: string | null }`.

- [ ] **Step 1: Viết test (fail)**

`mobile/src/features/reminders/__tests__/reminders-test.ts`:
```ts
import { fromAudience, toAudience } from '@/features/reminders/audience';
import { offsetLabel, parseMilestones, toggleOffset } from '@/features/reminders/offsets';

describe('reminder helpers', () => {
  test('audienceIsRelativeToViewer', () => {
    // Người xem là chủ kỷ niệm
    expect(toAudience('me', 'u1', 'u1')).toBe('OWNER');
    expect(toAudience('partner', 'u1', 'u1')).toBe('PARTNER');
    // Người xem là người còn lại
    expect(toAudience('me', 'u2', 'u1')).toBe('PARTNER');
    expect(toAudience('partner', 'u2', 'u1')).toBe('OWNER');
    expect(toAudience('both', 'u2', 'u1')).toBe('BOTH');

    expect(fromAudience('OWNER', 'u2', 'u1')).toBe('partner');
    expect(fromAudience('PARTNER', 'u2', 'u1')).toBe('me');
    expect(fromAudience('BOTH', 'u1', 'u1')).toBe('both');
  });

  test('offset labels', () => {
    expect(offsetLabel('P0D')).toBe('Đúng ngày');
    expect(offsetLabel('P3D')).toBe('Trước 3 ngày');
    expect(offsetLabel('PT2H')).toBe('Trước 2 giờ');
    expect(offsetLabel('PT30M')).toBe('Trước 30 phút');
  });

  test('toggleOffset adds, removes and limits to 5', () => {
    expect(toggleOffset(['P1D'], 'P7D').list).toEqual(['P7D', 'P1D']);
    expect(toggleOffset(['P7D', 'P1D'], 'P1D').list).toEqual(['P7D']);
    const full = ['P30D', 'P14D', 'P7D', 'P3D', 'P1D'];
    expect(toggleOffset(full, 'P0D')).toEqual({ list: full, error: 'Tối đa 5 lần nhắc' });
  });

  test('parseMilestones validates and sorts', () => {
    expect(parseMilestones('520, 100 999 100')).toEqual({ days: [100, 520, 999], error: null });
    expect(parseMilestones('0, 5').error).toBe('Mốc ngày phải là số nguyên từ 1 đến 36500');
    expect(parseMilestones(Array.from({ length: 21 }, (_, i) => i + 1).join(',')).error).toBe('Tối đa 20 mốc ngày');
  });
});
```

`mobile/src/features/reminders/__tests__/reminder-screen-test.tsx`:
```tsx
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- src/features/reminders`
Expected: FAIL.

- [ ] **Step 3: Logic**

`mobile/src/features/reminders/audience.ts`:
```ts
import type { Audience, Moment } from '@/lib/api/types';

export type Choice = 'me' | 'partner' | 'both';

/** Chủ kỷ niệm theo backend: chủ thể nếu có, ngược lại là người tạo. */
export function ownerOf(m: Moment): string {
  return m.subjectUserId ?? m.createdBy;
}

export function toAudience(choice: Choice, viewerId: string, ownerId: string): Audience {
  if (choice === 'both') return 'BOTH';
  const viewerIsOwner = viewerId === ownerId;
  if (choice === 'me') return viewerIsOwner ? 'OWNER' : 'PARTNER';
  return viewerIsOwner ? 'PARTNER' : 'OWNER';
}

export function fromAudience(audience: Audience, viewerId: string, ownerId: string): Choice {
  if (audience === 'BOTH') return 'both';
  const viewerIsOwner = viewerId === ownerId;
  if (audience === 'OWNER') return viewerIsOwner ? 'me' : 'partner';
  return viewerIsOwner ? 'partner' : 'me';
}
```

`mobile/src/features/reminders/offsets.ts`:
```ts
export const OFFSET_PRESETS = ['P30D', 'P14D', 'P7D', 'P3D', 'P1D', 'P0D', 'PT2H', 'PT1H'];
export const MAX_OFFSETS = 5;

function seconds(iso: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60;
}

export function offsetLabel(iso: string): string {
  const days = /^P(\d+)D$/.exec(iso);
  if (days) return days[1] === '0' ? 'Đúng ngày' : `Trước ${days[1]} ngày`;
  const hours = /^PT(\d+)H$/.exec(iso);
  if (hours) return `Trước ${hours[1]} giờ`;
  const minutes = /^PT(\d+)M$/.exec(iso);
  if (minutes) return `Trước ${minutes[1]} phút`;
  return iso;
}

/** Bật/tắt một mốc nhắc; danh sách sắp xếp từ xa đến gần sự kiện. */
export function toggleOffset(list: string[], iso: string): { list: string[]; error: string | null } {
  if (list.includes(iso)) return { list: list.filter((x) => x !== iso), error: null };
  if (list.length >= MAX_OFFSETS) return { list, error: `Tối đa ${MAX_OFFSETS} lần nhắc` };
  return { list: [...list, iso].sort((a, b) => seconds(b) - seconds(a)), error: null };
}

export function parseMilestones(text: string): { days: number[]; error: string | null } {
  const parts = text.split(/[,\s]+/).filter(Boolean);
  const days = parts.map(Number);
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 36500)) {
    return { days: [], error: 'Mốc ngày phải là số nguyên từ 1 đến 36500' };
  }
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.length > 20) return { days: [], error: 'Tối đa 20 mốc ngày' };
  return { days: unique, error: null };
}
```

- [ ] **Step 4: Màn hình**

`mobile/src/features/reminders/ReminderConfigScreen.tsx`:
```tsx
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useMoment, useMomentReminders, useSetReminderConfig } from '@/features/moments/api';
import { errorMessage } from '@/lib/api/client';
import type { ReminderConfig } from '@/lib/api/types';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';

import { Choice, fromAudience, ownerOf, toAudience } from './audience';
import { OFFSET_PRESETS, offsetLabel, parseMilestones, toggleOffset } from './offsets';

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'me', label: 'Mình' },
  { value: 'partner', label: 'Người ấy' },
  { value: 'both', label: 'Cả hai' },
];

export default function ReminderConfigScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const moment = useMoment(id);
  const me = useMe();
  const reminders = useMomentReminders(id);
  const save = useSetReminderConfig(id);

  const [choice, setChoice] = useState<Choice>('both');
  const [offsets, setOffsets] = useState<string[]>([]);
  const [sendAt, setSendAt] = useState('08:00');
  const [yearly, setYearly] = useState(true);
  const [milestones, setMilestones] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!moment.data || !me.data || ready) return;
    const cfg = moment.data.effectiveReminderConfig;
    setChoice(fromAudience(cfg.recipients ?? 'BOTH', me.data.id, ownerOf(moment.data)));
    setOffsets(cfg.offsets ?? []);
    setSendAt(cfg.sendAt ?? '08:00');
    setYearly(cfg.yearly ?? true);
    setMilestones(cfg.milestoneDays ? cfg.milestoneDays.join(', ') : '');
    setReady(true);
  }, [moment.data, me.data, ready]);

  if (!moment.data || !me.data || !ready) return <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;

  const m = moment.data;
  const isAnniversary = m.type === 'ANNIVERSARY';
  const lockedCycle = m.type === 'CYCLE' && m.subjectUserId !== me.data.id;
  const presets = [...new Set([...OFFSET_PRESETS, ...offsets])];

  async function onSave() {
    const parsed = milestones.trim() ? parseMilestones(milestones) : { days: [], error: null };
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    const config: ReminderConfig = {
      recipients: toAudience(choice, me.data!.id, ownerOf(m)),
      offsets,
      sendAt,
      yearly: isAnniversary ? yearly : null,
      milestoneDays: isAnniversary && milestones.trim() ? parsed.days : null,
    };
    try {
      await save.mutateAsync(config);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onReset() {
    try {
      await save.mutateAsync(null);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>{m.title}</Text>
      {lockedCycle ? (
        <Text style={styles.muted}>Chỉ người có chu kỳ được chỉnh nhắc nhở này.</Text>
      ) : (
        <>
          <Text style={styles.label}>Nhắc cho</Text>
          <View style={styles.chips}>
            {CHOICES.map((c) => (
              <Chip key={c.value} label={c.label} selected={choice === c.value} onPress={() => setChoice(c.value)} />
            ))}
          </View>

          <Text style={styles.label}>Nhắc trước (tối đa 5)</Text>
          <View style={styles.chips}>
            {presets.map((iso) => (
              <Chip
                key={iso}
                label={offsetLabel(iso)}
                selected={offsets.includes(iso)}
                onPress={() => {
                  const next = toggleOffset(offsets, iso);
                  setOffsets(next.list);
                  setError(next.error);
                }}
              />
            ))}
          </View>

          <DateField label="Giờ gửi (với nhắc theo ngày)" mode="time" value={sendAt} onChange={setSendAt} />

          {isAnniversary && (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Nhắc mỗi năm tròn</Text>
                <Switch accessibilityLabel="Nhắc mỗi năm tròn" value={yearly} onValueChange={setYearly} trackColor={{ true: colors.primary }} />
              </View>
              <TextField
                label="Mốc ngày (cách nhau bởi dấu phẩy)"
                value={milestones}
                onChangeText={setMilestones}
                placeholder="Mặc định: 100, 200, 300, 500, 1000, mỗi 500 ngày"
                keyboardType="numbers-and-punctuation"
              />
            </>
          )}

          <ErrorText message={error} />
          <Button title="Lưu" onPress={onSave} loading={save.isPending} />
          <Button title="Khôi phục mặc định" variant="secondary" onPress={onReset} />
        </>
      )}

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.label}>Nhắc nhở sắp tới của bạn</Text>
        {(reminders.data ?? []).map((r) => (
          <Text key={r.id} style={styles.muted}>
            {formatDateTime(r.fireAt)} — {r.body}
          </Text>
        ))}
        {reminders.data?.length === 0 && <Text style={styles.muted}>Không có.</Text>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  label: { color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
  muted: { color: colors.muted, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
});
```

- [ ] **Step 5: Route**

`mobile/src/app/(app)/moments/[id]/reminders.tsx`:
```tsx
export { default } from '@/features/reminders/ReminderConfigScreen';
```

Trong `mobile/src/app/(app)/_layout.tsx`, sau dòng `moments/[id]/edit` thêm:
```tsx
        <Stack.Screen name="moments/[id]/reminders" options={{ title: 'Nhắc nhở' }} />
```

- [ ] **Step 6: Chạy test + kiểm tra kiểu**

Run: `npm test -- src/features/reminders && npx tsc --noEmit`
Expected: PASS (7 tests), `tsc` không lỗi.

- [ ] **Step 7: Commit**

```bash
git add -A mobile
git commit -m "feat(mobile): reminder configuration with viewer-relative recipients

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Chu kỳ

**Files:**
- Create: `mobile/src/features/cycle/api.ts`, `mobile/src/features/cycle/CycleScreen.tsx`, `mobile/src/app/(app)/(tabs)/cycle.tsx`
- Modify: `mobile/src/app/(app)/(tabs)/_layout.tsx`
- Test: `mobile/src/features/cycle/__tests__/cycle-test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError`, `keys`, `useCouple`, `useSettings`, `useUpdateSettings`, `daysLeftLabel`, format helpers, UI kit.
- Produces: `useCycleLogs()`, `usePrediction(userId?: string)` (404 → `null`; không truyền = của mình), `useAddCycleLog()` (body `{periodStart}`), `useDeleteCycleLog()`, `useSetDefaultLength()` (body `{days}`).

- [ ] **Step 1: Viết test (fail)**

`mobile/src/features/cycle/__tests__/cycle-test.tsx`:
```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import CycleScreen from '@/features/cycle/CycleScreen';
import { toIsoDate } from '@/lib/format';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

function routes(overrides: Record<string, unknown> = {}) {
  return {
    'GET /api/couples/me': {
      body: { id: 'c1', startedDatingOn: null, createdAt: '', partner: { id: 'u2', displayName: 'Minh' } },
    },
    'GET /api/me/settings': { body: { shareLocation: true, shareCycle: true, cycleLengthDefault: 28, notifyPrefs: {} } },
    'GET /api/cycles/logs': { body: [{ id: 'l1', periodStart: inDays(-18), periodEnd: null }] },
    'GET /api/cycles/prediction': { body: { nextStart: inDays(10), averageLength: 28, basedOnCycles: 0 } },
    'GET /api/cycles/prediction?userId=u2': { status: 404, body: { code: 'NOT_FOUND', detail: 'Không tìm thấy' } },
    'POST /api/cycles/logs': { status: 201, body: { id: 'l2', periodStart: inDays(0), periodEnd: null } },
    'PUT /api/me/settings': { body: { shareLocation: true, shareCycle: false, cycleLengthDefault: 28, notifyPrefs: {} } },
    'PUT /api/cycles/default-length': { status: 204 },
    ...overrides,
  };
}

describe('CycleScreen', () => {
  test('shows my prediction and a hint when partner has not shared', async () => {
    mockApi(routes());
    await renderWithProviders(<CycleScreen />);

    expect(await screen.findByText(/Kỳ tiếp theo dự kiến/)).toBeOnTheScreen();
    expect(screen.getByText('Còn 10 ngày')).toBeOnTheScreen();
    expect(await screen.findByText('Người ấy chưa chia sẻ hoặc chưa có dữ liệu.')).toBeOnTheScreen();
  });

  test('logging a period start posts today by default', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<CycleScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ghi lại' }));

    await waitFor(() => expect(api.calls.some((c) => c.method === 'POST')).toBe(true));
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({ periodStart: inDays(0) });
  });

  test('turning off sharing updates settings', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<CycleScreen />);

    await fireEvent(await screen.findByRole('switch', { name: 'Chia sẻ với người ấy' }), 'valueChange', false);

    await waitFor(() => expect(api.calls.some((c) => c.method === 'PUT' && c.path === '/api/me/settings')).toBe(true));
    expect(api.calls.find((c) => c.path === '/api/me/settings' && c.method === 'PUT')?.body).toEqual({ shareCycle: false });
  });

  test('default length can be increased when there is not enough data', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<CycleScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Tăng độ dài chu kỳ' }));

    await waitFor(() =>
      expect(api.calls.find((c) => c.path === '/api/cycles/default-length')?.body).toEqual({ days: 29 }),
    );
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- src/features/cycle`
Expected: FAIL.

- [ ] **Step 3: API chu kỳ**

`mobile/src/features/cycle/api.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, apiFetch } from '@/lib/api/client';
import type { CycleLog, Prediction } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useCycleLogs() {
  return useQuery({ queryKey: keys.cycleLogs, queryFn: () => apiFetch<CycleLog[]>('/api/cycles/logs') });
}

/** Không truyền userId = dự đoán của mình. 404 (chưa có dữ liệu / không chia sẻ) → null. */
export function usePrediction(userId?: string, enabled = true) {
  return useQuery({
    queryKey: keys.prediction(userId ?? 'me'),
    queryFn: async (): Promise<Prediction | null> => {
      try {
        return await apiFetch<Prediction>(`/api/cycles/prediction${userId ? `?userId=${userId}` : ''}`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled,
  });
}

function useInvalidateCycle() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['cycle'] });
    qc.invalidateQueries({ queryKey: keys.moments });
  };
}

export function useAddCycleLog() {
  const invalidate = useInvalidateCycle();
  return useMutation({
    mutationFn: (body: { periodStart: string }) => apiFetch<CycleLog>('/api/cycles/logs', { method: 'POST', body }),
    onSuccess: invalidate,
  });
}

export function useDeleteCycleLog() {
  const invalidate = useInvalidateCycle();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/cycles/logs/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSetDefaultLength() {
  const qc = useQueryClient();
  const invalidate = useInvalidateCycle();
  return useMutation({
    mutationFn: (days: number) => apiFetch<void>('/api/cycles/default-length', { method: 'PUT', body: { days } }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: keys.settings });
    },
  });
}
```

- [ ] **Step 4: Màn hình**

`mobile/src/features/cycle/CycleScreen.tsx`:
```tsx
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useSettings, useUpdateSettings } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import { daysLeftLabel } from '@/features/moments/labels';
import { errorMessage } from '@/lib/api/client';
import type { Prediction } from '@/lib/api/types';
import { daysBetween, formatDate, parseIsoDate, toIsoDate } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useAddCycleLog, useCycleLogs, useDeleteCycleLog, usePrediction, useSetDefaultLength } from './api';

export default function CycleScreen() {
  const couple = useCouple();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const logs = useCycleLogs();
  const mine = usePrediction();
  const partnerId = couple.data?.partner.id;
  const partner = usePrediction(partnerId, !!partnerId);
  const add = useAddCycleLog();
  const remove = useDeleteCycleLog();
  const setLength = useSetDefaultLength();
  const [start, setStart] = useState(toIsoDate(new Date()));
  const [error, setError] = useState<string | null>(null);

  const defaultLength = settings.data?.cycleLengthDefault ?? 28;
  const needsDefault = !mine.data || mine.data.basedOnCycles === 0;

  async function logStart() {
    setError(null);
    try {
      await add.mutateAsync({ periodStart: start });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function confirmDelete(id: string, date: string) {
    Alert.alert('Xoá kỳ này?', formatDate(date), [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);
  }

  return (
    <Screen>
      <Card>
        <Title>Chu kỳ của tôi</Title>
        <PredictionText prediction={mine.data} emptyText="Chưa có dữ liệu. Ghi ngày bắt đầu kỳ gần nhất nhé." />
        <DateField label="Ngày bắt đầu kỳ" value={start} onChange={setStart} />
        <Button title="Ghi lại" onPress={logStart} loading={add.isPending} />
        <ErrorText message={error} />

        {needsDefault && (
          <View style={styles.stepper}>
            <Text style={styles.text}>Độ dài chu kỳ mặc định: {defaultLength} ngày</Text>
            <View style={styles.row}>
              <StepButton
                label="Giảm độ dài chu kỳ"
                text="−"
                onPress={() => defaultLength > 20 && setLength.mutate(defaultLength - 1)}
              />
              <StepButton
                label="Tăng độ dài chu kỳ"
                text="+"
                onPress={() => defaultLength < 45 && setLength.mutate(defaultLength + 1)}
              />
            </View>
          </View>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.text}>Chia sẻ với người ấy</Text>
          <Switch
            accessibilityLabel="Chia sẻ với người ấy"
            value={settings.data?.shareCycle ?? true}
            onValueChange={(shareCycle) => updateSettings.mutate({ shareCycle })}
            trackColor={{ true: colors.primary }}
          />
        </View>

        <Text style={styles.label}>Các kỳ đã ghi</Text>
        {(logs.data ?? []).map((log) => (
          <View key={log.id} style={styles.logRow}>
            <Text style={styles.text}>{formatDate(log.periodStart)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Xoá kỳ ${formatDate(log.periodStart)}`}
              onPress={() => confirmDelete(log.id, log.periodStart)}>
              <Text style={styles.delete}>Xoá</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      {couple.data && (
        <Card>
          <Title>Chu kỳ của {couple.data.partner.displayName}</Title>
          <PredictionText prediction={partner.data} emptyText="Người ấy chưa chia sẻ hoặc chưa có dữ liệu." />
        </Card>
      )}
    </Screen>
  );
}

function PredictionText({ prediction, emptyText }: { prediction: Prediction | null | undefined; emptyText: string }) {
  if (!prediction) return <Text style={styles.muted}>{emptyText}</Text>;
  const days = daysBetween(toIsoDate(new Date()), parseIsoDate(prediction.nextStart));
  return (
    <>
      <Text style={styles.text}>Kỳ tiếp theo dự kiến: {formatDate(prediction.nextStart)}</Text>
      <Text style={styles.badge}>{daysLeftLabel(days)}</Text>
      <Text style={styles.muted}>Chu kỳ trung bình {prediction.averageLength} ngày</Text>
    </>
  );
}

function StepButton({ label, text, onPress }: { label: string; text: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.step}>
      <Text style={styles.stepText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text },
  label: { color: colors.text, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs },
  muted: { color: colors.muted, marginBottom: spacing.sm },
  badge: { color: colors.primary, fontWeight: '700', marginVertical: spacing.xs },
  stepper: { marginVertical: spacing.sm },
  row: { flexDirection: 'row', marginTop: spacing.xs },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepText: { color: colors.primary, fontSize: 22, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.sm },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  delete: { color: colors.danger },
});
```

- [ ] **Step 5: Route + tab**

`mobile/src/app/(app)/(tabs)/cycle.tsx`:
```tsx
export { default } from '@/features/cycle/CycleScreen';
```

Trong `mobile/src/app/(app)/(tabs)/_layout.tsx`, sau tab `moments` thêm:
```tsx
      <Tabs.Screen name="cycle" options={{ title: 'Chu kỳ', tabBarIcon: tabIcon('flower') }} />
```

- [ ] **Step 6: Chạy test + kiểm tra kiểu**

Run: `npm test -- src/features/cycle && npx tsc --noEmit`
Expected: PASS (4 tests), `tsc` không lỗi.

- [ ] **Step 7: Commit**

```bash
git add -A mobile
git commit -m "feat(mobile): cycle tracking with prediction, sharing and default length

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Đặc điểm đối phương (size, sở thích, link mua hàng, ghi chú bí mật)

**Files:**
- Create: `mobile/src/features/traits/api.ts`, `editing.ts`, `SizeForm.tsx`, `PreferenceForm.tsx`, `TraitsScreen.tsx`
- Create: `mobile/src/app/(app)/(tabs)/traits.tsx`
- Modify: `mobile/src/app/(app)/(tabs)/_layout.tsx`
- Test: `mobile/src/features/traits/__tests__/editing-test.ts`, `traits-screen-test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `keys`, `useMe`, `useCouple`, UI kit.
- Produces:
  - `api.ts`: `useCatalog()`, `useTraits(userId)`, `useSaveSize(subjectId)` (biến `{ id?: string; body }` → POST/PATCH), `useDeleteSize(subjectId)`, `useSavePreference(subjectId)`, `useDeletePreference(subjectId)`.
  - `editing.ts`: `canEdit(item, meId): boolean`, `type LinkDraft = { url; label; price }`, `linksFromDrafts(drafts): { links: { url; label?; price? }[]; error: string | null }`, `catalogLabel(items, code): string`.

- [ ] **Step 1: Viết test (fail)**

`mobile/src/features/traits/__tests__/editing-test.ts`:
```ts
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
```

`mobile/src/features/traits/__tests__/traits-screen-test.tsx`:
```tsx
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- src/features/traits`
Expected: FAIL.

- [ ] **Step 3: API + helper**

`mobile/src/features/traits/api.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import type { Catalog, Traits } from '@/lib/api/types';
import { keys } from '@/lib/query';

export function useCatalog() {
  return useQuery({ queryKey: keys.catalog, queryFn: () => apiFetch<Catalog>('/api/traits/catalog'), staleTime: Infinity });
}

export function useTraits(userId: string | undefined) {
  return useQuery({
    queryKey: keys.traits(userId ?? ''),
    queryFn: () => apiFetch<Traits>(`/api/traits/${userId}`),
    enabled: !!userId,
  });
}

function useSave(path: 'sizes' | 'preferences', subjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id
        ? apiFetch(`/api/traits/${path}/${id}`, { method: 'PATCH', body })
        : apiFetch(`/api/traits/${path}`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.traits(subjectId) }),
  });
}

function useDelete(path: 'sizes' | 'preferences', subjectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/traits/${path}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.traits(subjectId) }),
  });
}

export const useSaveSize = (subjectId: string) => useSave('sizes', subjectId);
export const useDeleteSize = (subjectId: string) => useDelete('sizes', subjectId);
export const useSavePreference = (subjectId: string) => useSave('preferences', subjectId);
export const useDeletePreference = (subjectId: string) => useDelete('preferences', subjectId);
```

`mobile/src/features/traits/editing.ts`:
```ts
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
```

- [ ] **Step 4: Form size + sở thích**

`mobile/src/features/traits/SizeForm.tsx`:
```tsx
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import type { CatalogItem, SizeEntry } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useDeleteSize, useSaveSize } from './api';

type Props = { subjectUserId: string; meId: string; kinds: CatalogItem[]; initial?: SizeEntry; onClose: () => void };

export function SizeForm({ subjectUserId, meId, kinds, initial, onClose }: Props) {
  const save = useSaveSize(subjectUserId);
  const remove = useDeleteSize(subjectUserId);
  const [kind, setKind] = useState(initial?.kind ?? '');
  const [value, setValue] = useState(initial?.value ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [secret, setSecret] = useState(initial?.visibility === 'AUTHOR_ONLY');
  const [error, setError] = useState<string | null>(null);
  const canSetSecret = subjectUserId !== meId && (!initial || initial.createdBy === meId);

  async function submit() {
    if (!kind || !value.trim()) {
      setError('Chọn loại và nhập size');
      return;
    }
    const body: Record<string, unknown> = { kind, value: value.trim(), note: note.trim() };
    if (canSetSecret) body.visibility = secret ? 'AUTHOR_ONLY' : 'SHARED';
    if (!initial) body.subjectUserId = subjectUserId;
    try {
      await save.mutateAsync({ id: initial?.id, body });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Title>{initial ? 'Sửa size' : 'Thêm size'}</Title>
      <View style={styles.chips}>
        {kinds.map((k) => (
          <Chip key={k.code} label={k.label} selected={kind === k.code} onPress={() => setKind(k.code)} />
        ))}
      </View>
      <TextField label="Size" value={value} onChangeText={setValue} />
      <TextField label="Ghi chú" value={note} onChangeText={setNote} />
      {canSetSecret && (
        <View style={styles.switchRow}>
          <Text style={styles.text}>Giữ bí mật (chỉ mình tôi thấy)</Text>
          <Switch
            accessibilityLabel="Giữ bí mật (chỉ mình tôi thấy)"
            value={secret}
            onValueChange={setSecret}
            trackColor={{ true: colors.primary }}
          />
        </View>
      )}
      <ErrorText message={error} />
      <Button title="Lưu size" onPress={submit} loading={save.isPending} />
      {initial && (
        <Button
          title="Xoá"
          variant="danger"
          onPress={async () => {
            await remove.mutateAsync(initial.id);
            onClose();
          }}
        />
      )}
      <Button title="Đóng" variant="secondary" onPress={onClose} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  text: { color: colors.text, flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
});
```

`mobile/src/features/traits/PreferenceForm.tsx`:
```tsx
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { errorMessage } from '@/lib/api/client';
import type { CatalogItem, Preference } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useDeletePreference, useSavePreference } from './api';
import { LinkDraft, linksFromDrafts } from './editing';

type Props = {
  subjectUserId: string;
  meId: string;
  categories: CatalogItem[];
  initial?: Preference;
  onClose: () => void;
};

export function PreferenceForm({ subjectUserId, meId, categories, initial, onClose }: Props) {
  const save = useSavePreference(subjectUserId);
  const remove = useDeletePreference(subjectUserId);
  const [category, setCategory] = useState(initial?.category ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [links, setLinks] = useState<LinkDraft[]>(
    initial?.links.map((l) => ({ url: l.url, label: l.label ?? '', price: l.price ? String(l.price) : '' })) ?? [],
  );
  const [secret, setSecret] = useState(initial?.visibility === 'AUTHOR_ONLY');
  const [error, setError] = useState<string | null>(null);
  const canSetSecret = subjectUserId !== meId && (!initial || initial.createdBy === meId);

  const updateLink = (index: number, patch: Partial<LinkDraft>) =>
    setLinks((list) => list.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  async function submit() {
    if (!category) {
      setError('Chọn danh mục');
      return;
    }
    const parsed = linksFromDrafts(links);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    const body: Record<string, unknown> = {
      category,
      brand: brand.trim(),
      name: name.trim(),
      color: color.trim(),
      note: note.trim(),
      links: parsed.links,
    };
    if (canSetSecret) body.visibility = secret ? 'AUTHOR_ONLY' : 'SHARED';
    if (!initial) body.subjectUserId = subjectUserId;
    try {
      await save.mutateAsync({ id: initial?.id, body });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      <Title>{initial ? 'Sửa sở thích' : 'Thêm sở thích'}</Title>
      <View style={styles.chips}>
        {categories.map((c) => (
          <Chip key={c.code} label={c.label} selected={category === c.code} onPress={() => setCategory(c.code)} />
        ))}
      </View>
      <TextField label="Hãng" value={brand} onChangeText={setBrand} />
      <TextField label="Tên sản phẩm" value={name} onChangeText={setName} />
      <TextField label="Màu" value={color} onChangeText={setColor} />
      <TextField label="Ghi chú" value={note} onChangeText={setNote} multiline />

      <Text style={styles.label}>Link mua hàng</Text>
      {links.map((link, index) => (
        <Card key={index}>
          <TextField label={`Link ${index + 1}`} value={link.url} onChangeText={(url) => updateLink(index, { url })} autoCapitalize="none" />
          <TextField label={`Tên link ${index + 1}`} value={link.label} onChangeText={(label) => updateLink(index, { label })} placeholder="Shopee, Lazada…" />
          <TextField label={`Giá ${index + 1} (đ)`} value={link.price} onChangeText={(price) => updateLink(index, { price })} keyboardType="number-pad" />
          <Button title="Bỏ link" variant="secondary" onPress={() => setLinks((list) => list.filter((_, i) => i !== index))} />
        </Card>
      ))}
      {links.length < 10 && (
        <Button title="+ Thêm link" variant="secondary" onPress={() => setLinks((list) => [...list, { url: '', label: '', price: '' }])} />
      )}

      {canSetSecret && (
        <View style={styles.switchRow}>
          <Text style={styles.text}>Giữ bí mật (chỉ mình tôi thấy)</Text>
          <Switch
            accessibilityLabel="Giữ bí mật (chỉ mình tôi thấy)"
            value={secret}
            onValueChange={setSecret}
            trackColor={{ true: colors.primary }}
          />
        </View>
      )}
      <ErrorText message={error} />
      <Button title="Lưu sở thích" onPress={submit} loading={save.isPending} />
      {initial && (
        <Button
          title="Xoá"
          variant="danger"
          onPress={async () => {
            await remove.mutateAsync(initial.id);
            onClose();
          }}
        />
      )}
      <Button title="Đóng" variant="secondary" onPress={onClose} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  label: { color: colors.text, fontWeight: '600', marginVertical: spacing.sm },
  text: { color: colors.text, flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
});
```

- [ ] **Step 5: Màn Đặc điểm**

`mobile/src/features/traits/TraitsScreen.tsx`:
```tsx
import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMe } from '@/features/account/api';
import { useCouple } from '@/features/couple/api';
import type { Preference, SizeEntry } from '@/lib/api/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

import { useCatalog, useTraits } from './api';
import { canEdit, catalogLabel } from './editing';
import { PreferenceForm } from './PreferenceForm';
import { SizeForm } from './SizeForm';

type Editing = { kind: 'size'; item?: SizeEntry } | { kind: 'preference'; item?: Preference } | null;

function formatPrice(price: number) {
  return `${String(price).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}đ`;
}

export default function TraitsScreen() {
  const me = useMe();
  const couple = useCouple();
  const catalog = useCatalog();
  const [who, setWho] = useState<'partner' | 'me'>('partner');
  const [editing, setEditing] = useState<Editing>(null);
  const meId = me.data?.id;
  const subjectId = who === 'me' ? meId : couple.data?.partner.id;
  const traits = useTraits(subjectId);
  const sizeKinds = catalog.data?.sizeKinds ?? [];
  const categories = catalog.data?.preferenceCategories ?? [];

  if (!meId || !subjectId) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <View style={styles.chips}>
        <Chip label={couple.data?.partner.displayName ?? 'Người ấy'} selected={who === 'partner'} onPress={() => setWho('partner')} />
        <Chip label="Tôi" selected={who === 'me'} onPress={() => setWho('me')} />
      </View>

      <Title>Size</Title>
      {(traits.data?.sizes ?? []).map((s) => (
        <Pressable key={s.id} disabled={!canEdit(s, meId)} onPress={() => setEditing({ kind: 'size', item: s })}>
          <Card>
            <Text style={styles.item}>
              {catalogLabel(sizeKinds, s.kind)}: {s.value}
            </Text>
            {s.note ? <Text style={styles.muted}>{s.note}</Text> : null}
            {s.visibility === 'AUTHOR_ONLY' && <Text style={styles.secret}>🔒 Bí mật</Text>}
          </Card>
        </Pressable>
      ))}
      <Button title="+ Thêm size" variant="secondary" onPress={() => setEditing({ kind: 'size' })} />

      <Title>Sở thích</Title>
      {(traits.data?.preferences ?? []).map((p) => (
        <Pressable key={p.id} disabled={!canEdit(p, meId)} onPress={() => setEditing({ kind: 'preference', item: p })}>
          <Card>
            <Text style={styles.item}>{catalogLabel(categories, p.category)}</Text>
            <Text style={styles.text}>{[p.brand, p.name, p.color].filter(Boolean).join(' · ')}</Text>
            {p.note ? <Text style={styles.muted}>{p.note}</Text> : null}
            {p.visibility === 'AUTHOR_ONLY' && <Text style={styles.secret}>🔒 Bí mật</Text>}
            {p.links.map((l) => (
              <Pressable
                key={l.id}
                accessibilityRole="button"
                accessibilityLabel={`Mở ${l.label ?? 'link'}`}
                onPress={() => Linking.openURL(l.url)}>
                <Text style={styles.link}>
                  🛒 {l.label ?? l.url}
                  {l.price ? ` — ${formatPrice(l.price)}` : ''}
                </Text>
              </Pressable>
            ))}
          </Card>
        </Pressable>
      ))}
      <Button title="+ Thêm sở thích" variant="secondary" onPress={() => setEditing({ kind: 'preference' })} />

      <Modal visible={editing !== null} animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing?.kind === 'size' && (
          <SizeForm subjectUserId={subjectId} meId={meId} kinds={sizeKinds} initial={editing.item} onClose={() => setEditing(null)} />
        )}
        {editing?.kind === 'preference' && (
          <PreferenceForm
            subjectUserId={subjectId}
            meId={meId}
            categories={categories}
            initial={editing.item}
            onClose={() => setEditing(null)}
          />
        )}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', marginBottom: spacing.md },
  item: { fontWeight: '600', color: colors.text },
  text: { color: colors.text },
  muted: { color: colors.muted },
  secret: { color: colors.primaryDark, marginTop: spacing.xs },
  link: { color: colors.primary, marginTop: spacing.xs },
});
```

- [ ] **Step 6: Route + tab**

`mobile/src/app/(app)/(tabs)/traits.tsx`:
```tsx
export { default } from '@/features/traits/TraitsScreen';
```

Trong `mobile/src/app/(app)/(tabs)/_layout.tsx`, sau tab `cycle` thêm:
```tsx
      <Tabs.Screen name="traits" options={{ title: 'Đặc điểm', tabBarIcon: tabIcon('gift') }} />
```

- [ ] **Step 7: Chạy test + kiểm tra kiểu**

Run: `npm test -- src/features/traits && npx tsc --noEmit`
Expected: PASS (5 tests), `tsc` không lỗi.

- [ ] **Step 8: Commit**

```bash
git add -A mobile
git commit -m "feat(mobile): partner traits with sizes, preferences, shopping links and secret notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Cài đặt + thông báo đẩy

**Files:**
- Create: `mobile/src/lib/push.ts`, `mobile/src/lib/use-push.ts`, `mobile/src/features/settings/SettingsScreen.tsx`, `mobile/src/app/(app)/(tabs)/settings.tsx`
- Modify: `mobile/src/app/(app)/_layout.tsx`, `mobile/src/app/(app)/(tabs)/_layout.tsx`, `mobile/src/test/setup.ts`
- Test: `mobile/src/lib/__tests__/push-test.ts`, `mobile/src/features/settings/__tests__/settings-test.tsx`

**Interfaces:**
- Consumes: `useSession`, `useMe`, `useUpdateMe`, `useSettings`, `useUpdateSettings`, `useCouple`, `useEndCouple`, `uploadImage`, `TYPE_LABELS`, `apiFetch`, UI kit.
- Produces:
  - `push.ts`: `registerForPushAsync(): Promise<string | null>`, `getLastPushToken(): string | null`, `routeForDeepLink(url: unknown): string | null` (`coupleapp://moments/{id}` → `/moments/{id}`, `coupleapp://traits/{id}` → `/traits`, `coupleapp://home` → `/`).
  - `use-push.ts`: `usePushRegistration()` (POST `/api/me/devices`), `useNotificationRouting()` (bấm thông báo → `router.push`).

- [ ] **Step 1: Mock thông báo cho test**

Thêm vào `mobile/src/test/setup.ts` (trước `beforeEach`):
```ts
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  useLastNotificationResponse: jest.fn(() => null),
  AndroidImportance: { MAX: 5 },
}));
jest.mock('expo-device', () => ({ isDevice: true }));
```

- [ ] **Step 2: Viết test (fail)**

`mobile/src/lib/__tests__/push-test.ts`:
```ts
import { getLastPushToken, registerForPushAsync, routeForDeepLink } from '@/lib/push';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'project-123' } } } },
}));

describe('push', () => {
  test('routeForDeepLink maps backend deep links to app routes', () => {
    expect(routeForDeepLink('coupleapp://moments/abc-123')).toBe('/moments/abc-123');
    expect(routeForDeepLink('coupleapp://traits/u2')).toBe('/traits');
    expect(routeForDeepLink('coupleapp://home')).toBe('/');
    expect(routeForDeepLink('https://evil.example/x')).toBeNull();
    expect(routeForDeepLink(undefined)).toBeNull();
  });

  test('registers and remembers the Expo push token', async () => {
    await expect(registerForPushAsync()).resolves.toBe('ExponentPushToken[test]');
    expect(getLastPushToken()).toBe('ExponentPushToken[test]');
  });

  test('returns null on simulators', async () => {
    const device = require('expo-device');
    device.isDevice = false;
    try {
      await expect(registerForPushAsync()).resolves.toBeNull();
    } finally {
      device.isDevice = true;
    }
  });

  test('returns null when permission is denied', async () => {
    const notifications = require('expo-notifications');
    notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await expect(registerForPushAsync()).resolves.toBeNull();
  });
});
```

`mobile/src/features/settings/__tests__/settings-test.tsx`:
```tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SettingsScreen from '@/features/settings/SettingsScreen';
import { mockApi } from '@/test/api-mock';
import { renderWithProviders } from '@/test/render';

const SETTINGS = { shareLocation: true, shareCycle: true, cycleLengthDefault: 28, notifyPrefs: {} };

function routes() {
  return {
    'GET /api/me': { body: { id: 'u1', email: 'lan@x.vn', displayName: 'Lan', birthday: null, timezone: 'Asia/Ho_Chi_Minh', avatarUrl: null } },
    'GET /api/me/settings': { body: SETTINGS },
    'GET /api/couples/me': {
      body: { id: 'c1', startedDatingOn: '2025-02-14', createdAt: '', partner: { id: 'u2', displayName: 'Minh' } },
    },
    'PUT /api/me/settings': (req: { body: unknown }) => ({ body: { ...SETTINGS, ...(req.body as object) } }),
    'PATCH /api/me': (req: { body: unknown }) => ({
      body: { id: 'u1', email: 'lan@x.vn', displayName: 'Lan Anh', birthday: null, timezone: 'Asia/Ho_Chi_Minh', avatarUrl: null, ...(req.body as object) },
    }),
    'POST /api/couples/me/end': { status: 204 },
  };
}

describe('SettingsScreen', () => {
  test('toggling location sharing updates settings', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<SettingsScreen />, { withSession: true });

    await fireEvent(await screen.findByRole('switch', { name: 'Chia sẻ vị trí' }), 'valueChange', false);

    await waitFor(() => expect(api.calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({ shareLocation: false });
  });

  test('turning off date plan notifications sends notifyPrefs', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<SettingsScreen />, { withSession: true });

    await fireEvent(await screen.findByRole('switch', { name: 'Nhắc lịch hẹn' }), 'valueChange', false);

    await waitFor(() => expect(api.calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({ notifyPrefs: { DATE_PLAN: false } });
  });

  test('saving profile patches name', async () => {
    const api = mockApi(routes());
    await renderWithProviders(<SettingsScreen />, { withSession: true });

    await fireEvent.changeText(await screen.findByLabelText('Tên hiển thị'), 'Lan Anh');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu hồ sơ' }));

    await waitFor(() => expect(api.calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(api.calls.find((c) => c.method === 'PATCH')?.body).toEqual({ displayName: 'Lan Anh' });
  });

  test('ending the couple asks for confirmation first', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    const api = mockApi(routes());
    await renderWithProviders(<SettingsScreen />, { withSession: true });

    await fireEvent.press(await screen.findByRole('button', { name: 'Kết thúc cặp đôi' }));

    expect(Alert.alert).toHaveBeenCalled();
    await waitFor(() => expect(api.calls.some((c) => c.path === '/api/couples/me/end')).toBe(true));
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npm test -- src/lib/__tests__/push-test.ts src/features/settings`
Expected: FAIL.

- [ ] **Step 4: Push**

`mobile/src/lib/push.ts`:
```ts
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let lastPushToken: string | null = null;

export function getLastPushToken(): string | null {
  return lastPushToken;
}

/**
 * Xin quyền + lấy Expo push token. Trả null khi chạy simulator, bị từ chối quyền,
 * chưa có EAS projectId (chưa chạy `eas init`) hoặc chạy Expo Go trên Android.
 */
export async function registerForPushAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mặc định',
        importance: Notifications.AndroidImportance.MAX,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    lastPushToken = data;
    return data;
  } catch {
    return null;
  }
}

export function routeForDeepLink(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith('coupleapp://')) return null;
  const path = url.slice('coupleapp://'.length);
  if (path === '' || path === 'home') return '/';
  const moment = /^moments\/([\w-]+)$/.exec(path);
  if (moment) return `/moments/${moment[1]}`;
  if (/^traits\/[\w-]+$/.test(path)) return '/traits';
  return null;
}
```

`mobile/src/lib/use-push.ts`:
```ts
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api/client';

import { registerForPushAsync, routeForDeepLink } from './push';

/** Đăng ký thiết bị nhận push với backend một lần sau khi vào khu vực đã đăng nhập. */
export function usePushRegistration() {
  useEffect(() => {
    let cancelled = false;
    registerForPushAsync().then((token) => {
      if (!token || cancelled) return;
      apiFetch('/api/me/devices', {
        method: 'POST',
        body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      }).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, []);
}

/** Bấm vào thông báo → mở đúng màn hình theo deep link backend gửi kèm (`data.url`). */
export function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const route = routeForDeepLink(response?.notification.request.content.data?.url);
    if (route) router.push(route);
  }, [response]);
}
```

- [ ] **Step 5: Màn Cài đặt**

`mobile/src/features/settings/SettingsScreen.tsx`:
```tsx
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { useMe, useSettings, useUpdateMe, useUpdateSettings } from '@/features/account/api';
import { useCouple, useEndCouple } from '@/features/couple/api';
import { uploadImage } from '@/features/media/upload';
import { apiFetch, errorMessage } from '@/lib/api/client';
import type { MomentType } from '@/lib/api/types';
import { useSession } from '@/lib/auth/session';
import { formatDate } from '@/lib/format';
import { getLastPushToken } from '@/lib/push';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DateField } from '@/ui/DateField';
import { ErrorText } from '@/ui/ErrorText';
import { Screen } from '@/ui/Screen';
import { TextField } from '@/ui/TextField';
import { colors, spacing } from '@/ui/theme';
import { Title } from '@/ui/Title';

const NOTIFY_LABELS: { type: MomentType; label: string }[] = [
  { type: 'ANNIVERSARY', label: 'Nhắc kỷ niệm' },
  { type: 'DATE_PLAN', label: 'Nhắc lịch hẹn' },
  { type: 'GIFT_OCCASION', label: 'Nhắc dịp tặng quà' },
  { type: 'CYCLE', label: 'Nhắc chu kỳ' },
  { type: 'CUSTOM', label: 'Nhắc khác' },
];

export default function SettingsScreen() {
  const { signOut } = useSession();
  const me = useMe();
  const updateMe = useUpdateMe();
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const couple = useCouple();
  const endCouple = useEndCouple();
  const [name, setName] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = name ?? me.data?.displayName ?? '';
  const birthdayValue = birthday ?? me.data?.birthday ?? null;

  async function saveProfile() {
    setError(null);
    const body: { displayName?: string; birthday?: string } = {};
    if (name !== null && name.trim()) body.displayName = name.trim();
    if (birthday !== null) body.birthday = birthday;
    try {
      await updateMe.mutateAsync(body);
      setName(null);
      setBirthday(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function changeAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (result.canceled) return;
    setUploading(true);
    setError(null);
    try {
      const media = await uploadImage(result.assets[0].uri, { purpose: 'AVATAR' });
      await updateMe.mutateAsync({ avatarMediaId: media.id });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  function confirmEndCouple() {
    Alert.alert('Kết thúc cặp đôi?', 'Hai bạn sẽ không còn xem chung kỷ niệm, nhắc nhở sắp tới bị huỷ.', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Kết thúc', style: 'destructive', onPress: () => endCouple.mutate() },
    ]);
  }

  async function handleSignOut() {
    const token = getLastPushToken();
    if (token) {
      await apiFetch(`/api/me/devices?token=${encodeURIComponent(token)}`, { method: 'DELETE' }).catch(() => undefined);
    }
    await signOut();
  }

  const prefs = settings.data?.notifyPrefs ?? {};

  return (
    <Screen>
      <Card>
        <Title>Hồ sơ</Title>
        <View style={styles.avatarRow}>
          {me.data?.avatarUrl ? (
            <Image source={{ uri: me.data.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text style={styles.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Button title="Đổi ảnh đại diện" variant="secondary" onPress={changeAvatar} loading={uploading} />
          </View>
        </View>
        <TextField label="Tên hiển thị" value={displayName} onChangeText={setName} />
        <DateField label="Sinh nhật" value={birthdayValue} onChange={setBirthday} />
        <Button title="Lưu hồ sơ" onPress={saveProfile} loading={updateMe.isPending && !uploading} />
        <ErrorText message={error} />
      </Card>

      <Card>
        <Title>Quyền riêng tư</Title>
        <SettingSwitch
          label="Chia sẻ vị trí"
          value={settings.data?.shareLocation ?? true}
          onChange={(shareLocation) => updateSettings.mutate({ shareLocation })}
        />
        <SettingSwitch
          label="Chia sẻ chu kỳ với người ấy"
          value={settings.data?.shareCycle ?? true}
          onChange={(shareCycle) => updateSettings.mutate({ shareCycle })}
        />
      </Card>

      <Card>
        <Title>Thông báo</Title>
        {NOTIFY_LABELS.map(({ type, label }) => (
          <SettingSwitch
            key={type}
            label={label}
            value={prefs[type] ?? true}
            onChange={(value) => updateSettings.mutate({ notifyPrefs: { [type]: value } })}
          />
        ))}
      </Card>

      {couple.data && (
        <Card>
          <Title>Cặp đôi</Title>
          <Text style={styles.text}>Đang yêu {couple.data.partner.displayName} 💞</Text>
          {couple.data.startedDatingOn && (
            <Text style={styles.muted}>Từ {formatDate(couple.data.startedDatingOn)}</Text>
          )}
          <Button title="Kết thúc cặp đôi" variant="danger" onPress={confirmEndCouple} loading={endCouple.isPending} />
        </Card>
      )}

      <Button title="Đăng xuất" variant="secondary" onPress={handleSignOut} />
    </Screen>
  );
}

function SettingSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.text}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarEmpty: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 26, fontWeight: '700' },
  text: { color: colors.text, flex: 1 },
  muted: { color: colors.muted, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
});
```

- [ ] **Step 6: Route, tab, gắn push vào layout**

`mobile/src/app/(app)/(tabs)/settings.tsx`:
```tsx
export { default } from '@/features/settings/SettingsScreen';
```

Trong `mobile/src/app/(app)/(tabs)/_layout.tsx`, sau tab `traits` thêm:
```tsx
      <Tabs.Screen name="settings" options={{ title: 'Cài đặt', tabBarIcon: tabIcon('settings') }} />
```

Trong `mobile/src/app/(app)/_layout.tsx`:
1. Thêm import: `import { useNotificationRouting, usePushRegistration } from '@/lib/use-push';`
2. Ngay dưới dòng `const couple = useCouple();` (trước mọi `return` sớm) thêm:
```tsx
  usePushRegistration();
  useNotificationRouting();
```

- [ ] **Step 7: Chạy test + kiểm tra kiểu**

Run: `npm test && npx tsc --noEmit`
Expected: PASS toàn bộ, `tsc` không lỗi.

- [ ] **Step 8: Commit**

```bash
git add -A mobile
git commit -m "feat(mobile): settings screen and push notification registration with deep links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Development build (EAS), kiểm tra bundle, tài liệu chạy trên máy thật

**Files:**
- Create: `mobile/eas.json`
- Modify: `mobile/package.json` (thêm `expo-dev-client`), `README.md` (mục Mobile)

**Interfaces:**
- Consumes: toàn bộ app.

- [ ] **Step 1: Cài dev client + cấu hình EAS**

Run (trong `mobile/`): `npx expo install expo-dev-client`
Expected: cài xong.

`mobile/eas.json`:
```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

- [ ] **Step 2: Kiểm tra tự động**

Run (trong `mobile/`):
```bash
npm test
npx tsc --noEmit
npx expo-doctor
npx expo export --platform android --output-dir /tmp/coupleapp-export
```
Expected: test PASS toàn bộ; `tsc` không lỗi; `expo-doctor` không có lỗi nghiêm trọng (cảnh báo về `eas init` chưa chạy là chấp nhận được); `expo export` bundle JS thành công (chứng minh Metro biên dịch được mọi module, kể cả Skia/camera). Xoá thư mục `/tmp/coupleapp-export` sau đó.

- [ ] **Step 3: Tài liệu chạy mobile**

Thêm vào `README.md`, ngay trước mục `## API GĐ1 (tóm tắt)`:
````markdown
## Mobile (Expo)

```bash
cd mobile
cp .env.example .env        # sửa EXPO_PUBLIC_API_URL thành http://<IP-LAN-máy-dev>:8080
npm install
npx expo start              # quét QR bằng Expo Go
npm test                    # unit/screen tests
```

Chạy backend cho điện thoại thật: `APP_STORAGE_PUBLIC_ENDPOINT=http://<IP-LAN>:9000 ./mvnw spring-boot:run`
(để URL ảnh presigned trỏ về IP mà điện thoại truy cập được).

**Expo Go** chạy được mọi thứ trừ **push notification trên Android**. Để nhận push cần development build:

```bash
npx eas-cli@latest login
npx eas-cli@latest init                      # ghi extra.eas.projectId vào app.json
npx eas-cli@latest credentials               # Android: thêm FCM V1 service account (Firebase)
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest device:create             # iOS: đăng ký iPhone (cần Apple Developer 99$/năm)
npx eas-cli@latest build --profile development --platform ios
npx expo start --dev-client
```
````

- [ ] **Step 4: Kiểm thử tay trên 2 máy (Android + iPhone)**

Thực hiện và đánh dấu từng mục; ghi lại mục nào lỗi vào ledger/issue:
1. Hai máy đăng ký 2 tài khoản; máy A tạo mã mời → máy B nhập mã + ngày bắt đầu → cả hai vào Trang chủ, thấy "N ngày bên nhau"; máy A nhận push "Ghép đôi thành công" (dev build).
2. Cấp quyền vị trí trên cả hai → Trang chủ hiển thị khoảng cách; tắt "Chia sẻ vị trí" ở một máy → máy kia thấy "Người ấy chưa bật chia sẻ vị trí".
3. Tạo kỷ niệm có 2 ảnh từ thư viện + 1 ảnh chụp với filter Vintage + gắn vị trí hiện tại → chi tiết hiển thị đủ ảnh (máy kia cũng xem được).
4. Tạo Lịch hẹn có giờ → Tuỳ chỉnh nhắc nhở: chọn "Người ấy", thêm "Trước 1 giờ" → danh sách nhắc sắp tới cập nhật; Khôi phục mặc định hoạt động.
5. Dịp tặng quà 8/3 cho người ấy → máy người tặng thấy nhắc, máy người nhận không thấy.
6. Chu kỳ: ghi 2 kỳ → dự đoán hiển thị ở cả hai máy; tắt chia sẻ → máy kia thấy "Người ấy chưa chia sẻ…".
7. Đặc điểm: thêm size + sở thích bí mật có link Shopee → người kia không thấy mục bí mật; bấm link mở app/trình duyệt.
8. Bấm vào một push nhắc nhở (tạo kỷ niệm "Khác" hôm nay với nhắc "Đúng ngày", chỉnh giờ gửi sớm hơn hiện tại vài phút qua Tuỳ chỉnh nhắc nhở) → mở đúng màn chi tiết kỷ niệm.
9. Đăng xuất → về màn đăng nhập; đăng nhập lại vẫn còn dữ liệu.

- [ ] **Step 5: Commit**

```bash
git add -A mobile README.md
git commit -m "chore(mobile): eas development build config and device setup docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Sau plan này

- GĐ2: bản đồ địa điểm hẹn hò (cần Google Maps API key cho Android) + chọn địa điểm trên bản đồ khi tạo kỷ niệm, ghi chú/vẽ tay gửi đối phương.
- Hoàn thiện phát hành: icon/splash riêng, TestFlight cho iPhone, internal testing trên Google Play.
