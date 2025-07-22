#!/bin/bash

echo "Starting ChainSync application..."
echo "Stopping any existing processes..."

# Kill existing processes
pkill -f "vite" 2>/dev/null || true
pkill -f "tsx.*server" 2>/dev/null || true

# Start the full server
echo "Starting server on port 5000..."
tsx server/index.ts