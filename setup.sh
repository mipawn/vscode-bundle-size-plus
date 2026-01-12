#!/bin/bash

echo "========================================="
echo "Bundle Size Plus - Quick Start Script"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✓ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

# Build the extension
echo "🔨 Building extension..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✓ Build successful"
echo ""

echo "========================================="
echo "✨ Setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Open this project in VSCode"
echo "2. Press F5 to launch the extension in debug mode"
echo "3. Open a .js, .ts, .vue, or .svelte file with imports"
echo "4. See the bundle sizes appear next to imports!"
echo ""
echo "For more information, see DEVELOPMENT.md"
echo ""
