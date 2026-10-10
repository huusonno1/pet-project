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
