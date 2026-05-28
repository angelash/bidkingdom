import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const artRoot = path.join(repoRoot, 'apps', 'web', 'public', 'art');

const profiles = [
  { pattern: /[\\/]backgrounds[\\/]/, maxWidth: 1600, quality: 58 },
  { pattern: /[\\/]containers[\\/]/, maxWidth: 960, quality: 58 },
  { pattern: /[\\/]roles[\\/].*avatar/i, maxWidth: 320, quality: 58 },
  { pattern: /[\\/]roles[\\/].*portrait/i, maxWidth: 640, quality: 58 },
  { pattern: /[\\/]roles[\\/]/, maxWidth: 1200, quality: 58 },
  { pattern: /[\\/]bidking[\\/]items[\\/]/, maxWidth: 256, quality: 55 },
  { pattern: /[\\/]items[\\/]/, maxWidth: 256, quality: 55 },
  { pattern: /[\\/]ui[\\/]/, maxWidth: 960, quality: 62 },
  { pattern: /[\\/]/, maxWidth: 640, quality: 58 }
];

const files = listFiles(artRoot)
  .filter((filePath) => filePath.toLowerCase().endsWith('.png'));
const force = process.argv.includes('--force');

let converted = 0;
let skipped = 0;
let originalBytes = 0;
let webpBytes = 0;

for (const filePath of files) {
  const profile = profiles.find((entry) => entry.pattern.test(filePath)) ?? profiles.at(-1);
  if (!profile) {
    continue;
  }
  const outputPath = filePath.replace(/\.png$/i, '.webp');
  const sourceSize = fs.statSync(filePath).size;
  originalBytes += sourceSize;
  if (!force && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
    skipped += 1;
    webpBytes += fs.statSync(outputPath).size;
    continue;
  }
  const result = spawnSync('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    filePath,
    '-vf',
    `scale=w='min(iw,${profile.maxWidth})':h=-2:flags=lanczos`,
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-q:v',
    String(profile.quality),
    '-compression_level',
    '6',
    outputPath
  ], { stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${path.relative(repoRoot, filePath)}\n${result.stderr.toString()}`);
  }
  const outputSize = fs.statSync(outputPath).size;
  converted += 1;
  webpBytes += outputSize;
}

console.log(`Scanned ${files.length} PNG files.`);
console.log(`Converted ${converted} PNG files to WebP; skipped ${skipped} existing WebP files.`);
console.log(`PNG total: ${(originalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`WebP total: ${(webpBytes / 1024 / 1024).toFixed(2)} MB`);

function listFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}
