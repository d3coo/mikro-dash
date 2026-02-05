const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;
const PORT = 3001; // Different from dev server (3000) to avoid conflicts

// Get the correct paths for packaged vs development
const isPackaged = app.isPackaged;
const appPath = isPackaged
	? path.dirname(app.getPath('exe'))  // Next to the .exe
	: path.join(__dirname, '..');        // Development: project root

// Database goes in user data folder for packaged app, or project root for dev
const databasePath = isPackaged
	? path.join(app.getPath('userData'), 'data.db')
	: path.join(appPath, 'data.db');

// Seed database path (bundled with the app)
const seedDatabasePath = isPackaged
	? path.join(process.resourcesPath, 'data.db')
	: path.join(appPath, 'data.db');

// Copy seed database to user data folder if it doesn't exist
function initializeDatabase() {
	if (isPackaged && !fs.existsSync(databasePath)) {
		console.log('Copying seed database to user data folder...');
		try {
			// Ensure the user data directory exists
			const userDataDir = path.dirname(databasePath);
			if (!fs.existsSync(userDataDir)) {
				fs.mkdirSync(userDataDir, { recursive: true });
			}
			// Copy the seed database
			fs.copyFileSync(seedDatabasePath, databasePath);
			console.log('Seed database copied successfully');
		} catch (err) {
			console.error('Failed to copy seed database:', err);
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

	// Open external links in browser
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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
		console.log('Database path:', databasePath);
		console.log('Node modules path:', nodeModulesPath);

		// Use 'node' in dev, or Electron as Node (ELECTRON_RUN_AS_NODE) when packaged
		const nodeExe = isPackaged ? process.execPath : 'node';
		console.log('Node executable:', nodeExe);

		serverProcess = spawn(nodeExe, [serverPath], {
			env: {
				...process.env,
				PORT: PORT.toString(),
				DATABASE_PATH: databasePath,
				NODE_PATH: nodeModulesPath,
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
		// Initialize database (copy seed if needed)
		initializeDatabase();

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
