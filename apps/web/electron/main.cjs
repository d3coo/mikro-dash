const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;
const PORT = 3002; // Different from dev (3000) and main branch electron (3001)

// Get the correct paths for packaged vs development
const isPackaged = app.isPackaged;
const appPath = isPackaged
	? path.dirname(app.getPath('exe'))  // Next to the .exe
	: path.join(__dirname, '..');        // Development: project root

// Persistent data directory that survives app updates
const dataDir = isPackaged
	? path.join(app.getPath('userData'), 'data')  // %APPDATA%/MikroDash/data
	: appPath;                                     // Development: project root

// Ensure data directory exists
if (isPackaged && !fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

// Migrate: if old DB exists in resources but not in new location, copy it
if (isPackaged) {
	const newDbPath = path.join(dataDir, 'data.db');
	const oldDbPath = path.join(process.resourcesPath, 'data.db');
	if (!fs.existsSync(newDbPath) && fs.existsSync(oldDbPath)) {
		console.log('[Migration] Copying database from old location to', newDbPath);
		fs.copyFileSync(oldDbPath, newDbPath);
		// Also copy WAL/SHM if they exist
		for (const ext of ['-wal', '-shm']) {
			if (fs.existsSync(oldDbPath + ext)) {
				fs.copyFileSync(oldDbPath + ext, newDbPath + ext);
			}
		}
	}
}

// Server path - in asar when packaged
const serverPath = isPackaged
	? path.join(process.resourcesPath, 'app.asar', 'build', 'index.js')
	: path.join(appPath, 'build', 'index.js');

// Node modules path - in extraResources when packaged
const nodeModulesPath = isPackaged
	? path.join(process.resourcesPath, 'node_modules')
	: path.join(__dirname, '..', '..', '..', 'node_modules');

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		minWidth: 1024,
		minHeight: 700,
		// icon: path.join(__dirname, '../static/icon.ico'), // Add .ico file for custom icon
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true
		},
		autoHideMenuBar: true,
		show: false
	});

	// Show window when ready
	mainWindow.once('ready-to-show', () => {
		mainWindow.show();
	});

	// Keep local navigation inside the app, open external links in browser
	mainWindow.webContents.on('will-navigate', (event, url) => {
		const appUrl = `http://localhost:${PORT}`;
		if (!url.startsWith(appUrl)) {
			event.preventDefault();
			shell.openExternal(url);
		}
	});

	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		const appUrl = `http://localhost:${PORT}`;
		if (url.startsWith(appUrl)) {
			return { action: 'allow' };
		}
		shell.openExternal(url);
		return { action: 'deny' };
	});

	// Load the app
	mainWindow.loadURL(`http://localhost:${PORT}`);

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

function startServer() {
	return new Promise((resolve, reject) => {
		console.log('Is packaged:', isPackaged);
		console.log('Server path:', serverPath);
		console.log('Node modules path:', nodeModulesPath);

		// Use 'node' in dev, or Electron as Node (ELECTRON_RUN_AS_NODE) when packaged
		const nodeExe = isPackaged ? process.execPath : 'node';
		console.log('Node executable:', nodeExe);

		serverProcess = spawn(nodeExe, [serverPath], {
			env: {
				...process.env,
				PORT: PORT.toString(),
				NODE_PATH: nodeModulesPath,
				WEBHOOK_HOST: '192.168.1.100',
				// Pass persistent data directory for database
				MIKRODASH_DATA_DIR: dataDir,
				// Pass resources path for native modules
				RESOURCES_PATH: isPackaged ? process.resourcesPath : '',
				// Tell Electron to run as Node.js
				ELECTRON_RUN_AS_NODE: '1'
			},
			stdio: ['ignore', 'pipe', 'pipe'],
			cwd: appPath,
			shell: process.platform === 'win32'
		});

		serverProcess.stdout.on('data', (data) => {
			const output = data.toString();
			console.log('[Server]', output);
			// Server is ready when it logs the listening message
			if (output.includes('Listening') || output.includes('listening') || output.includes('started')) {
				resolve();
			}
		});

		serverProcess.stderr.on('data', (data) => {
			console.error('[Server Error]', data.toString());
		});

		serverProcess.on('error', (err) => {
			console.error('Failed to start server:', err);
			reject(err);
		});

		// Fallback: resolve after 3 seconds if no specific message
		setTimeout(resolve, 3000);
	});
}

function stopServer() {
	if (serverProcess) {
		serverProcess.kill();
		serverProcess = null;
	}
}

app.whenReady().then(async () => {
	try {
		console.log('Starting SvelteKit server...');
		await startServer();
		console.log('Server started, creating window...');
		createWindow();
	} catch (err) {
		console.error('Failed to start:', err);
		app.quit();
	}
});

app.on('window-all-closed', () => {
	stopServer();
	app.quit();
});

app.on('before-quit', () => {
	stopServer();
});

app.on('activate', () => {
	if (mainWindow === null) {
		createWindow();
	}
});
