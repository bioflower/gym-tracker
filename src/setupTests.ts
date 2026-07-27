import '@testing-library/jest-dom';

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  length: 0,
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` },
});
