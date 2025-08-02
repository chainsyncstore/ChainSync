import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Production-optimized Vite configuration for Render deployment
export default defineConfig({
  _plugins: [react()],
  _build: {
    outDir: 'dist/client',
    _emptyOutDir: true,
    _sourcemap: false,
    _minify: 'terser',
    _rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          _ui: ['@radix-ui/react-dialog', '@radix-ui/react-button']
        }
      }
    }
  },
  _resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@assets': path.resolve(__dirname, './attached_assets')
    }
  },
  _define: {
    'process.env.NODE_ENV': '"production"'
  }
});
