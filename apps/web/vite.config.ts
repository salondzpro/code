import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const VENDOR_CHUNKS: Array<[RegExp, string]> = [
  [/[\\/]node_modules[\\/]react-router/, 'router'],
  [/[\\/]node_modules[\\/]@tanstack[\\/]/, 'query'],
  [/[\\/]node_modules[\\/]@supabase[\\/]/, 'supabase'],
  [/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, 'react'],
  [/[\\/]node_modules[\\/]@sentry[\\/]/, 'sentry'],
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Le .env vit à la racine du monorepo
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Port fixe et strict : le front est toujours sur http://localhost:9000, jamais de repli.
  server: { host: true, port: 9000, strictPort: true },
  preview: { host: true, port: 9000, strictPort: true },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          for (const [re, name] of VENDOR_CHUNKS) if (re.test(id)) return name;
          return undefined;
        },
      },
    },
  },
});
