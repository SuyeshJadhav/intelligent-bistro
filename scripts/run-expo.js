#!/usr/bin/env node

const { spawn } = require('child_process');

const [command = 'start', ...args] = process.argv.slice(2);

function shouldUseTunnel(expoArgs) {
	return !expoArgs.some((arg) => arg === '--lan' || arg === '--localhost' || arg === '--tunnel');
}

const expoArgs =
	command === 'lint'
		? ['expo', 'lint', ...args]
		: ['expo', 'start', ...(command === 'start' && shouldUseTunnel(args) ? ['--tunnel'] : []), ...args];

const child = spawn('npx', expoArgs, {
	stdio: 'inherit',
	shell: true,
	env: {
		...process.env,
		EXPO_ROUTER_APP_ROOT: 'app',
	},
});

child.on('exit', (code) => {
	process.exit(code ?? 0);
});

child.on('error', (error) => {
	console.error(error);
	process.exit(1);
});
