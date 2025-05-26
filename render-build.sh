#!/bin/bash
# Render build script for ChainSync

# Output each command for debugging
set -x

# Install dependencies
npm ci

# Install essential build tools
npm install typescript ts-node tsc-alias terser --save-dev

# Make sure vite and terser are installed locally and globally for the build
npm install vite@latest terser --save-dev
npm install -g vite terser

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

# Manually compile server code with TypeScript
echo "Compiling server code directly with tsc..."
mkdir -p dist/server

# Run TypeScript compiler directly
./node_modules/.bin/tsc --project tsconfig.server.json

# Run tsc-alias to resolve path aliases
./node_modules/.bin/tsc-alias -p tsconfig.server.json

# Verify server index.js exists
if [ -f "dist/server/index.js" ]; then
  echo "✅ Server build successful - dist/server/index.js exists"
else
  echo "❌ Server build failed - dist/server/index.js not found"
  
  # Fallback: Copy server/index.ts to dist/server and transpile directly
  echo "Attempting fallback compilation method..."
  mkdir -p dist/server
  npx tsc server/index.ts --outDir dist/server --esModuleInterop --module commonjs --target es2020
fi

# Build the client
echo "Building client with explicit npx vite..."
NODE_ENV=production npx vite build

# Double check that the server index.js exists
ls -la dist/server/

# Exit with success
exit 0
