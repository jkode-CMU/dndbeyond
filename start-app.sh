#!/bin/bash
# D&D Beyond Desktop - Start Script

echo "Starting D&D Beyond Desktop..."
echo "Loading Cargo environment..."
source "$HOME/.cargo/env"

echo "Starting development server..."
npm run tauri:dev

