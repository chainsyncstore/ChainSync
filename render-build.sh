#!/bin/bash
# Render build script for ChainSync

# Output each command for debugging
set -x

# Install dependencies
npm ci

# Make sure vite is installed locally and globally for the build
npm install vite@latest --save-dev
npm install -g vite

# Create a simple vite.config.js if it doesn't exist
if [ ! -f "vite.config.js" ] && [ ! -f "vite.config.ts" ]; then
  echo "Creating basic vite.config.js file..."
  cat > vite.config.js << EOL
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173
  }
})
EOL
fi

# Build the server portion first (which doesn't depend on vite)
npm run build:server

# Now try to build the client
echo "Building client with explicit npx vite..."
NODE_ENV=production npx vite build

# Exit with success
exit 0
