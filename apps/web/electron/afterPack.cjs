/**
 * electron-builder afterPack hook.
 * Replaces the better-sqlite3 native binary in app.asar.unpacked
 * with the Electron-compatible prebuilt (ABI 143).
 */
const path = require('path');
const fs = require('fs');

module.exports = async function (context) {
	const appOutDir = context.appOutDir;
	const electronBinary = path.join(
		appOutDir,
		'resources',
		'app.asar.unpacked',
		'node_modules',
		'better-sqlite3',
		'build',
		'Release',
		'better_sqlite3.node'
	);

	const electronNativeBinary = path.join(
		__dirname,
		'..',
		'electron-native',
		'better-sqlite3',
		'build',
		'Release',
		'better_sqlite3.node'
	);

	if (fs.existsSync(electronBinary) && fs.existsSync(electronNativeBinary)) {
		fs.copyFileSync(electronNativeBinary, electronBinary);
		console.log('[afterPack] Replaced better-sqlite3 native binary with Electron-compatible prebuilt');
	} else {
		if (!fs.existsSync(electronBinary)) {
			console.warn('[afterPack] Target binary not found:', electronBinary);
		}
		if (!fs.existsSync(electronNativeBinary)) {
			console.warn('[afterPack] Source prebuilt not found:', electronNativeBinary);
		}
	}
};
