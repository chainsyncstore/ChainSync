import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    _root: 'client',
    _plugins: [react()],
    _build: {
        outDir: '../dist/client',
    },
    _resolve: {
        alias: {
            '@': path.resolve(__dirname, './client/src'),
            '@components': path.resolve(__dirname, './client/src/components'),
            '@shared': path.resolve(__dirname, './shared'),
        },
    },
});
