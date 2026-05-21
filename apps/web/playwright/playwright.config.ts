import { defineConfig } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? 'http://127.0.0.1:5188';
const SERVER_URL = process.env.PLAYWRIGHT_SERVER_URL ?? 'http://127.0.0.1:8787';
const WEB_PORT = new URL(WEB_URL).port || '5188';
const SERVER_PORT = new URL(SERVER_URL).port || '8787';
const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const WEB_SERVERS = process.env.PLAYWRIGHT_SKIP_WEBSERVER
  ? undefined
  : [
      {
        command: 'npm run start -w @bitkingdom/server',
        cwd: ROOT_DIR,
        url: `${SERVER_URL}/health`,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          BITKINGDOM_PORT: SERVER_PORT
        }
      },
      {
        command: `npm exec -w @bitkingdom/web -- vite --host 0.0.0.0 --port ${WEB_PORT} --strictPort`,
        cwd: ROOT_DIR,
        url: WEB_URL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          VITE_SERVER_URL: SERVER_URL
        }
      }
    ];

export default defineConfig({
  testDir: '.',
  testMatch: '*.playwright.ts',
  reporter: [['list']],
  ...(WEB_SERVERS ? { webServer: WEB_SERVERS } : {}),
  use: {
    trace: 'retain-on-failure'
  }
});
