import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the repository under /Loop_and_Town/.
  base: command === 'build' ? '/Loop_and_Town/' : '/',
  plugins: [react()],
  // All chapter scripts are bundled on purpose so the game never waits on a fetch.
  build: { chunkSizeWarningLimit: 1200 },
  // The scripts live in the repository's story/ folder.
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 30_000,
  },
}));
