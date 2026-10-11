import { configure } from '@testing-library/react-native';

// Màn hình có chuỗi request phụ thuộc nhau (me → couple → dữ liệu) — 1s mặc định dễ chập chờn
configure({ asyncUtilTimeout: 5000 });

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: View };
});

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

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5 },
}));
jest.mock('expo-device', () => ({ __esModule: true, isDevice: true }));

beforeEach(() => {
  (require('expo-secure-store').__store as Map<string, string>).clear();
  jest.clearAllMocks();
});
