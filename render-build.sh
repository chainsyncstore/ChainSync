#!/bin/bash
# Render build script for ChainSync

# Output each command for debugging
set -x

# Install dependencies
npm ci

# Make sure vite is installed globally for the build
npm install -g vite

# Build the application
npm run build

# Exit with success
exit 0
