import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vite executes this config in Node; keep the narrow env type without changing app TS globals.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.LOOP_TOWN_BASE || '/Loop_and_Town/') : '/',
  plugins: [react()],
  build: { rollupOptions: { input: { viewer: 'index.html', player: 'player.html' } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
}));
