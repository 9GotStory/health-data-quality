import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { offlineApp } from './offline/build';

export default defineConfig({
  plugins: [react(), tailwindcss(), offlineApp()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
