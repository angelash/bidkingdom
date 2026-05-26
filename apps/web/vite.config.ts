import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceAudioRoot = path.resolve(
  fileURLToPath(new URL('../../reverse/bidking/exported_assets_full/AudioClip/sound', import.meta.url))
);

export default defineConfig({
  plugins: [react(), bidKingSourceAudioPlugin()],
  server: {
    port: 5188,
    host: '0.0.0.0',
    strictPort: true
  }
});

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
