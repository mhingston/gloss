import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const playgroundDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(playgroundDir, '..');

export default defineConfig({
  plugins: [react()],
  root: playgroundDir,
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  server: {
    port: 6006,
    open: true,
    strictPort: true,
  },
});
