import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const sourceAudioRoot = path.resolve(
  fileURLToPath(new URL('../../reverse/bidking/exported_assets_full/AudioClip/sound', import.meta.url))
);
const webPort = numberEnv('BITKINGDOM_WEB_PORT', 5188);
const publicHmrHost = process.env.BITKINGDOM_WEB_PUBLIC_HOST;
const publicHmrProtocol = process.env.BITKINGDOM_WEB_PUBLIC_PROTOCOL === 'ws' ? 'ws' : 'wss';
const publicHmrClientPort = optionalNumberEnv('BITKINGDOM_WEB_PUBLIC_CLIENT_PORT');

export default defineConfig({
  plugins: [react(), bidKingSourceAudioPlugin()],
  server: {
    port: webPort,
    host: '0.0.0.0',
    strictPort: true,
    hmr: publicHmrHost
      ? {
          host: publicHmrHost,
          protocol: publicHmrProtocol,
          clientPort: publicHmrClientPort ?? (publicHmrProtocol === 'wss' ? 443 : webPort)
        }
      : undefined
  }
});

function numberEnv(name: string, fallback: number): number {
  return optionalNumberEnv(name) ?? fallback;
}

function optionalNumberEnv(name: string): number | undefined {
  const rawValue = process.env[name];
  if (!rawValue) {
    return undefined;
  }
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : undefined;
}

function bidKingSourceAudioPlugin(): Plugin {
  return {
    name: 'bidking-source-audio',
    configureServer(server) {
      server.middlewares.use('/source-audio', (req, res, next) => {
        const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/').replace(/^\/+/, '');
        const filePath = path.resolve(sourceAudioRoot, rawPath);
        const normalizedRoot = sourceAudioRoot.toLowerCase();
        const normalizedFile = filePath.toLowerCase();
        if (normalizedFile !== normalizedRoot && !normalizedFile.startsWith(`${normalizedRoot}${path.sep}`)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        fs.stat(filePath, (error, stat) => {
          if (error || !stat.isFile()) {
            next();
            return;
          }
          res.setHeader('Content-Type', audioMimeType(filePath));
          res.setHeader('Content-Length', String(stat.size));
          fs.createReadStream(filePath).pipe(res);
        });
      });
    }
  };
}

function audioMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.mp3') {
    return 'audio/mpeg';
  }
  if (extension === '.ogg') {
    return 'audio/ogg';
  }
  return 'audio/wav';
}
