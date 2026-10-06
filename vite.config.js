import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';

// base './' keeps every asset path relative, so the same build works on
// GitHub Pages (served from /jacked-box/, the repo name) and inside a Capacitor app shell.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: './',
    plugins: [
      preact(),
      {
        // The static legal pages read the support contact from here (set VITE_SUPPORT_EMAIL).
        name: 'riffraff-legal-config',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'legal.json',
            source: JSON.stringify({ supportEmail: env.VITE_SUPPORT_EMAIL || '', supportUrl: env.VITE_SUPPORT_URL || '' }),
          });
        },
      },
    ],
    build: {
      target: 'es2020',
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 900,
    },
    server: {
      host: true,
      port: 5173,
    },
  };
});
