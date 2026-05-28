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
  plugins: [react(), bidKingSourceAudioPlugin(), pruneBuildPngArtPlugin()],
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

function pruneBuildPngArtPlugin(): Plugin {
  let outDir = '';
  return {
    name: 'bidking-prune-build-png-art',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const artRoot = path.resolve(outDir, 'art');
      if (!isInsideOrSame(outDir, artRoot) || !fs.existsSync(artRoot)) {
        return;
      }
      for (const filePath of listFiles(artRoot)) {
        if (path.extname(filePath).toLowerCase() === '.png' && isInsideOrSame(artRoot, filePath)) {
          fs.rmSync(filePath);
        }
      }
      rewriteBuildArtManifest(artRoot);
    }
  };
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

function rewriteBuildArtManifest(artRoot: string): void {
  const manifestPath = path.join(artRoot, 'manifest.json');
  if (!isInsideOrSame(artRoot, manifestPath) || !fs.existsSync(manifestPath)) {
    return;
  }
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  fs.writeFileSync(manifestPath, manifest.replace(/\.png/g, '.webp'), 'utf8');
}

function listFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

function isInsideOrSame(root: string, candidate: string): boolean {
  const relativePath = path.relative(root, candidate);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
