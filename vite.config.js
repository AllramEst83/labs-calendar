import { defineConfig } from 'vite';

const isNetlifyDev = Boolean(process.env.NETLIFY_DEV || process.env.NETLIFY);

export default defineConfig({
  // Serve index.html from the project root
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Netlify Dev proxies non-function traffic to Vite, but POST /api/*
    // requests can miss function redirects — proxy them back to functions.
    proxy: isNetlifyDev
      ? {
          '/api': {
            target: 'http://127.0.0.1:8888',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, '/.netlify/functions'),
          },
        }
      : undefined,
  },
});
