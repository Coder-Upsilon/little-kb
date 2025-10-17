# Little KB - Electron Desktop Application

This guide covers building and distributing Little KB as a self-contained desktop application for macOS, Windows, and Linux.

## Prerequisites

### All Platforms
- Node.js 18+ and npm
- Git

### Platform-Specific Requirements

#### macOS
- Xcode Command Line Tools
- For code signing: Apple Developer account

#### Windows
- Visual Studio Build Tools or Visual Studio Community
- For code signing: Code signing certificate (optional)

#### Linux
- Build essentials: `sudo apt-get install build-essential`

### Python Backend Packaging
- Python 3.12+
- PyInstaller: `pip install pyinstaller`
- uv package manager

## Development Setup

1. **Clone the repository:**
```bash
git clone https://github.com/Coder-Upsilon/little-kb.git
cd little-kb
```

2. **Install root dependencies:**
```bash
npm install
```

3. **Install frontend dependencies:**
```bash
cd frontend
npm install
cd ..
```

4. **Install backend dependencies:**
```bash
cd backend
uv sync
cd ..
```

## Development Mode

Run the application in development mode with hot reloading:

```bash
npm run dev
```

This will:
- Start the Python backend using uv
- Start the Electron app in development mode
- Load the React frontend from the development server (localhost:3000)
- Open DevTools automatically

## Building for Distribution

### Step 1: Build Frontend

```bash
cd frontend
npm run build
cd ..
```

This creates an optimized production build in `frontend/build/`.

### Step 2: Package Backend with PyInstaller

```bash
# Make sure you have PyInstaller installed
pip install pyinstaller

# Build the backend executable
pyinstaller backend.spec
```

This creates a standalone backend executable in `backend/dist/`.

**Important Notes:**
- The backend package will be large (~400-500MB) due to ML models (sentence-transformers)
- First run will download the embedding model automatically
- Models are cached in the app data directory

### Step 3: Build Electron App

#### Build for Current Platform
```bash
npm run build
```

#### Build for Specific Platforms

**macOS:**
```bash
npm run dist -- --mac
```

**Windows:**
```bash
npm run dist -- --win
```

**Linux:**
```bash
npm run dist -- --linux
```

#### Build for Multiple Platforms (from macOS)
```bash
# Build for all platforms
npm run dist -- --mac --win --linux
```

### Output

Built applications will be in the `dist/` directory:

**macOS:**
- `Little KB.dmg` - Installer
- `Little KB.app` - Application bundle

**Windows:**
- `little-kb-setup.exe` - NSIS installer
- `Little KB.exe` - Portable executable

**Linux:**
- `little-kb.AppImage` - AppImage format
- `little-kb.deb` - Debian package
- `little-kb.rpm` - RPM package

## Application Structure

```
little-kb/
├── electron/              # Electron main process
│   ├── main.js           # Main process entry point
│   └── preload.js        # Preload script for IPC
├── frontend/             # React frontend
│   ├── src/
│   └── build/            # Production build (generated)
├── backend/              # Python FastAPI backend
│   ├── dist/             # PyInstaller output (generated)
│   └── ...
├── resources/            # App icons and resources
├── dist/                 # Final electron builds (generated)
├── package.json          # Root package.json for Electron
├── backend.spec          # PyInstaller configuration
└── ELECTRON_README.md    # This file
```

## Data Storage Locations

The app stores data in platform-appropriate locations:

**macOS:**
```
~/Library/Application Support/Little KB/
├── knowledge-bases/
├── vector-db/
├── logs/
├── temp_mcp_scripts/
└── config.json
```

**Windows:**
```
%APPDATA%\Little KB\
├── knowledge-bases\
├── vector-db\
├── logs\
├── temp_mcp_scripts\
└── config.json
```

**Linux:**
```
~/.config/little-kb/
├── knowledge-bases/
├── vector-db/
├── logs/
├── temp_mcp_scripts/
└── config.json
```

## Code Signing

### macOS Code Signing

1. **Get Apple Developer Certificate:**
   - Enroll in Apple Developer Program ($99/year)
   - Create a Developer ID Application certificate
   - Download and install in Keychain

2. **Configure in package.json:**
```json
{
  "build": {
    "mac": {
      "identity": "Your Developer ID Application Name"
    }
  }
}
```

3. **Notarization (macOS 10.15+):**
```bash
# Set environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"

# Build with notarization
npm run dist -- --mac
```

### Windows Code Signing

1. **Obtain Code Signing Certificate:**
   - Purchase from certificate authority (DigiCert, Sectigo, etc.)
   - Or use a self-signed certificate for testing

2. **Configure in package.json:**
```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "password"
    }
  }
}
```

## Troubleshooting

### Backend Fails to Start

**Issue:** Backend process doesn't start or crashes immediately

**Solutions:**
1. Check backend logs in app data directory
2. Ensure all Python dependencies are included in PyInstaller spec
3. Verify port 8000-8100 range is available
4. Try running backend manually to see errors:
```bash
cd backend/dist
./backend  # or backend.exe on Windows
```

### Large Application Size

**Issue:** Built application is very large (>500MB)

**Explanation:** This is expected due to:
- Sentence-transformers ML models (~200MB)
- Python runtime and dependencies
- Electron framework

**Optimization:**
- Models will be downloaded on first run instead of bundling
- Use UPX compression (enabled in backend.spec)
- Consider cloud-based embedding service for lighter builds

### Port Conflicts

**Issue:** Backend can't start due to port in use

**Solution:** The app automatically finds available ports in the 8000-8100 range. If issues persist:
1. Close other applications using these ports
2. Modify port range in `electron/main.js`

### Model Download Issues

**Issue:** First run fails to download embedding models

**Solution:**
1. Ensure internet connection is available
2. Models are cached in: `~/.cache/huggingface/` (Linux/macOS) or `%USERPROFILE%\.cache\huggingface\` (Windows)
3. Can pre-download models and include in package

## Performance Optimization

### Startup Time
- Backend initialization takes 5-10 seconds on first run
- Subsequent runs are faster due to model caching
- Consider splash screen for better UX

### Memory Usage
- Backend uses ~500MB-1GB RAM (due to ML models)
- Frontend uses ~100-200MB RAM
- Total: ~600MB-1.2GB RAM footprint

### Disk Space
- Application bundle: 500-600MB
- User data (knowledge bases): Varies by usage
- Model cache: ~200-300MB

## Distribution

### Direct Download
1. Upload builds to GitHub Releases
2. Provide platform-specific downloads
3. Include installation instructions

### Auto-Updates
Configure electron-builder for auto-updates:
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "Coder-Upsilon",
      "repo": "little-kb"
    }
  }
}
```

### App Stores

**macOS App Store:**
- Requires Mac App Store certificate
- Additional sandboxing requirements
- Follow Apple's submission guidelines

**Microsoft Store:**
- Requires Windows Store developer account
- Use MSIX packaging
- Follow Microsoft's submission guidelines

## Development Tips

### Debugging Electron

**Main Process:**
- Logs appear in terminal where you ran `npm run dev`
- Use console.log for debugging

**Renderer Process:**
- DevTools open automatically in dev mode
- Use React DevTools browser extension

### Testing Builds

Before distribution, test on clean systems:

**macOS:**
```bash
# Test the DMG
open "dist/Little KB.dmg"
```

**Windows:**
```bash
# Test the installer
start "dist/little-kb-setup.exe"
```

**Linux:**
```bash
# Test the AppImage
chmod +x "dist/little-kb.AppImage"
./dist/little-kb.AppImage
```

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/Coder-Upsilon/little-kb/issues
- Documentation: https://github.com/Coder-Upsilon/little-kb

## Credits

Built with:
- Electron - Cross-platform desktop framework
- React - Frontend UI framework
- FastAPI - Python backend framework
- ChromaDB - Vector database
- sentence-transformers - Embedding generation
