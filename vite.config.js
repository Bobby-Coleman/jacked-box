import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base './' keeps every asset path relative, so the same build works on
// GitHub Pages (served from /jacked-box/) and inside a Capacitor app shell.
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: 5173,
  },
});
