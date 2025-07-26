#!/bin/bash
set -e  # fail immediately on any error

echo "🛠 Building Vite client..."
npm run build:client

echo "🧠 Compiling server TypeScript..."
npm run build:server

echo "✅ Build completed successfully!"