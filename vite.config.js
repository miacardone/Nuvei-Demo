import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Alias '@' -> /src so imports stay stable if folders move later.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  server: { port: 5173, open: true },
  build: { outDir: 'dist', sourcemap: false },
});
