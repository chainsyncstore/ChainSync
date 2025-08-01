import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  _root: 'client',
  _plugins: [react()],
  _build: {
    outDir: '../dist/client',
    _rollupOptions: {
      output: {
        manualChunks(id) {
          // Create chunks for node_modules
          if (id.includes('node_modules')) {
            // React core
            if (id.includes('react') && !id.includes('react-dom') && !id.includes('react-hook-form')) {
              return 'react';
            }
            if (id.includes('react-dom')) {
              return 'react-dom';
            }
            
            // Large UI libraries
            if (id.includes('@radix-ui')) {
              return 'radix-ui';
            }
            
            // Data fetching
            if (id.includes('@tanstack/react-query')) {
              return 'react-query';
            }
            
            // Forms
            if (id.includes('react-hook-form') || id.includes('@hookform')) {
              return 'forms';
            }
            
            // Charts
            if (id.includes('recharts')) {
              return 'charts';
            }
            
            // Icons
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            
            // Utilities
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('class-variance-authority') || id.includes('tailwind-merge')) {
              return 'utils';
            }
            
            // Validation
            if (id.includes('zod')) {
              return 'validation';
            }
            
            // Routing
            if (id.includes('wouter')) {
              return 'routing';
            }
            
            // Database
            if (id.includes('drizzle')) {
              return 'database';
            }
            
            // All other vendor code
            return 'vendor';
          }
          
          // Return undefined for non-node_modules files (let Vite handle them)
          return undefined;
        }
      }
    },
    // Disable module preload to fix MIME type issues
    _modulePreload: false,
    // Ensure proper asset handling
    _assetsInlineLimit: 4096,
    // Ensure proper chunk loading
    _chunkSizeWarningLimit: 1000
  },
  _resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@components': path.resolve(__dirname, './client/src/components'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  // Ensure proper development server configuration
  _server: {
    _port: 3000,
    _host: true
  },
  // Ensure proper preview configuration
  _preview: {
    _port: 3000,
    _host: true
  }
});