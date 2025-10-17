#!/bin/bash

# Little KB - Automated Build Script for Standalone Executables
# This script builds completely self-contained applications for distribution

set -e  # Exit on any error

echo "========================================="
echo "Little KB - Standalone Build Script"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+ first.${NC}"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python not found. Please install Python 3.12+ first.${NC}"
    exit 1
fi

if ! command -v pyinstaller &> /dev/null; then
    echo -e "${YELLOW}⚠️  PyInstaller not found. Installing...${NC}"
    # Try uv first (project uses uv), fallback to pip
    if command -v uv &> /dev/null; then
        # uv requires either a venv or --system flag
        cd backend
        if [ -d ".venv" ]; then
            echo "Installing in backend virtual environment..."
            uv pip install pyinstaller
        else
            echo "Creating virtual environment..."
            uv venv
            uv pip install pyinstaller
        fi
        cd ..
    elif command -v pip3 &> /dev/null; then
        pip3 install pyinstaller
    elif command -v pip &> /dev/null; then
        pip install pyinstaller
    else
        echo -e "${RED}❌ No Python package manager found (pip/pip3/uv)${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Step 1: Install root dependencies
echo "========================================="
echo "Step 1: Installing Electron dependencies"
echo "========================================="

if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
    echo -e "${GREEN}✓ Root dependencies installed${NC}"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi
echo ""

# Step 2: Build frontend
echo "========================================="
echo "Step 2: Building React frontend"
echo "========================================="

cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "Building production frontend..."
npm run build

if [ -d "build" ]; then
    echo -e "${GREEN}✓ Frontend built successfully${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

cd ..
echo ""

# Step 3: Package backend
echo "========================================="
echo "Step 3: Packaging Python backend"
echo "========================================="

echo "This may take 5-10 minutes..."

# Run pyinstaller through the virtual environment
if command -v uv &> /dev/null && [ -d "backend/.venv" ]; then
    echo "Running PyInstaller through uv..."
    cd backend
    uv run pyinstaller ../backend.spec
    cd ..
elif [ -f "backend/.venv/bin/pyinstaller" ]; then
    echo "Running PyInstaller from venv..."
    backend/.venv/bin/pyinstaller backend.spec
else
    echo "Running PyInstaller from system..."
    pyinstaller backend.spec
fi

if [ -f "backend/dist/backend" ] || [ -f "backend/dist/backend.exe" ]; then
    echo -e "${GREEN}✓ Backend packaged successfully${NC}"
else
    echo -e "${RED}❌ Backend packaging failed${NC}"
    exit 1
fi
echo ""

# Step 4: Build Electron app
echo "========================================="
echo "Step 4: Building Electron application"
echo "========================================="

# Detect platform and build accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Building for macOS..."
    npm run dist -- --mac
    DIST_FILE="dist/Little KB.dmg"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Building for Linux..."
    npm run dist -- --linux
    DIST_FILE="dist/little-kb.AppImage"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    echo "Building for Windows..."
    npm run dist -- --win
    DIST_FILE="dist/little-kb-setup.exe"
else
    echo "Unknown platform. Building for current platform..."
    npm run dist
fi

echo ""

# Summary
echo "========================================="
echo "✅ BUILD COMPLETE!"
echo "========================================="
echo ""

if [ -d "dist" ]; then
    echo "📦 Distribution files created in: ./dist/"
    echo ""
    echo "Available files:"
    ls -lh dist/ | grep -E '\.(dmg|exe|AppImage|deb|rpm)$' || echo "Check dist/ directory for output files"
    echo ""
    
    echo "🎉 Success! Your standalone application is ready for distribution."
    echo ""
    echo "📋 What to do next:"
    echo "   1. Test the application on a clean machine (without Python/Node.js)"
    echo "   2. Distribute the file to your customers"
    echo "   3. Customers can run it directly - no installation of dependencies needed!"
    echo ""
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "💡 For macOS users:"
        echo "   - Distribute: dist/Little KB.dmg"
        echo "   - Size: ~600-700MB"
        echo "   - Installation: Drag to Applications folder"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "💡 For Linux users:"
        echo "   - Distribute: dist/little-kb.AppImage"
        echo "   - Size: ~600-700MB"  
        echo "   - Installation: Make executable and run"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "💡 For Windows users:"
        echo "   - Distribute: dist/little-kb-setup.exe"
        echo "   - Size: ~600-700MB"
        echo "   - Installation: Run installer"
    fi
else
    echo -e "${RED}❌ Build failed - dist directory not created${NC}"
    exit 1
fi

echo ""
echo "📚 For more details, see BUILD_GUIDE.md"
echo "========================================="
