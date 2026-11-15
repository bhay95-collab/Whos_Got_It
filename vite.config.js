import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// BASE_PATH is set by the deploy workflow to "/<repo-name>/" so renaming the repo never breaks the site.
export default defineConfig({
  base: process.env.BASE_PATH || '/Whos_Got_It/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        hm: resolve(import.meta.dirname, 'hm/index.html'),
        hb: resolve(import.meta.dirname, 'hb/index.html'),
      },
    },
  },
});
