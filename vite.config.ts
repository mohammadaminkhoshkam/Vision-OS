import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devApi } from './dev-api.ts';

export default defineConfig({
  plugins: [react(), devApi()],
  clearScreen: false,
  server: {
    port: 5280,
    strictPort: true,
    // dev only: the browser reaches the local Ollama server through Vite (no CORS)
    proxy: { '/ollama': { target: 'http://127.0.0.1:11434', changeOrigin: true, rewrite: p => p.replace(/^\/ollama/, '') } },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
