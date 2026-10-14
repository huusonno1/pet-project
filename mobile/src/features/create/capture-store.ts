import { useSyncExternalStore } from 'react';

import type { Composition } from './effects';

export type Capture = Composition & { uris: string[] };

const EMPTY: Capture = { uris: [], effect: 'ORIGINAL', hearts: false, stamp: false, caption: '', date: '' };

let state: Capture = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Ảnh vừa chụp/chọn và chỉnh sửa, dùng chung giữa camera → xem trước → form. */
export const captureStore = {
  get: () => state,
  set(patch: Partial<Capture>) {
    state = { ...state, ...patch };
    emit();
  },
  reset(patch: Partial<Capture> = {}) {
    state = { ...EMPTY, ...patch };
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useCapture(): Capture {
  return useSyncExternalStore(captureStore.subscribe, captureStore.get);
}
