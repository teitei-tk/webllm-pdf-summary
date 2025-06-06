/**
 * テストセットアップファイル - 全テストの共通設定
 */
import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

// global fetch をモック
global.fetch = vi.fn();

// clipboard API をモック
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

// writeText をグローバルスパイとして設定
vi.spyOn(navigator.clipboard, 'writeText');

// console.error を抑制（テスト中の不要なログを減らす）
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
