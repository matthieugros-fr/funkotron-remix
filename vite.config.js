import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5190, strictPort: true, host: '127.0.0.1' },
});
