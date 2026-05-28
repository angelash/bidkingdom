import type { GameConfig } from './schema';

const roles: GameConfig['roles'] = [
  {
    id: 'appraiser',
    name: '珠玉掌眼',
    animal: '雅鉴先生',
    archetype: '珠玉全鉴',
    skillId: 'appraise_value',
    passive: '矿玉珠宝线索准确度提高',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#d8ad5f'
  },
  {
    id: 'restorer',
    name: '器物鉴客',
    animal: '器物行家',
    archetype: '器物辨识',
    skillId: 'single_treasure',
    passive: '府邸日用与机巧器具的轮廓判断更稳定',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#f59e0b'
  },
  {
    id: 'insurer',
    name: '遗珍账房',
    animal: '稳盘账房',
    archetype: '阶品递验',
    skillId: 'single_treasure',
    passive: '低到中高阶藏品的判断更稳健',
    cooldownRounds: 2,
    usesPerMatch: 1,
    color: '#b98536'
  },
  {
    id: 'mentor_teacher',
    name: '启蒙师',
    animal: '书院授业人',
    archetype: '轮廓品质揭示',
    skillId: 'single_treasure',
    passive: '每轮更容易获得未知藏品轮廓线索',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#c98e3e'
  },
  {
    id: 'trend_hunter',
    name: '声闻客',
    animal: '市井名客',
    archetype: '渐进验品',
    skillId: 'appraise_value',
    passive: '连续轮次的品质线索更稳定',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#ec4899'
  },
  {
    id: 'market_vendor',
    name: '市井货眼',
    animal: '摊市行家',
    archetype: '低价值避坑',
    skillId: 'appraise_value',
    passive: '低品质藏品估值更保守',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#f97316'
  },
  {
    id: 'historian',
    name: '古籍清鉴',
    animal: '旧籍研究者',
    archetype: '文玩古器识别',
    skillId: 'single_treasure',
    passive: '文书、玉器、印章线索命中率提高',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#eab308'
  },
  {
    id: 'layout_artist',
    name: '画格匠',
    animal: '仓格画师',
    archetype: '轮廓预判',
    skillId: 'single_treasure',
    passive: '大尺寸藏品轮廓更容易被识别',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#60a5fa'
  },
  {
    id: 'veteran_broker',
    name: '老行家',
    animal: '古董经纪',
    archetype: '高价值洞察',
    skillId: 'appraise_value',
    passive: '高估值仓的总价区间更窄',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#a855f7'
  },
  {
    id: 'fashion_tailor',
    name: '锦衣织造',
    animal: '衣料鉴别师',
    archetype: '衣冠辨识',
    skillId: 'single_treasure',
    passive: '服饰、织物、皮革类占格线索更清晰',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#fb7185'
  },
  {
    id: 'intel_analyst',
    name: '情报主簿',
    animal: '商路主簿',
    archetype: '数目算筹',
    skillId: 'read_intent',
    passive: '更容易从逐轮信息中归纳整场数目',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#c66a3a'
  },
  {
    id: 'field_medic',
    name: '医典官',
    animal: '医官鉴客',
    archetype: '医药军需辨识',
    skillId: 'single_treasure',
    passive: '医药、器物、盔甲类尺寸提示更准确',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#b98536'
  },
  {
    id: 'old_noble',
    name: '世家稀鉴',
    animal: '世家藏家',
    archetype: '传世器物识别',
    skillId: 'single_treasure',
    passive: '宫廷、礼器、珠宝类高价值线索更容易出现',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#facc15'
  },
  {
    id: 'treasure_hunter',
    name: '荒仓探客',
    animal: '荒仓探客',
    archetype: '杂乱仓粗筛',
    skillId: 'single_treasure',
    passive: '高波动仓中更容易发现异常轮廓',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#f59e0b'
  },
  {
    id: 'academy_professor',
    name: '太学博鉴',
    animal: '太学博士',
    archetype: '食器古器双鉴',
    skillId: 'appraise_value',
    passive: '酒食香料与文玩古器线索更稳定',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#d8ad5f'
  },
  {
    id: 'caravan_master',
    name: '声闻行商',
    animal: '远域货主',
    archetype: '双类听风',
    skillId: 'appraise_value',
    passive: '锦衣冠服与机巧器具的轮廓线索更准',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#a66a35'
  },
  {
    id: 'arms_dealer',
    name: '武库掮客',
    animal: '武库掮客',
    archetype: '兵器机械识别',
    skillId: 'single_treasure',
    passive: '兵器、盔甲、马具类高价值格更容易被标记',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#64748b'
  },
  {
    id: 'eastern_appraiser',
    name: '东瀛书鉴',
    animal: '外邦鉴藏客',
    archetype: '书画典籍辨识',
    skillId: 'appraise_value',
    passive: '书画典籍的轮廓与品质线索更稳定',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#ef4444'
  },
  {
    id: 'young_savant',
    name: '少年鉴客',
    animal: '灵感新秀',
    archetype: '多步鉴物',
    skillId: 'single_treasure',
    passive: '连续轮次更容易补全同一藏品的信息',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#8b5cf6'
  },
  {
    id: 'secret_broker',
    name: '隐市线人',
    animal: '暗线掮客',
    archetype: '终局洞见',
    skillId: 'read_intent',
    passive: '第 4、5 轮读取对手心理价更稳定',
    cooldownRounds: 1,
    usesPerMatch: 2,
    color: '#3a1f12'
  }
];

const emptyItems: GameConfig['items'] = [];
const emptyContainers: GameConfig['containers'] = [];
const emptySets: GameConfig['sets'] = [];
const emptyScriptedRounds: GameConfig['scriptedRounds'] = [];

export const gameConfig: GameConfig = {
  roles,
  items: emptyItems,
  containers: emptyContainers,
  sets: emptySets,
  scriptedRounds: emptyScriptedRounds,
  botProfiles: [
    { id: 'conservative', name: '稳健掌柜', riskAppetite: 0.25, bluffChance: 0.05, overpayTolerance: 0.05 },
    { id: 'aggressive', name: '上头行商', riskAppetite: 0.82, bluffChance: 0.2, overpayTolerance: 0.25 },
    { id: 'risk_taker', name: '冒险竞买人', riskAppetite: 0.9, bluffChance: 0.18, overpayTolerance: 0.35 },
    { id: 'clue_reader', name: '线索派', riskAppetite: 0.58, bluffChance: 0.08, overpayTolerance: 0.12 },
    { id: 'trickster', name: '试探客', riskAppetite: 0.55, bluffChance: 0.35, overpayTolerance: 0.16 },
    { id: 'mentor', name: '陪练掌柜', riskAppetite: 0.38, bluffChance: 0.04, overpayTolerance: 0.08 }
  ],
  rules: {
    initialCash: 100000,
    totalRounds: 5,
    minIncrement: 1000
  }
};
