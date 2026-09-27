import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Loop_and_Town/' : '/',
  plugins: [react()],
  build: { rollupOptions: { input: { viewer: 'index.html', player: 'player.html' } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
}));
