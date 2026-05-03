import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  worker: {
    format: 'es',
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('pdf-lib')) return 'pdf-lib';
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('/docx/')) return 'docx';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
});
