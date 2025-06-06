/**
 * Vitest設定ファイル - テスト環境とセットアップの設定
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
});
