#!/bin/bash
set -e

echo "📦 Installing dependencies with npm..."
npm install

echo "🛠 Building Vite client..."
npm run build:client

echo "🔨 Building server (tsc + tsc-alias)..."
npm run build:server