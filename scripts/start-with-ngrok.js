#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
	const projectRoot = path.resolve(__dirname, '..');
	const envPath = path.join(projectRoot, '.env.local');
	const backupPath = envPath + '.bak';

	// Backup existing .env.local if present
	try {
		if (fs.existsSync(envPath)) {
			fs.copyFileSync(envPath, backupPath);
			console.log('Backed up existing .env.local to .env.local.bak');
		}
	} catch (err) {
		console.error('Failed to backup .env.local:', err);
	}

	let ngrok;
	try {
		ngrok = require('ngrok');
	} catch (err) {
		console.error('ngrok package not installed. Run `npm install --save-dev ngrok` and try again.');
		process.exit(1);
	}

	let url;

	try {
		console.log('Starting ngrok tunnel for http://localhost:3000 ...');
		url = await ngrok.connect({ addr: 3000 });
		console.log('ngrok tunnel started at', url);
	} catch (err) {
		console.error('Failed to start ngrok:', err);
		process.exit(1);
	}

	// Write .env.local with the tunnel URL
	try {
		fs.writeFileSync(envPath, `EXPO_PUBLIC_API_URL=${url}\n`);
		console.log('Wrote .env.local with EXPO_PUBLIC_API_URL=', url);
	} catch (err) {
		console.error('Failed to write .env.local:', err);
	}

	// Start Expo (uses scripts/run-expo.js under the hood)
	const expo = spawn('npm', ['start', '--', '--tunnel', '-c'], {
		stdio: 'inherit',
		cwd: projectRoot,
		shell: true,
		env: { ...process.env, EXPO_PUBLIC_API_URL: url },
	});

	const cleanup = async (code) => {
		try {
			console.log('\nShutting down ngrok...');
			await ngrok.kill();
		} catch (err) {
			// ignore
		}

		try {
			if (fs.existsSync(backupPath)) {
				fs.copyFileSync(backupPath, envPath);
				fs.unlinkSync(backupPath);
				console.log('Restored original .env.local from backup');
			}
		} catch (err) {
			console.error('Failed to restore .env.local backup:', err);
		}

		process.exit(code ?? 0);
	};

	expo.on('exit', cleanup);
	process.on('SIGINT', () => cleanup(0));
	process.on('SIGTERM', () => cleanup(0));
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
