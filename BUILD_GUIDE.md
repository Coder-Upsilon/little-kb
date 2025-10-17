# Building Standalone Executables - Little KB

This guide provides step-by-step instructions to build completely standalone executables that customers can run without installing any dependencies (no Node.js, Python, or other tools required).

## Overview

The build process creates self-contained applications for each platform:
- **macOS**: Little KB.app (double-click to run)
- **Windows**: Little KB.exe (double-click to run)
- **Linux**: Little KB.AppImage (double-click to run)

All dependencies (Python runtime, Node.js runtime, backend code, frontend code, and libraries) are bundled inside.

## Prerequisites

### One-Time Setup (Development Machine Only)

You only need these on YOUR machine to build. Customers won't need them:

1. **Node.js 18+** and npm
2. **Python 3.12+**
3. **PyInstaller**: `pip install pyinstaller`
4. **Platform-Specific Build Tools**:
   - **macOS**: Xcode Command Line Tools
   - **Windows**: Visual Studio Build Tools
   - **Linux**: build-essential

## Step-by-Step Build Process

### Step 1: Install Root Dependencies

First time only - install Electron and build tools:

```bash
cd /path/to/little-kb
npm install
```

This installs:
- electron
- electron-builder
- concurrently

### Step 2: Build the Frontend

Build the React frontend into static HTML/JS files:

```bash
cd frontend
npm install  # First time only
npm run build
cd ..
```

This creates `frontend/build/` with all frontend files bundled.

### Step 3: Package the Backend with PyInstaller

Create a standalone Python executable:

```bash
# Install PyInstaller if you haven't
pip install pyinstaller

# Build the backend
pyinstaller backend.spec
```

This creates `backend/dist/backend` (or `backend.exe` on Windows) - a single executable containing:
- Python runtime
- All Python packages (FastAPI, ChromaDB, sentence-transformers, etc.)
- Your backend code
- ML models (if included)

**Important**: This executable is ~400-500MB because it includes:
- Python interpreter
- FastAPI and all dependencies
- ChromaDB vector database
- sentence-transformers ML models

### Step 4: Build Electron Application

Now build the complete desktop app:

#### For macOS (on macOS):
```bash
npm run dist -- --mac
```

Output: `dist/Little KB.dmg` and `dist/mac/Little KB.app`

#### For Windows (on Windows or macOS with Wine):
```bash
npm run dist -- --win
```

Output: `dist/little-kb-setup.exe` (installer) and portable executable

#### For Linux (on Linux or macOS):
```bash
npm run dist -- --linux
```

Output: `dist/little-kb.AppImage`, `.deb`, and `.rpm` packages

#### Build for All Platforms (from macOS):
```bash
npm run dist -- --mac --win --linux
```

## What Gets Bundled

The final application contains:

```
Little KB.app/  (or .exe, .AppImage)
├── Electron Runtime (Node.js included)
├── Frontend (React app compiled to static files)
├── Backend Executable
│   ├── Python runtime
│   ├── FastAPI + all Python dependencies
│   ├── ChromaDB
│   ├── sentence-transformers
│   └── Your backend code
└── Resources
    ├── App icons
    └── Configuration files
```

## Distribution to Customers

### macOS
**File to distribute**: `dist/Little KB.dmg`

**Customer experience**:
1. Download the DMG file
2. Double-click to open
3. Drag "Little KB" to Applications folder
4. Double-click Little KB in Applications to run
5. First run: macOS may ask for permission (right-click → Open)

**Size**: ~600-700MB

### Windows
**File to distribute**: `dist/little-kb-setup.exe`

**Customer experience**:
1. Download the installer
2. Double-click to install
3. Follow installation wizard
4. Launch from Start Menu or Desktop shortcut
5. First run: Windows may show SmartScreen warning (click "More info" → "Run anyway")

**Size**: ~600-700MB installed

### Linux
**File to distribute**: `dist/little-kb.AppImage`

**Customer experience**:
1. Download the AppImage
2. Make it executable: `chmod +x little-kb.AppImage`
3. Double-click to run (or `./little-kb.AppImage`)
4. No installation needed - runs directly

**Alternative formats**:
- `.deb` package for Debian/Ubuntu: `sudo dpkg -i little-kb.deb`
- `.rpm` package for RedHat/Fedora: `sudo rpm -i little-kb.rpm`

**Size**: ~600-700MB

## First Run Experience

When customers first run the app:

1. **App opens immediately** - all dependencies bundled
2. **Backend starts automatically** - takes 5-10 seconds to initialize
3. **Browser-like interface appears** - familiar UI
4. **Data stored locally** in:
   - macOS: `~/Library/Application Support/Little KB/`
   - Windows: `%APPDATA%\Little KB\`
   - Linux: `~/.config/little-kb/`

## Optimizing Build Size (Optional)

To reduce the ~600MB size:

### Option 1: Exclude ML Models from Bundle

Modify `backend.spec`:

```python
# Comment out these lines:
# datas += collect_data_files('sentence_transformers')
# datas += collect_data_files('transformers')
```

Then modify backend to download models on first run. This reduces size to ~200MB but requires internet on first run.

### Option 2: Use Cloud Embeddings

Replace local sentence-transformers with API calls to:
- OpenAI embeddings
- Cohere embeddings
- Other cloud providers

This reduces size significantly but requires API key and internet.

## Testing Built Applications

### Before Distribution

Test on a **clean machine** without Python or Node.js:

1. **macOS**: Test on a Mac without Python/Node installed
2. **Windows**: Test on a Windows VM or clean install
3. **Linux**: Test on a fresh Linux container

### What to Test

- ✅ App launches without errors
- ✅ Backend starts automatically
- ✅ Can create knowledge bases
- ✅ Can upload files
- ✅ Search works correctly
- ✅ MCP servers function
- ✅ App closes cleanly
- ✅ Data persists between runs

## Troubleshooting Build Issues

### PyInstaller Errors

**Issue**: Missing modules in built executable

**Solution**: Add to `hiddenimports` in `backend.spec`:
```python
hiddenimports = [
    'your_missing_module',
    # ... existing imports
]
```

**Issue**: Large build size (>1GB)

**Solution**: Check what's included:
```bash
pyinstaller --log-level=DEBUG backend.spec
```

### Electron Builder Errors

**Issue**: "Cannot find module"

**Solution**: Ensure paths in `package.json` are correct:
```json
"files": [
  "electron/**/*",
  "frontend/build/**/*",
  "backend/dist/**/*"
]
```

**Issue**: Build fails on non-native platform

**Solution**: Install platform-specific build tools or build on native platform

### Runtime Errors

**Issue**: Backend fails to start in built app

**Solution**: 
1. Check logs in app data directory
2. Run backend manually: `./backend/dist/backend`
3. Check for missing dependencies in `backend.spec`

**Issue**: Port conflicts

**Solution**: The app auto-detects available ports (8000-8100 range)

## Code Signing (For Production)

### macOS

Required for distribution outside App Store:

```bash
# Get Developer ID certificate from Apple Developer account
# Set environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"

# Build with signing
npm run dist -- --mac
```

Add to `package.json`:
```json
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (TEAMID)"
    }
  }
}
```

### Windows

Optional but recommended:

1. Purchase code signing certificate
2. Add to `package.json`:
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "your-password"
    }
  }
}
```

## Quick Reference

### Complete Build Commands

```bash
# One-time setup
npm install
cd frontend && npm install && cd ..
pip install pyinstaller

# Build process (run from project root)
cd frontend && npm run build && cd ..
pyinstaller backend.spec
npm run dist

# Output locations
# macOS: dist/Little KB.dmg
# Windows: dist/little-kb-setup.exe
# Linux: dist/little-kb.AppImage
```

### File Sizes

- Development bundle (uncompressed): ~1.5GB
- Final DMG/installer: ~600-700MB
- Installed size: ~800-900MB
- User data: Grows with usage

### Build Times

- Frontend build: 2-5 minutes
- Backend packaging: 5-10 minutes
- Electron build: 5-15 minutes
- **Total**: ~15-30 minutes per platform

## Distribution Checklist

Before sending to customers:

- [ ] Tested on clean machine without dev tools
- [ ] All features work (create KB, upload, search, MCP)
- [ ] App closes cleanly
- [ ] Data persists between runs
- [ ] Signed (macOS) or certificate included (Windows)
- [ ] README/instructions included
- [ ] Version number correct
- [ ] Changelog prepared
- [ ] Support contact provided

## Advanced: Automated Builds

### Using GitHub Actions

Create `.github/workflows/build.yml`:

```yaml
name: Build Standalone Apps

on:
  push:
    tags:
      - 'v*'

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - uses: actions/setup-python@v2
      - run: npm install
      - run: cd frontend && npm install && npm run build
      - run: pip install pyinstaller
      - run: pyinstaller backend.spec
      - run: npm run dist -- --mac
      - uses: actions/upload-artifact@v2
        with:
          name: mac-build
          path: dist/*.dmg

  build-win:
    runs-on: windows-latest
    # Similar steps for Windows

  build-linux:
    runs-on: ubuntu-latest
    # Similar steps for Linux
```

## Summary

**For Developers** (You):
```bash
# Install once
npm install && pip install pyinstaller

# Build for distribution
cd frontend && npm run build && cd ..
pyinstaller backend.spec
npm run dist
```

**For Customers** (Your Users):
- Download: One file (DMG, EXE, or AppImage)
- Install: Drag to Applications / Run installer / Make executable
- Run: Double-click icon
- Requirements: **NONE** - everything bundled!

The standalone executable is completely self-contained. Customers don't need to install anything!
