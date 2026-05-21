import { stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameConfig } from '../packages/config/src/data';

interface RuntimeAsset {
  path: string;
  generatedPath: string;
  type: string;
  ratio: string;
  qc: string;
}

const rootDir = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const publicDir = join(rootDir, 'apps/web/public');

const containerFiles: Record<string, string> = {
  container_sample_home: 'container_sample_home_v1.png',
  container_sample_antique: 'container_sample_antique_v1.png',
  container_sample_armory: 'container_sample_armory_v1.png',
  container_sample_black_market: 'container_sample_black_market_v1.png',
  container_sample_flash_palace: 'container_sample_flash_palace_v1.png',
  container_palace: 'container_palace_v1.png',
  container_battlefield: 'container_battlefield_v1.png',
  container_ship: 'container_ship_v1.png',
  container_armory: 'container_armory_v1.png',
  container_academy: 'container_academy_v1.png',
  container_black_market: 'container_black_market_v1.png'
};

const suffixFiles: Record<string, string> = {
  '甲': 'a',
  '乙': 'b',
  '丙': 'c',
  '丁': 'd'
};

function artPath(folder: string, file: string, runtimeFolder: 'approved' | 'generated'): string {
  return `/art/${runtimeFolder}/${folder}/${file}`;
}

function asset(folder: string, file: string, type: string, ratio: string, qc = 'B: generated and wired for internal demo runtime.'): RuntimeAsset {
  return {
    path: artPath(folder, file, 'approved'),
    generatedPath: artPath(folder, file, 'generated'),
    type,
    ratio,
    qc
  };
}

function itemFileForIconKey(iconKey: string): string {
  const generated = /^item_(\d{2})_([甲乙丙丁])$/.exec(iconKey);
  if (generated) {
    const [, seedNo, suffix] = generated;
    const fileSuffix = suffixFiles[suffix];
    if (!fileSuffix) {
      throw new Error(`Unsupported item suffix for ${iconKey}`);
    }
    return `item_${seedNo}_${fileSuffix}_v1.png`;
  }
  return `item_${iconKey}_v1.png`;
}

async function assertExists(runtimeAsset: RuntimeAsset): Promise<void> {
  for (const publicPath of [runtimeAsset.path, runtimeAsset.generatedPath]) {
    const diskPath = join(publicDir, publicPath.replace(/^\//, ''));
    await stat(diskPath);
  }
}

const assets: Record<string, RuntimeAsset> = {
  background_auction_hall: asset('backgrounds', 'background_auction_hall_v1.png', 'background', '16:9', 'B: approved for standard auction hall backdrop.'),
  background_black_market: asset('backgrounds', 'background_black_market_v1.png', 'background', '16:9', 'B: approved for high-risk auction backdrop.'),
  role_lineup: asset('roles', 'role_lineup_v1.png', 'role_banner', '16:9', 'B: approved for home/lobby mood panel.'),
  ui_settlement_plate: asset('ui', 'ui_settlement_plate_v1.png', 'ui_texture', '16:9', 'B: approved as replay and settlement texture.')
};

for (const role of gameConfig.roles) {
  assets[`role_${role.id}_portrait`] = asset('roles', `role_${role.id}_portrait_v1.png`, 'role_portrait', '3:4');
  assets[`role_${role.id}_avatar`] = asset('roles', `role_${role.id}_avatar_v1.png`, 'role_avatar', '1:1');
}

const uniqueContainerKeys = new Set<string>([
  ...gameConfig.containers.map((container) => container.artKey),
  ...gameConfig.scriptedRounds.map((container) => container.artKey)
]);
for (const artKey of [...uniqueContainerKeys].sort()) {
  const file = containerFiles[artKey];
  if (!file) {
    throw new Error(`Missing container art file mapping for ${artKey}`);
  }
  assets[artKey] = asset('containers', file, 'container_cover', '4:3');
}

for (const item of gameConfig.items) {
  assets[`item_${item.iconKey}`] = asset('items', itemFileForIconKey(item.iconKey), 'item_icon', '1:1');
}

await Promise.all(Object.values(assets).map(assertExists));

const manifest = {
  version: '2026-05-17-full-runtime',
  generatedAt: '2026-05-17',
  policy: {
    sourceFolder: '/art/generated',
    runtimeFolder: '/art/approved',
    rule: 'UI runtime references approved assets only; generated assets are retained for traceability.'
  },
  counts: {
    backgrounds: 2,
    roles: gameConfig.roles.length * 2 + 1,
    containers: uniqueContainerKeys.size,
    items: gameConfig.items.length,
    ui: 1,
    total: Object.keys(assets).length
  },
  assets
};

await writeFile(
  new URL('../apps/web/public/art/manifest.json', import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);
