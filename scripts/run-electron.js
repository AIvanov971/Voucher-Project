const { spawn } = require('node:child_process');
const path = require('node:path');

delete process.env.ELECTRON_RUN_AS_NODE;

const electronBinary = require('electron');
const electronArgs = process.argv.slice(2);
const projectRoot = path.resolve(__dirname, '..');

const child = spawn(electronBinary, electronArgs, {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error('Failed to launch Electron.', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
