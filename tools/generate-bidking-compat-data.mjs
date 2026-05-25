import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const reverseRoot = path.join(repoRoot, 'reverse', 'bidking', 'config', 'key_tables_json');
const rawTablesRoot = path.join(repoRoot, 'reverse', 'bidking', 'config', 'tables_tsv');
const outTables = path.join(repoRoot, 'packages', 'bidking-compat', 'src', 'tables');
const promptOutDir = path.join(repoRoot, 'reverse', 'bidking', 'generated_prompts');
const promptOutFile = path.join(promptOutDir, 'bidking_sanguo_item_prompts.json');

const typeCategory = new Map([
  [1, ['基础道具', '杂项']],
  [2, ['竞拍票券', '券契']],
  [3, ['特殊道具', '令牌']],
  [4, ['随机宝箱', '宝匣']],
  [5, ['指定宝箱', '封匣']],
  [6, ['收藏柜', '陈列柜']],
  [7, ['仓库盒', '库箱']],
  [8, ['模拟宝藏', '演武宝藏']],
  [11, ['消耗型道具', '军令消耗']],
  [12, ['头像', '名刺']],
  [13, ['成就勋章', '功勋']],
  [14, ['皮肤', '衣装']],
  [15, ['角色', '竞买人']],
  [16, ['改名卡', '更名牒']],
  [17, ['表情', '表情']],
  [18, ['称号', '称号']],
  [19, ['体验卡', '体验牌']],
  [100, ['特殊藏品', '秘藏']],
  [101, ['家居日用', '府邸日用']],
  [102, ['医疗用品', '医药军需']],
  [103, ['时尚潮流', '锦衣冠服']],
  [104, ['武器装备', '军械兵装']],
  [105, ['矿物珠宝', '矿玉珠宝']],
  [106, ['文玩古董', '文玩古器']],
  [107, ['数码电子', '机巧器具']],
  [108, ['交通工具', '车马舟楫']],
  [109, ['食品烹饪', '酒食香料']],
  [110, ['书籍绘画', '书画典籍']]
]);

const roleIds = [
  'zhugeliang',
  'zhouyu',
  'simayi',
  'diaochan',
  'huatuo',
  'luxun',
  'caocao',
  'sunshangxiang',
  'guanyu',
  'zhaoyun',
  'huangyueying',
  'xunyu',
  'jiaxu',
  'lvmeng',
  'zhangfei',
  'daqiao',
  'xiaoqiao',
  'machao',
  'huangzhong',
  'pangtong'
];

const roleNames = [
  ['卧龙掌眼', '多维线索'],
  ['江东雅鉴', '品类识别'],
  ['冢虎账师', '品质筛选'],
  ['连环谋士', '轮廓揭示'],
  ['神医鉴客', '器类识别'],
  ['东吴书佐', '双类追踪'],
  ['魏武藏家', '随机开示'],
  ['弓腰鉴客', '品质通读'],
  ['义绝武库', '兵装识别'],
  ['常胜护宝', '价值极值'],
  ['玄德掌柜', '军械识别'],
  ['王佐评估', '玉画追踪'],
  ['锦绣掌眼', '织物识别'],
  ['白衣行商', '品质递进'],
  ['虎将竞客', '车马兵装'],
  ['凤雏书鉴', '书画识别'],
  ['水镜文士', '古器追踪'],
  ['巧思工师', '全局估值'],
  ['西凉骑鉴', '高阶品质'],
  ['洛阳名士', '随机洞察']
];

const skillTargetNames = new Map([
  [0, '随机抽样'],
  [1, '按品类命中'],
  [2, '按品质命中'],
  [3, '按藏品命中'],
  [4, '随机品类命中'],
  [5, '随机品质命中'],
  [6, '按排序规则命中'],
  [10, '按占格条件命中']
]);

const effectNames = new Map([
  [1, '显示轮廓尺寸'],
  [2, '统计总占格'],
  [3, '统计平均占格'],
  [4, '统计命中数量'],
  [5, '显示价格'],
  [6, '显示藏品本体'],
  [7, '显示品质'],
  [8, '统计均价'],
  [9, '统计格均价'],
  [10, '统计总价'],
  [11, '显示占格数'],
  [12, '显示品质文本'],
  [13, '显示品类文本'],
  [14, '显示价格位数'],
  [22, '显示完整轮廓']
]);

const qualityPrefix = new Map([
  [0, '杂项'],
  [1, '凡品'],
  [2, '良品'],
  [3, '珍品'],
  [4, '稀世'],
  [5, '传世'],
  [6, '典藏']
]);

const promptSubjectByType = new Map([
  [100, 'rare ceremonial relic with Three Kingdoms court symbolism'],
  [101, 'ancient household object from a Han dynasty manor'],
  [102, 'field medicine vessel, herb kit, or physician tool from an ancient military camp'],
  [103, 'ornate robe accessory, silk textile, or court fashion object'],
  [104, 'weapon, armor piece, banner hardware, or battlefield equipment'],
  [105, 'jade, ore, pearl, gold ornament, or mineral treasure'],
  [106, 'antique scholarly object, bronze, carved wood, incense vessel, or curio'],
  [107, 'mechanical or ingenious ancient device reimagined with bronze and lacquer'],
  [108, 'chariot, saddle, stirrup, boat fitting, or travel artifact'],
  [109, 'banquet vessel, spice jar, wine implement, or culinary relic'],
  [110, 'calligraphy scroll, painting, book volume, bamboo slips, or framed artwork']
]);

const mapThemes = new Map([
  [101, ['洛阳旧宫', '宫廷旧藏', ['宫廷', '玉器', '入门局'], 'medium', 'container_palace']],
  [102, ['江东商船', '江东商船', ['商船', '珠宝', '四人局'], 'medium', 'container_ship']],
  [103, ['西凉军库', '军需旧库', ['兵器', '盔甲', '稳定'], 'low', 'container_armory']],
  [104, ['破败书院', '旧书院', ['古籍', '字画', '低风险'], 'low', 'container_academy']],
  [105, ['黑市密仓', '黑市密仓', ['高波动', '高风险', '密藏'], 'high', 'container_black_market']],
  [106, ['古战场遗址', '战场残库', ['铁器', '军需', '套装'], 'medium', 'container_battlefield']],
  [107, ['河港沉箱', '河港旧藏', ['漆器', '器皿', '潮湿'], 'medium', 'container_ship']],
  [108, ['锦绣织仓', '织造旧库', ['织造', '珠宝', '轻货'], 'low', 'container_palace']],
  [109, ['旧府印库', '官府库房', ['印玺', '竹简', '官造'], 'medium', 'container_academy']]
]);

function readTable(name) {
  return JSON.parse(fs.readFileSync(path.join(reverseRoot, `${name}.json`), 'utf8'));
}

function readTsvRows(name) {
  const file = path.join(rawTablesRoot, `${name}.txt`);
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split('\t'));
}

function parseJsonish(value, fallback) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toNumber(value, fallback = 0) {
  if (value === '' || value === undefined || value === null) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolNumber(value) {
  return toNumber(value) === 1 ? 1 : 0;
}

function toNumberArray(value) {
  const parsed = parseJsonish(value, [0]);
  return Array.isArray(parsed) ? parsed.map((entry) => toNumber(entry)) : [toNumber(parsed)];
}

function toNumberMatrix(value) {
  const parsed = parseJsonish(value, [[0]]);
  if (!Array.isArray(parsed)) {
    return [[toNumber(parsed)]];
  }
  return parsed.map((row) => Array.isArray(row) ? row.map((entry) => toNumber(entry)) : [toNumber(row)]);
}

function toDropItems(value) {
  return toNumberMatrix(value)
    .filter((row) => row.length >= 5)
    .map((row) => ({
      item_type: toNumber(row[0]),
      item_id: toNumber(row[1]),
      min_count: toNumber(row[2], 1),
      max_count: toNumber(row[3], 1),
      drop_weight: toNumber(row[4], 1)
    }));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function weightedRangeMean(ranges, fallback = 1000) {
  let weighted = 0;
  let totalWeight = 0;
  for (const row of ranges) {
    const min = toNumber(row[0], fallback);
    const max = toNumber(row[1], min);
    const weight = toNumber(row[2], 1);
    if (weight <= 0) {
      continue;
    }
    weighted += ((min + max) / 2) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weighted / totalWeight : fallback;
}

function toSkillGroup(value) {
  const parsed = parseJsonish(value, []);
  return Array.isArray(parsed)
    ? parsed
        .filter((row) => Array.isArray(row) && row.length >= 2)
        .map((row) => [toNumber(row[0]), toNumber(row[1])])
    : [];
}

function footprint(slotType) {
  const w = Math.floor(slotType / 10);
  const h = slotType % 10;
  return w > 0 && h > 0 ? { w, h } : { w: 1, h: 1 };
}

function shapeLabel(slotType) {
  const { w, h } = footprint(slotType);
  if (slotType <= 0) return '道具';
  if (w === h) return `${w}格方件`;
  if (w > h) return `${w}x${h}横件`;
  return `${w}x${h}竖件`;
}

function isCollectionType(typeId) {
  return typeId === 100 || (typeId >= 101 && typeId <= 110);
}

function packagedItemName(row) {
  const id = toNumber(row.id);
  const itemTypeIds = toNumberArray(row.item_type_id);
  const primaryType = itemTypeIds[0] ?? 1;
  const category = typeCategory.get(primaryType)?.[1] ?? '杂项';
  const quality = toNumber(row.item_quality);
  const prefix = qualityPrefix.get(quality) ?? '藏品';
  return `${prefix}${category}${shapeLabel(toNumber(row.slot_type))}${id}`;
}

function packagedRewardSummary(reward) {
  return reward
    .filter((row) => row.length >= 4)
    .slice(0, 3)
    .map((row) => `类型${row[0]}:${row[1]} x${row[2]}`)
    .join('、') || '无奖励';
}

function packagedSkillName(row) {
  const target = skillTargetNames.get(toNumber(row.skilltarget)) ?? `目标${row.skilltarget}`;
  const effects = toNumberArray(row.skilleffect_position)
    .map((effectId) => effectNames.get(effectCategoryById.get(effectId)) ?? `效果${effectId}`)
    .join('/');
  return `${target}·${effects}`;
}

function asConstExport(name, typeName, value) {
  return [
    `import type { ${typeName} } from '../schema';`,
    '',
    `export const ${name}: ${typeName}[] = ${JSON.stringify(value, null, 2)};`,
    ''
  ].join('\n');
}

function writeGenerated(filename, content) {
  const banner = '// Generated by tools/generate-bidking-compat-data.mjs. Do not edit by hand.\n';
  fs.writeFileSync(path.join(outTables, filename), `${banner}${content}`, 'utf8');
}

function isSafeNumericJson(value) {
  return /^[\d\s,\[\].-]+$/.test(value);
}

function isSafeConfigToken(value) {
  return /^[A-Za-z0-9_./:[\],-]+$/.test(value);
}

function cleanDisplayText(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<sprite=[^>]+>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstDisplayText(values) {
  for (const value of values) {
    const text = cleanDisplayText(value);
    if (!text || isSafeNumericJson(text) || isSafeConfigToken(text)) {
      continue;
    }
    return text;
  }
  return '';
}

const languagePreviewByKey = new Map(
  readTsvRows('Language')
    .map((row) => [String(row[0] ?? ''), firstDisplayText(row.slice(1))])
    .filter(([key, text]) => key.length > 0 && text.length > 0)
);

function localizedTextForKey(key) {
  return languagePreviewByKey.get(String(key ?? '')) ?? '';
}

function packagedRawRowName(table, label, row, rowId) {
  if (table === 'Notice') {
    if (String(rowId) === '15') {
      return '竞价确认';
    }
    const typeKey = String(row[4] ?? '');
    const typeLabel = localizedTextForKey(typeKey);
    const explicitTitle = firstDisplayText([row[2]]);
    const bodyText = localizedTextForKey(row[5]) || firstDisplayText([row[8]]);
    if (typeKey.startsWith('notice_title_') && typeLabel) {
      return typeLabel;
    }
    if (explicitTitle) {
      return explicitTitle;
    }
    if (typeKey === 'notice_system' && typeLabel) {
      return `${typeLabel}公告`;
    }
    if (typeLabel) {
      return typeLabel;
    }
    if (bodyText.includes('反馈') || bodyText.includes('问题')) {
      return '问题反馈';
    }
    if (bodyText.includes('封禁') || bodyText.includes('禁止登录')) {
      return '账号通知';
    }
    return '公告';
  }
  return `${label}${rowId}`;
}

function packagedRawRowDescription(table, label, row, index) {
  if (table === 'Notice') {
    if (String(row[0] ?? '') === '15') {
      return '出价超过确认阈值，请重新确认后再试';
    }
    return localizedTextForKey(row[5])
      || firstDisplayText([row[8], row[2]])
      || `${label} ${index + 1}`;
  }
  return `${label}配置行 ${index + 1}，保留结构、数值和资源键，显示文本使用本项目包装。`;
}

function sanitizeTableCell(table, rowId, columnIndex, value) {
  const cell = String(value ?? '');
  if (cell === '' || isSafeNumericJson(cell)) {
    return cell;
  }
  if ((table === 'DirtyWords' && columnIndex > 0) || (table.startsWith('Language') && columnIndex > 0)) {
    return `${table.toLowerCase()}_${rowId}_${columnIndex}`;
  }
  if (/^https?:\/\//i.test(cell)) {
    return `external_url_${rowId}_${columnIndex}`;
  }
  if (isSafeConfigToken(cell)) {
    return cell;
  }
  return `text_${table}_${rowId}_${columnIndex}`;
}

function toRawTableRows(table, label) {
  return readTsvRows(table).map((row, index) => {
    const rowId = String(row[0] || index + 1);
    return {
      id: rowId,
      table,
      columns: row.map((cell, columnIndex) => sanitizeTableCell(table, rowId, columnIndex, cell)),
      packaged_name: packagedRawRowName(table, label, row, rowId),
      packaged_desc: packagedRawRowDescription(table, label, row, index)
    };
  });
}

const skillEffectRows = readTable('SkillEffect');
const effectCategoryById = new Map(skillEffectRows.map((row) => [toNumber(row.EffectId), toNumber(row.Category)]));

const items = readTable('Item').map((row) => {
  const itemTypeIds = toNumberArray(row.item_type_id);
  const primaryType = itemTypeIds[0] ?? 1;
  return {
    id: toNumber(row.id),
    item_name: row.item_name ?? '',
    item_nm: row.item_nm ?? '',
    item_desc: row.item_desc ?? '',
    item_type_id: primaryType,
    item_type_ids: itemTypeIds,
    slot_type: toNumber(row.slot_type),
    item_quality: toNumber(row.item_quality),
    base_value: toNumber(row.base_value),
    in_case: toNumber(row.in_case),
    is_tradable: toNumber(row.is_tradable),
    binds_on_purchase: toNumber(row.binds_on_purchase),
    is_auction: toNumber(row.is_auction),
    auction_baseprice: toNumberArray(row.auction_baseprice),
    grid_count: toNumber(row.grid_count),
    transaction_tax_rate: toNumberMatrix(row.transaction_tax_rate),
    max_stack_size: toNumber(row.max_stack_size),
    max_per_listing: toNumber(row.max_per_listing),
    collectible_item_type_id: toNumberArray(row.collectible_item_type_id),
    skills: toNumberArray(row.skills),
    specified_obtain: toNumberMatrix(row.specified_obtain),
    drop_group_id: toNumber(row.drop_group_id),
    show_item: toNumberArray(row.show_item),
    icon_path: row.icon_path ?? '',
    icon_atlas: row.icon_atlas ?? '',
    collection: toNumber(row.collection),
    rank7count: toNumber(row.rank7count),
    item_access: toNumberArray(row.item_access),
    collection_coin: toNumber(row.collection_coin),
    number: toNumberArray(row.number),
    number_weight: toNumberArray(row.number_weight),
    cost: toNumberArray(row.cost),
    model_3D: row.model_3D ?? '',
    is_show: toNumber(row.is_show),
    exchangeId: toNumberArray(row.exchangeId),
    is_sale: toNumber(row.is_sale),
    room_price: row.room_price === '' ? '' : toNumber(row.room_price),
    packaged_name: packagedItemName(row),
    packaged_category: typeCategory.get(primaryType)?.[1] ?? '杂项',
    packaged_icon_key: `bidking_item_${row.id}`
  };
});

const heroes = readTable('Hero').map((row, index) => ({
  id: toNumber(row.id),
  name: row.name ?? '',
  gender: toNumber(row.gender),
  hero_class: row.hero_class ?? '',
  background: row.background ?? '',
  hero_skill_name: row.hero_skill_name ?? '',
  hero_skill_description: row.hero_skill_description ?? '',
  hero_effect_description: row.hero_effect_description ?? '',
  cast_type: toNumberArray(row.cast_type),
  icon_path: row.icon_path ?? '',
  icon_path2: row.icon_path2 ?? '',
  icon_path3: row.icon_path3 ?? '',
  illustration_path: row.illustration_path ?? '',
  bg_path: row.bg_path ?? '',
  access: toNumberArray(row.access),
  voices: toNumberArray(row.voices),
  battleBgm: toNumberArray(row.battleBgm),
  hero_tag: toNumber(row.hero_tag),
  hero_task_group: toNumberArray(row.hero_task_group),
  packaged_name: roleNames[index]?.[0] ?? `三国竞买人${row.id}`,
  packaged_title: roleNames[index]?.[1] ?? '原表技能',
  packaged_role_id: roleIds[index] ?? `hero_${row.id}`
}));

const skills = readTable('Skill').map((row) => ({
  id: toNumber(row.id),
  skill_group: row.skill_group ?? '',
  skill_name: row.skill_name ?? '',
  skilldesc: row.skilldesc ?? '',
  skill_textshow: row.skill_textshow ?? '',
  skill_type: toNumber(row.skill_type),
  skilltarget: toNumber(row.skilltarget),
  skilltargetvalue: toNumberArray(row.skilltargetvalue),
  skilltarget2: toNumber(row.skilltarget2),
  skilltargetvalue2: toNumberArray(row.skilltargetvalue2),
  skilltarget3: toNumber(row.skilltarget3),
  skilltargetvalue3: toNumberArray(row.skilltargetvalue3),
  skill_count_type: toNumber(row.skill_count_type),
  skill_count: toNumber(row.skill_count),
  skilleffect_position: toNumberArray(row.skilleffect_position),
  skill_icon: row.skill_icon ?? '',
  skill_value: toNumberArray(row.skill_value),
  skill_active_type: toNumber(row.skill_active_type),
  skill_opt: toNumber(row.skill_opt),
  skill_opt_param1: toNumberMatrix(row.skill_opt_param1),
  skill_opt_param2: toNumberMatrix(row.skill_opt_param2),
  skill_cast: toNumberMatrix(row.skill_cast),
  skill_round: toNumber(row.skill_round),
  skill_CD: toNumber(row.skill_CD),
  show_type: toNumber(row.show_type),
  packaged_name: packagedSkillName(row),
  packaged_desc: `原表技能链路：${skillTargetNames.get(toNumber(row.skilltarget)) ?? `目标${row.skilltarget}`}，效果 ${toNumberArray(row.skilleffect_position).join('/') || '无'}。`
}));

const skillEffects = skillEffectRows.map((row) => {
  const category = toNumber(row.Category);
  const effectId = toNumber(row.EffectId);
  return {
    EffectId: effectId,
    Category: category,
    Param: toNumberArray(row.Param),
    effect_key: `category_${category}`,
    effect_desc: effectNames.get(category) ?? `技能效果类别${category}`
  };
});

const skillGroups = readTable('SkillGroup').map((row) => ({
  groupid: toNumber(row.groupid),
  skill_group: toSkillGroup(row.skill_group)
}));

const maps = readTable('Map').map((row) => {
  const id = toNumber(row.id);
  const theme = mapThemes.get(id) ?? mapThemes.get(101);
  return {
    id,
    map_name: row.map_name ?? '',
    map_desc: row.map_desc ?? '',
    map_position: toNumberArray(row.map_position),
    map_icon: row.map_icon ?? '',
    auction_limit_notify: toNumber(row.auction_limit_notify),
    entrust_value: toNumber(row.entrust_value),
    entrust_bidmap: toNumber(row.entrust_bidmap),
    entrust_cost: toNumberArray(row.entrust_cost),
    entrust_prob: toNumber(row.entrust_prob),
    type: toNumber(row.type),
    entrust_num: toNumberArray(row.entrust_num),
    is_open: toNumber(row.is_open),
    mapgroup: toNumber(row.mapgroup),
    world_process: toNumber(row.world_process),
    daily_counts: toNumber(row.daily_counts),
    open_time: toNumberMatrix(row.open_time),
    packaged_name: theme[0],
    packaged_desc: theme[1],
    art_key: theme[4]
  };
});

const bidMaps = readTable('BidMap').map((row) => {
  const id = toNumber(row.id);
  const parentMapId = toNumber(row.parent_map_id);
  const theme = mapThemes.get(parentMapId) ?? mapThemes.get(101);
  const bidderNumber = toNumber(row.bidder_number);
  const dropRoute = toNumberArray(row.drop_group_id);
  const [routeType, routeGroup, routeMin, routeMax] = dropRoute;
  const isMultiplayer = bidderNumber > 1;
  const risk = isMultiplayer ? theme[3] : 'low';
  const estimateRate = risk === 'high'
    ? [0.46, 1.56]
    : risk === 'medium'
      ? [0.58, 1.36]
      : [0.7, 1.22];
  const itemCountMin = routeType === 9999 && routeMin ? routeMin : 1;
  const itemCountMax = routeType === 9999 && routeMax ? routeMax : Math.max(itemCountMin, 1);
  return {
    id,
    s_map_name: row.s_map_name ?? '',
    s_map_logo: row.s_map_logo ?? '',
    s_map_togname: row.s_map_togname ?? '',
    s_map_desc: row.s_map_desc ?? '',
    parent_map_id: parentMapId,
    is_visiable: toNumber(row.is_visiable),
    map_group: toNumberMatrix(row.map_group),
    map_income: row.map_income ?? '',
    map_cell: toNumber(row.map_cell),
    currency_cost: toNumberArray(row.currency_cost),
    item_cost: toNumberMatrix(row.item_cost),
    map_time: toNumberArray(row.map_time).filter((value) => value > 0),
    required_items: toNumberMatrix(row.required_items),
    special_output_items: toNumberMatrix(row.special_output_items),
    drop_group_id: dropRoute,
    bidder_number: bidderNumber,
    auction_rounds_rate: toNumberArray(row.auction_rounds_rate),
    map_random_skill: toNumberArray(row.map_random_skill),
    map_resource: row.map_resource ?? '',
    tap_up: toNumber(row.tap_up),
    item_count_min: itemCountMin,
    item_count_max: itemCountMax,
    public_estimate_min_rate: estimateRate[0],
    public_estimate_max_rate: estimateRate[1],
    packaged_name: `${theme[0]}·${id}`,
    packaged_desc: `${theme[1]}，${bidderNumber}人拍局，掉落组 ${routeGroup ?? 0}，共 ${itemCountMin}-${itemCountMax} 件候选藏品。`,
    packaged_tags: [...theme[2], `${bidderNumber}人`, `${itemCountMin}-${itemCountMax}件`],
    risk,
    art_key: theme[4]
  };
});

const drops = readTable('Drop').map((row) => ({
  group_id: toNumber(row.group_id),
  weight_type: toNumber(row.weight_type),
  items_list: toDropItems(row.items_list)
}));

const rankMaps = readTable('RankMap').map((row) => ({
  id: toNumber(row.id),
  match_time: toNumberMatrix(row.match_time),
  role_spawn: toNumberMatrix(row.role_spawn),
  min_bid_range: toNumberMatrix(row.min_bid_range),
  bid_type: toNumberArray(row.bid_type)
}));

const rankAis = readTable('RankAi').map((row) => {
  const minBidRatio = toNumberMatrix(row.min_bid_ratio);
  const bidPk = toNumberMatrix(row.bid_pk);
  const averageRatio = weightedRangeMean(minBidRatio, 900);
  const averagePk = weightedRangeMean(bidPk, averageRatio);
  const useProbability = toNumber(row.item_use_probability);
  return {
    id: toNumber(row.id),
    role_id: toNumber(row.role_id),
    round_count: toNumber(row.round_count),
    min_bid_ratio: minBidRatio,
    item_use_probability: useProbability,
    item_usage_group: toNumberMatrix(row.item_usage_group),
    bid_time: toNumberMatrix(row.bid_time),
    bid_pk: bidPk,
    risk_appetite: clamp(averageRatio / 2000, 0.05, 0.98),
    bluff_chance: clamp(useProbability / 2500, 0.02, 0.42),
    overpay_tolerance: clamp((averagePk - 1000) / 2600, 0.02, 0.36),
    bid_aggression: clamp(averagePk / 2000, 0.12, 1)
  };
});

const battleItemNames = ['掌眼令', '观局灯', '铁算盘', '封箱签', '试探牌', '观局札', '稳盘券', '稳盘符'];
const battleItems = readTable('BattleItem').map((row, index) => {
  const name = battleItemNames[index % battleItemNames.length];
  return {
    id: toNumber(row.id),
    item_type_id: toNumberArray(row.item_type_id),
    item_quality: toNumber(row.item_quality),
    battle_item_type: toNumber(row.battle_item_type),
    item_name: `battle_item_name_${row.id}`,
    item_desc: `battle_item_desc_${row.id}`,
    skill_group: toNumber(row.battle_item_type),
    packaged_name: `${name}${row.id}`,
    packaged_desc: `${name}：原局内拍卖辅助道具，品质 ${toNumber(row.item_quality)}，类型 ${toNumber(row.battle_item_type)}。`
  };
});

const itemTypes = readTsvRows('Item_Type').map((row) => {
  const id = toNumber(row[0]);
  const category = typeCategory.get(id);
  return {
    id,
    configFileName: row[1] ?? '',
    type_name: row[3] ?? '',
    showin_tradingbuy: toBoolNumber(row[4]),
    showin_auction: toBoolNumber(row[5]),
    store_type: toNumber(row[6]),
    icon: row[7] ?? '',
    packaged_name: category?.[1] ?? `分类${id}`,
    packaged_source_name: category?.[0] ?? `类型${id}`
  };
});

const cabinets = readTsvRows('Cabinet').map((row, index) => {
  const id = toNumber(row[0]);
  const locationType = toNumberArray(row[4]);
  const primaryType = locationType.find((typeId) => isCollectionType(typeId)) ?? locationType[0] ?? 0;
  const category = primaryType === 100
    ? '秘藏总柜'
    : typeCategory.get(primaryType)?.[1] ?? '综合藏柜';
  return {
    id,
    resource_name: row[3] ?? '',
    location_type: locationType,
    max_slot_limit: toNumber(row[5]),
    quality_requirement: toNumberArray(row[6]),
    slot_count: toNumberArray(row[7]),
    place_max: toNumber(row[8]),
    coinbonus: toNumber(row[9]),
    timemax: toNumber(row[10]),
    bg_offset: toNumberArray(row[11]),
    resource: row[12] ?? '',
    resource2: row[13] ?? '',
    packaged_name: `${category}${index + 1}`,
    packaged_desc: `可陈列 ${locationType.length > 1 ? '多类' : category}，上限 ${toNumber(row[5])} 件，展示槽 ${toNumberArray(row[7]).join('x')}。`
  };
});

const levelUps = readTsvRows('LevelUp').map((row) => ({
  id: toNumber(row[0]),
  collection_value: toNumber(row[3]),
  level_reward: toNumberMatrix(row[4]),
  bass_value: toNumber(row[5]),
  bass_reward: toNumberMatrix(row[6]),
  big_bass_reward: toNumberMatrix(row[7]),
  packaged_name: `掌柜等级 ${toNumber(row[0])}`,
  reward_summary: packagedRewardSummary(toNumberMatrix(row[4]))
}));

const missions = readTsvRows('Mission').map((row) => {
  const id = toNumber(row[0]);
  const conditions = toNumberMatrix(row[9]);
  const reward = toNumberMatrix(row[10]);
  const group = toNumber(row[14]);
  return {
    Id: id,
    missionname: row[3] ?? '',
    missiondec: row[4] ?? '',
    type: toNumber(row[5]),
    display: toNumber(row[6]),
    refreshtype: toNumber(row[7]),
    operationtype: toNumber(row[8]),
    conditions,
    reward,
    choosereward: toNumberMatrix(row[11]),
    chooserewardnum: toNumber(row[12]),
    premissionids: toNumberArray(row[13]),
    group,
    steamachievement: toNumber(row[15]),
    finish_show: toNumber(row[16]),
    packaged_name: `任务 ${id}`,
    packaged_desc: `条件 ${conditions.map((condition) => condition.join(':')).join(' / ') || '无'}；奖励 ${packagedRewardSummary(reward)}。`,
    packaged_group: group > 0 ? `任务组 ${group}` : '通用任务'
  };
});

const heroSkins = readTsvRows('HeroSkin').map((row, index) => {
  const skinHero = toNumber(row[3]);
  const hero = heroes[index] ?? heroes.find((candidate) => candidate.id === skinHero);
  return {
    id: toNumber(row[0]),
    skinhero: skinHero,
    name: row[4] ?? '',
    skin_class: row[5] ?? '',
    skinground: row[6] ?? '',
    icon_path: row[7] ?? '',
    icon_path2: row[8] ?? '',
    icon_path3: row[9] ?? '',
    illustration_path: row[10] ?? '',
    bg_path: row[11] ?? '',
    access: toNumberArray(row[12]),
    voices: toNumberArray(row[13]),
    battleBgm: toNumberArray(row[14]),
    hero_tag: toNumber(row[15]),
    packaged_name: `${hero?.packaged_name ?? `竞买人${skinHero}`}衣装`,
    packaged_desc: `绑定竞买人 ${skinHero}，语音 ${toNumberArray(row[13]).length} 条，BGM ${toNumberArray(row[14]).join('/') || '无'}。`
  };
});

const shops = readTsvRows('Shop').map((row) => ({
  id: toNumber(row[0]),
  type: toNumber(row[1]),
  typeicon: row[2] ?? '',
  name: row[4] ?? '',
  shopicon: row[5] ?? '',
  tabname: row[6] ?? '',
  tap: toNumber(row[7]),
  buyuitype: toNumber(row[8]),
  currencydisplay: toNumberArray(row[9]),
  randcounts: toNumber(row[10]),
  autofresh: toNumber(row[11]),
  ticket: toNumber(row[12]),
  setting: toNumber(row[13]),
  random: toNumber(row[14]),
  packaged_name: `珍宝商铺 ${toNumber(row[0])}`,
  packaged_desc: `类型 ${toNumber(row[1])}，购买界面 ${toNumber(row[8])}，${toNumber(row[11]) ? '自动刷新' : '固定商品'}。`
}));

const shopItems = readTsvRows('ShopItem').map((row) => {
  const itemRefs = toNumberMatrix(row[6]);
  const firstItemId = itemRefs[0]?.[0];
  const firstItem = firstItemId ? items.find((item) => item.id === firstItemId) : undefined;
  return {
    id: toNumber(row[0]),
    shopid: toNumber(row[1]),
    order: toNumber(row[2]),
    name: row[3] ?? '',
    type: toNumber(row[4]),
    front: toNumberArray(row[5]),
    itemid: itemRefs,
    buytype: toNumber(row[7]),
    price: toNumberMatrix(row[8]),
    buycounts: toNumber(row[9]),
    randvalue: toNumber(row[10]),
    rate: toNumberArray(row[11]),
    ratevalue: toNumberArray(row[12]),
    pic: row[13] ?? '',
    desc: row[14] ?? '',
    packaged_name: firstItem?.packaged_name ?? `商铺货品 ${toNumber(row[0])}`,
    packaged_desc: `商铺 ${toNumber(row[1])} 第 ${toNumber(row[2])} 位，价格 ${toNumberMatrix(row[8]).map((price) => price.join(':')).join(' / ') || '无'}。`
  };
});

const ticketRows = readTsvRows('Ticket').map((row) => ({
  id: toNumber(row[0]),
  name: `ticket_${row[0] ?? '0'}`,
  type: toNumber(row[2]),
  recovertime: toNumber(row[3]),
  max: toNumber(row[4]),
  maxlimit: toNumber(row[5]),
  buyrefresh: toNumber(row[6]),
  buycounts: toNumber(row[7]),
  buyquantity: toNumber(row[8]),
  buycurrency: toNumber(row[9]),
  price: toNumberArray(row[10]),
  reserveticket: toNumber(row[11]),
  reservetime: toNumber(row[12]),
  reservelimit: toNumber(row[13]),
  packaged_name: '竞拍票',
  packaged_desc: `上限 ${toNumber(row[4])}，恢复 ${toNumber(row[3])} 秒，购买数量 ${toNumber(row[8])}。`
}));

const numberRows = readTsvRows('Number').map((row) => {
  const quality = toNumber(row[4]);
  return {
    Id: toNumber(row[0]),
    name: row[3] ?? '',
    quality,
    counts: toNumber(row[5]),
    numberbonus: toNumber(row[6]),
    bg: row[7] ?? '',
    bid: toNumber(row[8]),
    packaged_name: `${qualityPrefix.get(quality) ?? '藏品'}收藏档`,
    packaged_desc: `需要 ${toNumber(row[5])} 件，收益加成 ${toNumber(row[6])}。`
  };
});

const uiWnds = readTable('UIWnd').map((row) => ({
  id: toNumber(row.id),
  Name: row.Name ?? '',
  Beizhu: `uiwnd_${row.id}`,
  Path: row.Path ?? '',
  IsMainWnd: toBoolNumber(row.IsMainWnd),
  Layer: toNumber(row.Layer),
  CommonSet: toBoolNumber(row.CommonSet),
  ResSet: toNumberArray(row.ResSet),
  BGM: toNumberArray(row.BGM),
  IsBlur: toNumber(row.IsBlur),
  packaged_name: `界面 ${row.Name ?? row.id}`,
  packaged_desc: `Prefab ${row.Path ?? ''}，层级 ${toNumber(row.Layer)}，BGM ${toNumberArray(row.BGM).join('/') || '无'}。`
}));

const sounds = readTable('Sound').map((row) => ({
  Id: toNumber(row.Id),
  Desc: `sound_${row.Id}`,
  Name: row.Name ?? '',
  FullPathName: row.FullPathName ?? '',
  Type: toNumber(row.Type),
  PanLevel: toNumber(row.PanLevel),
  Volume: toNumber(row.Volume, 1),
  MinDistance: toNumber(row.MinDistance),
  Spread: toNumber(row.Spread),
  IsLoop: toBoolNumber(row.IsLoop),
  Delay: toNumber(row.Delay),
  FadeInTime: toNumber(row.FadeInTime),
  FadeOutTime: toNumber(row.FadeOutTime),
  CurMaxPlayingCount: toNumber(row.CurMaxPlayingCount),
  Priority: toNumber(row.Priority),
  i18nEnabled: toNumber(row.i18nEnabled),
  i18nPathKey: row.i18nPathKey ?? '',
  packaged_name: `音频 ${row.Name ?? row.Id}`,
  packaged_desc: `路径 ${row.FullPathName ?? ''}，音量 ${toNumber(row.Volume, 1)}，${toBoolNumber(row.IsLoop) ? '循环' : '单次'}。`
}));

const constants = readTable('Constant').map((row) => ({
  Id: row.Id ?? '',
  Name: `constant_${row.Id ?? ''}`,
  Type: row.Type ?? '',
  Value: row.Value ?? '',
  packaged_desc: `全局常量 ${row.Id ?? ''}，类型 ${row.Type ?? ''}。`
}));

const conditions = readTable('Condition').map((row) => ({
  id: toNumber(row.id),
  type: toNumber(row.type),
  preorconditions: toNumberArray(row.preorconditions),
  preorconditionsparam: toNumberMatrix(row.preorconditionsparam),
  preconditions: toNumberArray(row.preconditions),
  preconditionsparam: toNumberMatrix(row.preconditionsparam),
  condition: toNumber(row.condition),
  conditionparams: toNumberArray(row.conditionparams),
  divided: toNumber(row.divided),
  maxvalue: toNumber(row.maxvalue),
  desc: row.desc ?? '',
  packaged_desc: `条件 ${toNumber(row.condition)}，参数 ${toNumberArray(row.conditionparams).join('/') || '无'}。`
}));

const rawTableConfigs = [
  ['Access', 'Access', '功能入口'],
  ['Achievement', 'Achievement', '成就'],
  ['Activity', 'Activity', '活动'],
  ['Area', 'Area', '地区'],
  ['DirtyWords', 'DirtyWords', '输入过滤'],
  ['Dlc', 'Dlc', '扩展包'],
  ['Emoji', 'Emoji', '表情'],
  ['ErrorCode', 'ErrorCode', '错误码'],
  ['Exchange_Restock', 'ExchangeRestock', '兑换刷新'],
  ['GiftPackage', 'GiftPackage', '礼包'],
  ['Guide', 'Guide', '引导'],
  ['GuildArea', 'GuildArea', '协会地区'],
  ['GuildPermissions', 'GuildPermissions', '协会权限'],
  ['GuildPoints', 'GuildPoints', '协会积分'],
  ['GuildResources', 'GuildResources', '协会资源'],
  ['head', 'Head', '头像称号'],
  ['ItemRestock', 'ItemRestock', '物品刷新'],
  ['Language', 'Language', '本地化'],
  ['LanguageListen', 'LanguageListen', '语音本地化'],
  ['LanguageName', 'LanguageName', '随机名称'],
  ['Mail', 'Mail', '邮件'],
  ['Notice', 'Notice', '公告弹窗'],
  ['Pay', 'Pay', '充值档位'],
  ['PurchaseList', 'PurchaseList', '平台商品'],
  ['Rank', 'Rank', '排行榜'],
  ['RankReward', 'RankReward', '榜单奖励'],
  ['Sim', 'Sim', '模拟参数'],
  ['WareHouse', 'WareHouse', '仓库分类']
];

writeGenerated('BidMap.ts', asConstExport('BidMap', 'BidKingBidMapRow', bidMaps));
writeGenerated('Drop.ts', [
  asConstExport('Drop', 'BidKingDropRow', drops),
  'export function dropsForGroup(dropGroupId: number): BidKingDropItemRow[] {',
  '  return Drop.find((drop) => drop.group_id === dropGroupId)?.items_list.slice() ?? [];',
  '}',
  ''
].join('\n').replace(
  "import type { BidKingDropRow } from '../schema';",
  "import type { BidKingDropItemRow, BidKingDropRow } from '../schema';"
));
writeGenerated('RankMap.ts', asConstExport('RankMap', 'BidKingRankMapRow', rankMaps));
writeGenerated('RankAi.ts', asConstExport('RankAi', 'BidKingRankAiRow', rankAis));
writeGenerated('Map.ts', asConstExport('Map', 'BidKingMapRow', maps));
writeGenerated('BattleItem.ts', asConstExport('BattleItem', 'BidKingBattleItemRow', battleItems));
writeGenerated('Item.ts', [
  asConstExport('Item', 'BidKingItemRow', items),
  'export function itemById(id: number): BidKingItemRow | undefined {',
  '  return Item.find((item) => item.id === id);',
  '}',
  '',
  'export function itemFootprint(slotType: number): { w: number; h: number } {',
  '  const w = Math.floor(slotType / 10);',
  '  const h = slotType % 10;',
  '  return w > 0 && h > 0 ? { w, h } : { w: 1, h: 1 };',
  '}',
  ''
].join('\n'));

writeGenerated('Hero.ts', asConstExport('Hero', 'BidKingHeroRow', heroes));
writeGenerated('Skill.ts', [
  asConstExport('Skill', 'BidKingSkillRow', skills),
  'export function skillById(id: number): BidKingSkillRow | undefined {',
  '  return Skill.find((skill) => skill.id === id);',
  '}',
  ''
].join('\n'));
writeGenerated('SkillEffect.ts', [
  asConstExport('SkillEffect', 'BidKingSkillEffectRow', skillEffects),
  'export function skillEffectById(id: number): BidKingSkillEffectRow | undefined {',
  '  return SkillEffect.find((effect) => effect.EffectId === id);',
  '}',
  ''
].join('\n'));
writeGenerated('SkillGroup.ts', asConstExport('SkillGroup', 'BidKingSkillGroupRow', skillGroups));
writeGenerated('ItemType.ts', asConstExport('ItemType', 'BidKingItemTypeRow', itemTypes));
writeGenerated('Cabinet.ts', asConstExport('Cabinet', 'BidKingCabinetRow', cabinets));
writeGenerated('LevelUp.ts', [
  asConstExport('LevelUp', 'BidKingLevelUpRow', levelUps),
  'export function levelUpById(id: number): BidKingLevelUpRow | undefined {',
  '  return LevelUp.find((level) => level.id === id);',
  '}',
  ''
].join('\n'));
writeGenerated('Mission.ts', asConstExport('Mission', 'BidKingMissionRow', missions));
writeGenerated('HeroSkin.ts', asConstExport('HeroSkin', 'BidKingHeroSkinRow', heroSkins));
writeGenerated('Shop.ts', asConstExport('Shop', 'BidKingShopRow', shops));
writeGenerated('ShopItem.ts', [
  asConstExport('ShopItem', 'BidKingShopItemRow', shopItems),
  'export function compareShopItemsByStoreOrder(left: BidKingShopItemRow, right: BidKingShopItemRow): number {',
  '  return right.order - left.order || right.id - left.id;',
  '}',
  '',
  'export function shopItemsForShop(shopId: number): BidKingShopItemRow[] {',
  '  return ShopItem.filter((item) => item.shopid === shopId).sort(compareShopItemsByStoreOrder);',
  '}',
  ''
].join('\n').replace(
  "import type { BidKingShopItemRow } from '../schema';",
  "import type { BidKingShopItemRow } from '../schema';"
));
writeGenerated('Ticket.ts', asConstExport('Ticket', 'BidKingTicketRow', ticketRows));
writeGenerated('Number.ts', asConstExport('NumberTable', 'BidKingNumberRow', numberRows));
writeGenerated('UIWnd.ts', asConstExport('UIWnd', 'BidKingUIWndRow', uiWnds));
writeGenerated('Sound.ts', asConstExport('Sound', 'BidKingSoundRow', sounds));
writeGenerated('Constant.ts', asConstExport('Constant', 'BidKingConstantRow', constants));
writeGenerated('Condition.ts', asConstExport('Condition', 'BidKingConditionRow', conditions));
for (const [sourceName, exportName, label] of rawTableConfigs) {
  writeGenerated(`${exportName}.ts`, asConstExport(exportName, 'BidKingRawTableRow', toRawTableRows(sourceName, label)));
}

fs.mkdirSync(promptOutDir, { recursive: true });
const prompts = items
  .filter((item) => isCollectionType(item.item_type_id) && item.slot_type > 0)
  .map((item) => {
    const fp = footprint(item.slot_type);
    const canvas = { width: fp.w * 256, height: fp.h * 256 };
    const sourceType = typeCategory.get(item.item_type_id)?.[0] ?? '道具';
    const subject = promptSubjectByType.get(item.item_type_id) ?? 'ancient collectible object';
    return {
      itemId: item.id,
      tableName: 'Item',
      sourceTypeId: item.item_type_id,
      sourceType,
      packagedName: item.packaged_name,
      packagedCategory: item.packaged_category,
      quality: item.item_quality,
      baseValue: item.base_value,
      collectionCoinPerSecond: item.collection_coin,
      collectionCoinPerHour: Number((item.collection_coin * 3600).toFixed(1)),
      slotType: item.slot_type,
      footprint: fp,
      canvas,
      output: `apps/web/public/art/generated/bidking/items/bidking_item_${item.id}.png`,
      prompt: [
        'Use case: stylized-concept',
        `Asset type: transparent PNG game inventory collectible, exact canvas ${canvas.width}x${canvas.height}px, footprint ${fp.w}x${fp.h} grid cells.`,
        `Primary request: Create one ${subject} redesigned as a Three Kingdoms / ancient Chinese treasure-hall collectible.`,
        `Packaging: 三国/古代风格, lacquer, bronze, jade, silk, bamboo, forged iron, aged paper, or palace craftsmanship as appropriate; keep the gameplay identity as ${sourceType}.`,
        `Composition: single object only, no frame, no UI badge, no text, no label, no watermark; the object silhouette should fill the ${fp.w}:${fp.h} footprint with 8-12% transparent padding and respect the non-square aspect ratio.`,
        'Background: transparent alpha. If using chroma-key workflow, render on a perfectly flat solid #00ff00 background with no shadow, then remove the key to alpha.',
        'Lighting: clean catalog lighting baked into the object only, crisp readable edges for warehouse-grid placement.',
        'Avoid: modern UI plate, square icon card, scene background, cast shadow, price tag, imitation markings, broken-state styling.'
      ].join('\n')
    };
  });

fs.writeFileSync(promptOutFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), count: prompts.length, prompts }, null, 2)}\n`, 'utf8');
console.log(`Generated ${items.length} Item rows, ${heroes.length} Hero rows, ${skills.length} Skill rows, ${skillEffects.length} SkillEffect rows.`);
console.log(`Wrote ${prompts.length} collection prompts to ${path.relative(repoRoot, promptOutFile)}.`);
