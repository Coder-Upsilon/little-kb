const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;
let backendProcess = null;
let backendPort = null;

// Determine if running in development mode
const isDev = process.argv.includes('--dev');

// Get app data directory based on platform
function getAppDataPath() {
  const appName = 'Little KB';
  switch (process.platform) {
    case 'darwin':
      return path.join(app.getPath('home'), 'Library', 'Application Support', appName);
    case 'win32':
      return path.join(app.getPath('appData'), appName);
    case 'linux':
      return path.join(app.getPath('home'), '.config', 'little-kb');
    default:
      return path.join(app.getPath('home'), '.little-kb');
  }
}

// Create app data directories if they don't exist
function ensureAppDataDirectories() {
  const appDataPath = getAppDataPath();
  const directories = [
    appDataPath,
    path.join(appDataPath, 'knowledge-bases'),
    path.join(appDataPath, 'vector-db'),
    path.join(appDataPath, 'logs'),
    path.join(appDataPath, 'temp_mcp_scripts')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

  // Copy config.json if it doesn't exist
  const configPath = path.join(appDataPath, 'config.json');
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      backend: { port: 39472, host: '127.0.0.1' },
      frontend: { port: 39473 },
      mcp: { start_port: 39500, max_port: 39600 }
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`Created default config: ${configPath}`);
  }

  return appDataPath;
}

// Find an available port
function findAvailablePort(startPort, maxPort = startPort + 100) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    
    function tryPort() {
      const server = net.createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          port++;
          if (port > maxPort) {
            reject(new Error(`No available ports in range ${startPort}-${maxPort}`));
          } else {
            tryPort();
          }
        } else {
          reject(err);
        }
      });
      
      server.once('listening', () => {
        server.close();
        resolve(port);
      });
      
      server.listen(port, '127.0.0.1');
    }
    
    tryPort();
  });
}

// Load config
function loadConfig() {
  const appDataPath = getAppDataPath();
  const configPath = path.join(appDataPath, 'config.json');
  
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  
  // Return default config
  return {
    backend: { port: 39472, host: '127.0.0.1' },
    frontend: { port: 39473 },
    mcp: { start_port: 39500, max_port: 39600 }
  };
}

// Send progress update to renderer
function sendProgress(percent, message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('initialization-progress', { percent, message });
    console.log(`Progress: ${percent}% - ${message}`);
  }
}

// Start the Python backend
async function startBackend() {
  const appDataPath = getAppDataPath();
  const config = loadConfig();
  
  try {
    sendProgress(5, 'Finding available port...');
    
    // Find available port for backend starting from config port
    const startPort = config.backend?.port || 39472;
    backendPort = await findAvailablePort(startPort, startPort + 100);
    console.log(`Starting backend on port ${backendPort}`);
    
    sendProgress(10, 'Starting backend server...');

    let backendCommand, backendArgs, cwd;

    if (isDev) {
      // Development mode: run from source
      backendCommand = 'uv';
      backendArgs = ['run', 'python', 'main.py'];
      cwd = path.join(__dirname, '..', 'backend');
    } else {
      // Production mode: run packaged executable
      const backendExe = process.platform === 'win32' ? 'backend.exe' : 'backend';
      const backendPath = path.join(process.resourcesPath, 'backend', backendExe);
      
      if (!fs.existsSync(backendPath)) {
        throw new Error(`Backend executable not found at ${backendPath}`);
      }
      
      backendCommand = backendPath;
      backendArgs = [];
      cwd = appDataPath;
    }

    // Set environment variables
    const env = {
      ...process.env,
      BACKEND_PORT: backendPort.toString(),
      APP_DATA_PATH: appDataPath,
      KNOWLEDGE_BASES_PATH: path.join(appDataPath, 'knowledge-bases'),
      VECTOR_DB_PATH: path.join(appDataPath, 'vector-db'),
      TEMP_MCP_SCRIPTS_PATH: path.join(appDataPath, 'temp_mcp_scripts')
    };

    backendProcess = spawn(backendCommand, backendArgs, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend: ${data.toString().trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend Error: ${data.toString().trim()}`);
    });

    backendProcess.on('error', (error) => {
      console.error('Failed to start backend:', error);
      dialog.showErrorBox('Backend Error', `Failed to start backend: ${error.message}`);
    });

    backendProcess.on('exit', (code) => {
      console.log(`Backend process exited with code ${code}`);
      if (code !== 0 && code !== null) {
        dialog.showErrorBox('Backend Crashed', `Backend process crashed with code ${code}`);
      }
    });

    sendProgress(40, 'Waiting for backend to initialize...');
    
    // Wait for backend to be ready
    await waitForBackend(backendPort);
    
    sendProgress(90, 'Backend ready, loading application...');
    console.log('Backend is ready');
    
    return backendPort;
  } catch (error) {
    console.error('Error starting backend:', error);
    throw error;
  }
}

// Wait for backend to be ready with detailed progress
function waitForBackend(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkBackend = () => {
      // Send detailed progress updates
      const baseProgress = 40;
      const progressRange = 50; // 40% to 90%
      const currentProgress = baseProgress + Math.floor((attempts / maxAttempts) * progressRange);
      
      // Different messages based on progress
      let message = 'Initializing backend...';
      if (attempts < 3) {
        message = 'Extracting Python dependencies...';
      } else if (attempts < 6) {
        message = 'Loading ChromaDB vector database...';
      } else if (attempts < 10) {
        message = 'Initializing FastAPI server...';
      } else if (attempts < 15) {
        message = 'Loading embedding models...';
      } else if (attempts < 20) {
        message = 'Starting MCP services...';
      } else {
        message = 'Almost ready, finalizing startup...';
      }
      
      sendProgress(currentProgress, message);
      
      const client = net.createConnection({ port, host: '127.0.0.1' }, () => {
        client.end();
        resolve();
      });
      
      client.on('error', () => {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(new Error('Backend failed to start within timeout'));
        } else {
          setTimeout(checkBackend, 1000);
        }
      });
    };
    
    checkBackend();
  });
}

// Stop the Python backend
function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend process...');
    
    // Try graceful shutdown first
    backendProcess.kill('SIGTERM');
    
    // Force kill after 2 seconds if still running
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        console.log('Force killing backend process...');
        backendProcess.kill('SIGKILL');
      }
      backendProcess = null;
    }, 2000);
  }
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Little KB',
    show: false // Don't show until ready
  });

  // Create application menu
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'close' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);

  // Load the appropriate URL
  if (isDev) {
    // Development mode: load from React dev server on port 39473
    mainWindow.loadURL('http://localhost:39473');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode: load built files
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'build', 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    sendProgress(0, 'Initializing Little KB...');
    
    // Create window FIRST so user sees it immediately
    createWindow();
    
    // Small delay to ensure window is visible
    await new Promise(resolve => setTimeout(resolve, 100));
    
    sendProgress(2, 'Setting up application directories...');
    
    // Ensure app data directories exist
    const appDataPath = ensureAppDataDirectories();
    console.log(`App data path: ${appDataPath}`);

    // Start backend (this is where most time is spent: 5% -> 95%)
    await startBackend();
    
    sendProgress(100, 'Ready!');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('Failed to initialize app:', error);
    dialog.showErrorBox('Startup Error', `Failed to start Little KB: ${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On macOS, quit the app when window closes (non-standard but better UX for this type of app)
  // This ensures backend is properly cleaned up
  app.quit();
});

app.on('before-quit', (event) => {
  stopBackend();
});

app.on('will-quit', () => {
  // Final cleanup - ensure backend is killed
  if (backendProcess && !backendProcess.killed) {
    console.log('Final cleanup: killing backend process');
    try {
      backendProcess.kill('SIGKILL');
    } catch (error) {
      console.error('Error killing backend in will-quit:', error);
    }
  }
});

// IPC handlers
ipcMain.handle('get-backend-url', async () => {
  // Wait for backend port to be set (with timeout)
  let attempts = 0;
  while (backendPort === null && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (backendPort === null) {
    console.error('Backend port not available after timeout');
    return null;
  }
  
  return `http://127.0.0.1:${backendPort}`;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-data-path', () => {
  return getAppDataPath();
});
