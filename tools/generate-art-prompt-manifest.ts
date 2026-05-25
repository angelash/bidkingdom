import { writeFile } from 'node:fs/promises';
import { gameConfig } from '../packages/config/src/data';

const stylePrefix = [
  'Use case: stylized-concept',
  'Project style: light strategy board-game visual, Three Kingdoms treasure auction, anthropomorphic animal merchants, eastern black-market auction hall.',
  'Visual language: clean silhouette, readable shapes, polished web-game asset, slightly stylized, not realistic gritty war art.',
  'Palette: ink green, lacquer red, aged bronze gold, jade cyan, warm rice-paper highlights.',
  'Lighting: warm top-left key light, soft ambient shadow, clear subject separation.',
  'Constraints: no text, no watermark, no logo, no modern UI labels, no gore, no real historical celebrity likeness, no cheap neon over-saturation.'
].join('\n');

const roleAnimalEn: Record<string, string> = {
  academy_professor: 'old tortoise',
  appraiser: 'fox',
  arms_dealer: 'boar',
  caravan_master: 'camel',
  eastern_appraiser: 'red-crowned crane',
  fashion_tailor: 'white rabbit',
  field_medic: 'goat',
  historian: 'crane',
  insurer: 'turtle',
  intel_analyst: 'falcon',
  layout_artist: 'swallow',
  market_vendor: 'red panda',
  mentor_teacher: 'owl',
  old_noble: 'golden lion',
  psychologist: 'deer',
  restorer: 'badger',
  table_strategist: 'civet',
  secret_broker: 'black cat',
  smuggler: 'crow',
  treasure_hunter: 'ferret',
  trend_hunter: 'peacock',
  veteran_broker: 'silver wolf',
  young_savant: 'young red panda'
};

const roleProp: Record<string, string> = {
  academy_professor: 'blank compendium and bronze magnifier',
  appraiser: 'magnifier and jade appraisal slip',
  arms_dealer: 'wrapped antique spearhead and lacquered armor plate',
  caravan_master: 'trade ledger and jade route talisman',
  eastern_appraiser: 'porcelain loupe and silk-wrapped appraisal tray',
  fashion_tailor: 'silk swatches and bronze fabric gauge',
  field_medic: 'medicine kit, bronze measuring grid, and sealed herb case',
  historian: 'ancient scrolls and seal-rubbing sheets without readable writing',
  insurer: 'abacus ledger and stable merchant robe',
  intel_analyst: 'route maps with abstract lines and brass markers',
  layout_artist: 'measuring cord, wooden grid frame, and blank drafting board',
  market_vendor: 'abacus pouch and unlabeled bargain tags',
  mentor_teacher: 'bamboo slips and jade appraisal token',
  old_noble: 'ceremonial jade box and old seal cord',
  psychologist: 'bamboo slips and calm observing posture',
  restorer: 'bronze measuring ruler and appraisal tool roll',
  table_strategist: 'folding fan and attentive smile',
  secret_broker: 'sealed letter and bronze cipher token',
  smuggler: 'travel cloak and sealed cargo token',
  treasure_hunter: 'brass lantern and dusted relic pouch',
  trend_hunter: 'lacquer tally board and appraisal cards',
  veteran_broker: 'rolled contract scroll and bronze tally token',
  young_savant: 'small jade puzzle, blank notebook, and bronze appraisal charm'
};

function buildRolePrompt(role: (typeof gameConfig.roles)[number], type: 'portrait' | 'avatar') {
  return [
    stylePrefix,
    `Asset type: role ${type}`,
    `Primary request: anthropomorphic ${roleAnimalEn[role.id] ?? role.animal} auction merchant, ${role.name}, ${role.archetype}, ${roleProp[role.id] ?? role.passive}.`,
    `Composition: ${type === 'portrait' ? '3:4 upper body portrait, 3/4 view' : '1:1 head-and-shoulders avatar'}, clean subject separation.`,
    `Color accent: ${role.color}.`,
    'Avoid: full battlefield armor, weapon brandishing, modern suit, text, watermark.'
  ].join('\n');
}

function buildContainerPrompt(container: { name: string; source: string; tags: string[]; risk: string; artKey: string }) {
  return [
    stylePrefix,
    'Asset type: 4:3 auction lot cover',
    `Primary request: ${container.source} auction lot named ${container.name}, visible props matching tags ${container.tags.join(', ')}.`,
    `Risk mood: ${container.risk}; if high risk, add suspicious seals, cracks, shadows or incomplete records without adding text.`,
    'Composition: centered crate/display lot, top area readable for UI title, 4:3, no text.'
  ].join('\n');
}

function buildItemPrompt(item: (typeof gameConfig.items)[number]) {
  return [
    stylePrefix,
    'Asset type: 1:1 collectible item icon',
    `Primary request: Three Kingdoms treasure auction item icon, ${item.name}, category ${item.category}, rarity ${item.rarity}.`,
    `State: clean auction-ready collectible; ${item.setId ? `premium set-piece finish for set ${item.setId}` : 'standalone collectible'}; emphasize shape, material, and value tier rather than damage or authenticity marks.`,
    'Composition: single centered object, generous padding, clean readable silhouette, no extra unrelated objects, no text.'
  ].join('\n');
}

const roleAssets = gameConfig.roles.flatMap((role) => [
  {
    id: `role_${role.id}_portrait`,
    category: 'roles',
    spec: '768x1024 / 3:4 / PNG',
    prompt: buildRolePrompt(role, 'portrait')
  },
  {
    id: `role_${role.id}_avatar`,
    category: 'roles',
    spec: '512x512 / 1:1 / PNG',
    prompt: buildRolePrompt(role, 'avatar')
  }
]);

const containerAssets = [
  ...gameConfig.containers.map((container) => ({
    id: `container_${container.id}_${container.artKey}`,
    category: 'containers',
    spec: '1024x768 / 4:3 / PNG',
    prompt: buildContainerPrompt(container)
  })),
  ...gameConfig.scriptedRounds.map((container) => ({
    id: `container_${container.id}_${container.artKey}`,
    category: 'containers',
    spec: '1024x768 / 4:3 / PNG',
    prompt: buildContainerPrompt(container)
  }))
];

const itemAssets = gameConfig.items.map((item) => ({
  id: `item_${item.iconKey}`,
  category: 'items',
  spec: '512x512 / 1:1 / PNG',
  prompt: buildItemPrompt(item)
}));

const uiAssets = [
  {
    id: 'background_auction_hall',
    category: 'backgrounds',
    spec: '1920x1080 / 16:9 / PNG',
    prompt: `${stylePrefix}\nAsset type: web game background\nPrimary request: wide establishing shot of a Three Kingdoms treasure auction hall, lacquer wood beams, bronze lanterns, jade display cases, warm rice-paper light, empty central auction table, no text.`
  },
  {
    id: 'background_black_market',
    category: 'backgrounds',
    spec: '1920x1080 / 16:9 / PNG',
    prompt: `${stylePrefix}\nAsset type: web game background\nPrimary request: wide black-market treasure warehouse, sealed wooden crates, bronze locks, lacquer red lantern light, suspenseful but readable, no text.`
  },
  {
    id: 'ui_settlement_plate',
    category: 'ui',
    spec: '1920x1080 / 16:9 / PNG',
    prompt: `${stylePrefix}\nAsset type: reusable UI panel texture\nPrimary request: empty settlement panel texture, lacquer wood, bamboo slip paper center, aged bronze trim, subtle jade ornaments, no text.`
  }
];

const manifest = {
  generatedAt: '2026-05-17',
  stylePrefix,
  counts: {
    roles: roleAssets.length,
    containers: containerAssets.length,
    items: itemAssets.length,
    ui: uiAssets.length,
    total: roleAssets.length + containerAssets.length + itemAssets.length + uiAssets.length
  },
  assets: [...uiAssets, ...roleAssets, ...containerAssets, ...itemAssets]
};

await writeFile(
  new URL('../doc/20260517_美术资产提示词执行清单.json', import.meta.url),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
);
