#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Install dependencies if node_modules is missing or package.json changed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Environment ready."
