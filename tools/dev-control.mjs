import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_PORT = numberEnv('BITKINGDOM_WEB_PORT', 5188);
const SERVER_PORT = numberEnv('BITKINGDOM_PORT', 8787);
const SERVER_URL = process.env.VITE_SERVER_URL ?? process.env.BITKINGDOM_SERVER_URL ?? `http://127.0.0.1:${SERVER_PORT}`;
const LEGACY_PORTS = [...new Set([5177, 5188, 8798, 8787].filter((port) => port !== WEB_PORT && port !== SERVER_PORT))];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DIR = resolve(ROOT, '.server');
const LOG_DIR = resolve(SERVER_DIR, 'logs');
const PID_FILE = resolve(SERVER_DIR, 'dev-pids.json');

const command = process.argv[2] ?? 'start';

if (command === 'start') {
  start();
} else if (command === 'stop') {
  stop();
} else if (command === 'restart') {
  stop();
  start();
} else {
  console.error(`Unknown command "${command}". Use start, stop, or restart.`);
  process.exit(1);
}

function start() {
  mkdirSync(LOG_DIR, { recursive: true });
  let occupied = [WEB_PORT, SERVER_PORT].filter((port) => findPidsByPort(port).length > 0);
  if (occupied.length > 0) {
    waitForPortsToClose(occupied, 30_000, false);
    occupied = [WEB_PORT, SERVER_PORT].filter((port) => findPidsByPort(port).length > 0);
  }
  if (occupied.length > 0) {
    console.error(`Fixed port(s) already in use: ${occupied.join(', ')}. Run npm run dev:stop first.`);
    process.exit(1);
  }

  const env = {
    ...process.env,
    BITKINGDOM_PORT: String(SERVER_PORT),
    VITE_SERVER_URL: SERVER_URL
  };
  const server = spawnDetached('server', ['run', 'dev:server'], env);
  const web = spawnDetached('web', ['exec', '-w', '@bitkingdom/web', '--', 'vite', '--host', '0.0.0.0', '--port', String(WEB_PORT), '--strictPort'], env);
  writeFileSync(PID_FILE, `${JSON.stringify({ server: server.pid, web: web.pid, webPort: WEB_PORT, serverPort: SERVER_PORT }, null, 2)}\n`);
  console.log(`Started BitKingdom dev server.`);
  console.log(`Web:    http://127.0.0.1:${WEB_PORT}`);
  console.log(`API:    ${SERVER_URL}`);
  console.log(`Stop:   npm run dev:stop`);
  console.log(`Logs:   ${LOG_DIR}`);
}

function stop() {
  const pidData = readPidFile();
  const stopPorts = [WEB_PORT, SERVER_PORT, ...LEGACY_PORTS];
  const pids = new Set([
    ...Object.values(pidData).filter((value) => Number.isInteger(value)),
    ...stopPorts.flatMap((port) => findPidsByPort(port)),
    ...findDevPidsByCommand()
  ]);
  for (const pid of pids) {
    killProcessTree(pid);
  }
  rmSync(PID_FILE, { force: true });
  waitForPortsToClose(stopPorts);
  console.log(`Stopped BitKingdom dev services on ports ${stopPorts.join(', ')}.`);
}

function spawnDetached(name, args, env) {
  const logPath = resolve(LOG_DIR, `${name}.log`);
  const logFd = openSync(logPath, 'a');
  const child = spawn('npm', args, {
    cwd: ROOT,
    detached: true,
    shell: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...env,
      BITKINGDOM_LOG_FILE: logPath
    }
  });
  closeSync(logFd);
  child.unref();
  return child;
}

function readPidFile() {
  try {
    return JSON.parse(readFileSync(PID_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function findPidsByPort(port) {
  if (process.platform === 'win32') {
    const result = spawnSync('powershell', [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`
    ], { encoding: 'utf8' });
    return result.stdout
      .split(/\r?\n/)
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  }

  const result = spawnSync('sh', ['-lc', `lsof -ti tcp:${port} -sTCP:LISTEN 2>/dev/null || true`], { encoding: 'utf8' });
  return result.stdout
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function findDevPidsByCommand() {
  if (process.platform === 'win32') {
    const escapedRoot = ROOT.replace(/'/g, "''");
    const result = spawnSync('powershell', [
      '-NoProfile',
      '-Command',
      [
        `$root = '${escapedRoot}'`,
        '$self = $PID',
        "Get-CimInstance Win32_Process | Where-Object {",
        "  $cmd = $_.CommandLine",
        "  $_.ProcessId -ne $self -and $cmd -and (",
        "    ($cmd -like \"*$root*\" -and (",
        "      $cmd -like '*tsx watch src/main.ts*' -or",
        "      $cmd -like '*tsx*src/main.ts*' -or",
        "      $cmd -like '*vite*--host 0.0.0.0*' -or",
        "      $cmd -like '*@bitkingdom/web*' -or",
        "      $cmd -like '*dev:server*' -or",
        "      $cmd -like '*playwright-dev-server.mjs*' -or",
        "      $cmd -like '*@playwright*test*cli.js*'",
        "    )) -or",
        "    $cmd -like '*run start -w @bitkingdom/server*' -or",
        "    $cmd -like '*exec -w @bitkingdom/web -- vite*' -or",
        "    $cmd -like '*run test:playwright*'",
        '  )',
        '} | Select-Object -ExpandProperty ProcessId -Unique'
      ].join('; ')
    ], { encoding: 'utf8' });
    return parsePidLines(result.stdout);
  }

  const escapedRoot = ROOT.replace(/'/g, "'\\''");
  const result = spawnSync('sh', ['-lc', `ps -eo pid=,args= | grep '${escapedRoot}' | grep -E 'tsx watch src/main\\.ts|vite .*--host 0\\.0\\.0\\.0|@bitkingdom/web|dev:server' | awk '{print $1}'`], { encoding: 'utf8' });
  return parsePidLines(result.stdout);
}

function parsePidLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function killProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
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
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
}

function numberEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function waitForPortsToClose(ports, timeoutMs = 45_000, warn = true) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const occupied = ports.filter((port) => findPidsByPort(port).length > 0);
    if (occupied.length === 0) {
      return;
    }
    sleep(200);
  }
  const occupied = ports.filter((port) => findPidsByPort(port).length > 0);
  if (warn && occupied.length > 0) {
    console.warn(`Port(s) still releasing: ${occupied.join(', ')}.`);
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
