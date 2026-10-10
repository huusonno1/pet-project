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
