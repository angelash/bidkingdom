import { spawn, spawnSync } from 'node:child_process';

const WEB_PORT = process.env.BITKINGDOM_WEB_PORT ?? '5188';
const SERVER_PORT = process.env.BITKINGDOM_PORT ?? '8787';
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

const children = [
  ['server', ['run', 'dev:server']],
  ['web', ['exec', '-w', '@bitkingdom/web', '--', 'vite', '--host', '0.0.0.0', '--port', WEB_PORT, '--strictPort']]
];
const childProcesses = [];
let shuttingDown = false;

console.log(`BitKingdom dev ports: web http://127.0.0.1:${WEB_PORT}, server ${SERVER_URL}`);

for (const [name, args] of children) {
  const child = spawn('npm', args, {
    cwd: new URL('..', import.meta.url),
    shell: true,
    stdio: 'pipe',
    env: {
      ...process.env,
      BITKINGDOM_PORT: SERVER_PORT,
      VITE_SERVER_URL: SERVER_URL
    }
  });
  childProcesses.push(child);

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });
  child.on('exit', (code) => {
    const index = childProcesses.indexOf(child);
    if (index >= 0) {
      childProcesses.splice(index, 1);
    }
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));
process.on('exit', () => {
  for (const child of childProcesses) {
    killProcessTree(child.pid);
  }
});

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of [...childProcesses]) {
    killProcessTree(child.pid, signal);
  }
  process.exit();
}

function killProcessTree(pid, signal = 'SIGTERM') {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }
  if (process.platform === 'win32') {
    spawnSync('powershell', [
      '-NoProfile',
      '-Command',
      `$ErrorActionPreference = 'SilentlyContinue';
function Stop-Tree([int]$Id) {
  Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $Id } | ForEach-Object { Stop-Tree ([int]$_.ProcessId) }
  Stop-Process -Id $Id -Force -ErrorAction SilentlyContinue
}
Stop-Tree ${pid}`
    ], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Already gone.
    }
  }
}
