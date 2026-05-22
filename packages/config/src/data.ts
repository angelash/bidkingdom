import type { GameConfig } from './schema';

const roles: GameConfig['roles'] = [
  {
    id: 'appraiser',
    name: '鉴定师',
    animal: '掌眼先生',
    archetype: '稳定估值',
    skillId: 'appraise_value',
    passive: '轮廓与估值线索准确度提高',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#38bdf8'
  },
  {
    id: 'smuggler',
    name: '走私商',
    animal: '江湖行商',
    archetype: '高价值单品判断',
    skillId: 'single_treasure',
    passive: '稀有品类线索出现概率略高',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#a78bfa'
  },
  {
    id: 'psychologist',
    name: '心理师',
    animal: '读局谋士',
    archetype: '观察对手',
    skillId: 'read_intent',
    passive: '更容易从报价节奏中发现异常判断',
    cooldownRounds: 1,
    usesPerMatch: 2,
    color: '#34d399'
  },
  {
    id: 'rumormonger',
    name: '造谣者',
    animal: '场边说客',
    archetype: '误导对手',
    skillId: 'spread_rumor',
    passive: '假情报被识破概率降低',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#fb7185'
  },
  {
    id: 'restorer',
    name: '修复师',
    animal: '修缮工匠',
    archetype: '占格与密度复核',
    skillId: 'repair_audit',
    passive: '高占格藏品的密度判断更稳定',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#f59e0b'
  },
  {
    id: 'insurer',
    name: '保险商',
    animal: '稳盘账房',
    archetype: '新手友好、防暴亏',
    skillId: 'loss_insurance',
    passive: '推荐停手价更稳健',
    cooldownRounds: 2,
    usesPerMatch: 1,
    color: '#22c55e'
  },
  {
    id: 'mentor_teacher',
    name: '启蒙师',
    animal: '民间教师',
    archetype: '轮廓品质揭示',
    skillId: 'single_treasure',
    passive: '每轮更容易获得未知藏品轮廓线索',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#84cc16'
  },
  {
    id: 'trend_hunter',
    name: '流量猎手',
    animal: '市井红人',
    archetype: '渐进品质情报',
    skillId: 'appraise_value',
    passive: '连续轮次的品质线索更稳定',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#ec4899'
  },
  {
    id: 'market_vendor',
    name: '小贩',
    animal: '摊市行家',
    archetype: '低价值避坑',
    skillId: 'loss_insurance',
    passive: '低品质藏品估值更保守',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#f97316'
  },
  {
    id: 'historian',
    name: '史学家',
    animal: '旧籍研究者',
    archetype: '古董文玩识别',
    skillId: 'single_treasure',
    passive: '文书、玉器、印章线索命中率提高',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#eab308'
  },
  {
    id: 'layout_artist',
    name: '画师',
    animal: '空间构图师',
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
    name: '织造师',
    animal: '衣料鉴别师',
    archetype: '材质辨识',
    skillId: 'repair_audit',
    passive: '服饰、织物、皮革类占格线索更清晰',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#fb7185'
  },
  {
    id: 'intel_analyst',
    name: '情报师',
    animal: '商路分析师',
    archetype: '趋势读局',
    skillId: 'read_intent',
    passive: '更容易从对手轮次报价中读出心理价',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#14b8a6'
  },
  {
    id: 'field_medic',
    name: '医师',
    animal: '医官鉴客',
    archetype: '占格审计',
    skillId: 'repair_audit',
    passive: '医药、器物、盔甲类尺寸提示更准确',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#22c55e'
  },
  {
    id: 'old_noble',
    name: '旧贵族',
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
    name: '猎宝人',
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
    name: '太学教授',
    animal: '博物学者',
    archetype: '综合鉴赏',
    skillId: 'appraise_value',
    passive: '多品类仓的总价线索更稳定',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#38bdf8'
  },
  {
    id: 'caravan_master',
    name: '商队主',
    animal: '远域货主',
    archetype: '来源估值',
    skillId: 'appraise_value',
    passive: '商船、异域、珠宝类仓型估值更准',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#06b6d4'
  },
  {
    id: 'arms_dealer',
    name: '军火商',
    animal: '军械掮客',
    archetype: '兵器机械识别',
    skillId: 'single_treasure',
    passive: '兵器、盔甲、马具类高价值格更容易被标记',
    cooldownRounds: 1,
    usesPerMatch: 3,
    color: '#64748b'
  },
  {
    id: 'eastern_appraiser',
    name: '东瀛鉴赏家',
    animal: '外邦鉴藏客',
    archetype: '单件精准识别',
    skillId: 'appraise_value',
    passive: '稀有单品的价值区间更容易收窄',
    cooldownRounds: 2,
    usesPerMatch: 2,
    color: '#ef4444'
  },
  {
    id: 'young_savant',
    name: '少年鉴宝家',
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
    name: '隐秘线人',
    animal: '暗线掮客',
    archetype: '终局洞见',
    skillId: 'read_intent',
    passive: '第 4、5 轮读取对手心理价更稳定',
    cooldownRounds: 1,
    usesPerMatch: 2,
    color: '#0f172a'
  }
];

const sets: GameConfig['sets'] = [
  { id: 'five_tiger_arms', name: '五虎兵器', itemIds: [], bonusRate: 0.5 },
  { id: 'palace_jade', name: '宫廷玉器', itemIds: [], bonusRate: 0.3 },
  { id: 'battlefield_relics', name: '古战场遗物', itemIds: [], bonusRate: 0.4 },
  { id: 'jiangdong_cargo', name: '江东商船珍藏', itemIds: [], bonusRate: 0.35 },
  { id: 'black_market_cache', name: '黑市密藏', itemIds: [], bonusRate: 0.45 }
];

type ItemBaseGroup = {
  category: string;
  setId?: string;
  entries: Array<[name: string, baseValue: number, repairBase?: number]>;
};

const itemBaseGroups: ItemBaseGroup[] = [
  {
    category: '兵器',
    setId: 'five_tiger_arms',
    entries: [
      ['青龙刀残片', 42000, 6000],
      ['丈八矛铁箍', 39000, 5000],
      ['虎威断弓', 22000, 2800],
      ['玄铁短戟', 31000, 4200],
      ['环首刀', 18000, 2000],
      ['铁胎弩机', 26000, 3600]
    ]
  },
  {
    category: '盔甲',
    setId: 'battlefield_relics',
    entries: [
      ['西凉铁盔', 16000, 1600],
      ['旧战甲', 35000, 5200],
      ['鱼鳞甲片', 24000, 3800],
      ['明光护心镜', 46000, 6400],
      ['虎纹臂甲', 21000, 2600],
      ['铜鎏金胄', 52000, 7600]
    ]
  },
  {
    category: '军需',
    setId: 'battlefield_relics',
    entries: [
      ['锦帛战旗', 19000, 2000],
      ['火漆军令', 13000, 0],
      ['营寨铜铃', 9000, 500],
      ['校尉腰牌', 17000, 0],
      ['军械账册', 15000, 1400],
      ['战鼓皮面', 12000, 2200]
    ]
  },
  {
    category: '马具',
    setId: 'battlefield_relics',
    entries: [
      ['赤兔马鞍', 86000, 9000],
      ['铁质马镫', 10000, 800],
      ['鎏金嚼环', 24000, 1200],
      ['兽纹鞍桥', 32000, 3000],
      ['缰绳银扣', 14000, 600],
      ['驿站马牌', 9000, 0]
    ]
  },
  {
    category: '玉器',
    setId: 'palace_jade',
    entries: [
      ['洛阳玉璧', 105000, 0],
      ['白玉镇纸', 18000, 0],
      ['宫廷玉佩', 42000, 0],
      ['青玉璜', 52000, 0],
      ['龙纹玉璧', 96000, 0],
      ['和田玉杯', 64000, 0]
    ]
  },
  {
    category: '器物',
    setId: 'jiangdong_cargo',
    entries: [
      ['宫廷香炉', 39000, 3000],
      ['漆金酒盏', 33000, 1200],
      ['青铜镜', 16000, 1000],
      ['饕餮铜鼎', 74000, 8500],
      ['鎏金灯盏', 28000, 1800],
      ['错金铜壶', 47000, 3200]
    ]
  },
  {
    category: '珠宝',
    setId: 'jiangdong_cargo',
    entries: [
      ['江东夜明珠', 98000, 0],
      ['异域琉璃杯', 21000, 800],
      ['残银发簪', 5200, 0],
      ['红玛瑙串', 26000, 0],
      ['海珠项链', 38000, 0],
      ['金丝香囊', 30000, 0]
    ]
  },
  {
    category: '文书',
    setId: 'black_market_cache',
    entries: [
      ['无字竹简', 36000, 7000],
      ['商会账簿', 6800, 700],
      ['旧朝诏书', 76000, 0],
      ['太学残卷', 28000, 4200],
      ['盐铁契约', 22000, 1200],
      ['军府密札', 52000, 0]
    ]
  },
  {
    category: '印章',
    setId: 'palace_jade',
    entries: [
      ['秘银小印', 24000, 0],
      ['郡守铜印', 34000, 0],
      ['牙质私印', 18000, 0],
      ['封泥匣', 9000, 0],
      ['金错官印', 68000, 0],
      ['玉钮私玺', 88000, 0]
    ]
  },
  {
    category: '瓷器',
    setId: 'palace_jade',
    entries: [
      ['裂釉瓷瓶', 42000, 5000],
      ['青花瓷瓶', 65000, 0],
      ['白釉茶盏', 17000, 0],
      ['越窑青瓷', 56000, 0],
      ['黑釉执壶', 22000, 1200],
      ['彩绘陶俑', 31000, 2600]
    ]
  },
  {
    category: '字画',
    entries: [
      ['破旧字画', 7000, 0],
      ['宫廷画轴', 72000, 2800],
      ['山水残卷', 26000, 1800],
      ['名家题跋', 54000, 0],
      ['素描用画板', 12000, 900],
      ['漆屏画片', 34000, 2400]
    ]
  },
  {
    category: '密藏',
    setId: 'black_market_cache',
    entries: [
      ['黑市密钥', 52000, 0],
      ['暗格铜盒', 31000, 1200],
      ['奇门罗盘', 47000, 2600],
      ['密封蜡筒', 18000, 0],
      ['金丝暗匣', 68000, 0],
      ['机关木匣', 24000, 2200]
    ]
  },
  {
    category: '杂物',
    entries: [
      ['铜钱一串', 3400, 0],
      ['旧木匣', 1000, 0],
      ['残破陶罐', 1500, 0],
      ['麻布包', 900, 0],
      ['破竹篓', 700, 0],
      ['铁锁钥', 2600, 0]
    ]
  },
  {
    category: '服饰',
    entries: [
      ['锦缎袍', 26000, 1600],
      ['云纹冠', 38000, 0],
      ['蹀躞带', 21000, 0],
      ['丝履', 9000, 800],
      ['披帛', 12000, 700],
      ['绣纹护腕', 15000, 900]
    ]
  },
  {
    category: '医药',
    entries: [
      ['药研', 11000, 600],
      ['银针匣', 24000, 0],
      ['医书残页', 18000, 2600],
      ['青瓷药瓶', 16000, 900],
      ['丹砂盒', 28000, 0],
      ['木质药箱', 13000, 1200]
    ]
  },
  {
    category: '工艺',
    setId: 'jiangdong_cargo',
    entries: [
      ['民间木雕', 12000, 0],
      ['漆器托盘', 18000, 1000],
      ['竹编匣', 6200, 0],
      ['琉璃珠', 23000, 0],
      ['金箔佛塔', 44000, 0],
      ['犀角杯', 52000, 0]
    ]
  }
];

const itemValueBands = [
  { code: 'junk', prefix: '残缺', rarity: 'junk', valueScale: 0.1, displayScale: 0.16, repairScale: 0.12, fake: false },
  { code: 'common', prefix: '旧藏', rarity: 'common', valueScale: 0.32, displayScale: 0.38, repairScale: 0.35, fake: false },
  { code: 'fine', prefix: '精工', rarity: 'fine', valueScale: 0.68, displayScale: 0.76, repairScale: 0.7, fake: false },
  { code: 'rare', prefix: '稀世', rarity: 'rare', valueScale: 1.18, displayScale: 1.28, repairScale: 1, fake: false },
  { code: 'legendary', prefix: '传世', rarity: 'legendary', valueScale: 2.05, displayScale: 2.2, repairScale: 1.15, fake: false },
  { code: 'fake', prefix: '仿制', rarity: 'fake', valueScale: 0.08, displayScale: 1.45, repairScale: 0, fake: true }
] satisfies Array<{
  code: string;
  prefix: string;
  rarity: GameConfig['items'][number]['rarity'];
  valueScale: number;
  displayScale: number;
  repairScale: number;
  fake: boolean;
}>;

const itemVariants = [
  { label: '甲', code: 'a', valueFactor: 0.94, displayFactor: 0.96 },
  { label: '乙', code: 'b', valueFactor: 1, displayFactor: 1.02 },
  { label: '丙', code: 'c', valueFactor: 1.08, displayFactor: 1.1 },
  { label: '丁', code: 'd', valueFactor: 1.18, displayFactor: 1.16 }
] as const;

type ItemFootprint = GameConfig['items'][number]['footprint'];

function includesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function footprintForItem(name: string, category: string, rarity: GameConfig['items'][number]['rarity']): ItemFootprint {
  const longObject = includesAny(name, [
    '刀',
    '矛',
    '戟',
    '弓',
    '弩',
    '战旗',
    '军令',
    '账册',
    '竹简',
    '诏书',
    '残卷',
    '契约',
    '密札',
    '字画',
    '画轴',
    '题跋',
    '画板',
    '披帛',
    '缰绳',
    '残片',
    '短剑',
    '战鼓皮面'
  ]);
  const tallObject = includesAny(name, [
    '盔',
    '胄',
    '战甲',
    '甲片',
    '护心镜',
    '臂甲',
    '香炉',
    '铜鼎',
    '灯',
    '铜壶',
    '瓷瓶',
    '执壶',
    '陶俑',
    '药瓶',
    '药箱',
    '木雕',
    '佛塔',
    '犀角杯',
    '铜盆',
    '陶罐',
    '竹篓',
    '锦缎袍',
    '云纹冠'
  ]);
  const boxObject = includesAny(name, ['匣', '盒', '箱', '包', '筒', '钥', '罗盘']);
  const flatObject = includesAny(name, ['玉璧', '玉璜', '镇纸', '铜镜', '托盘', '鞍', '鞍桥']);
  const tinyObject = includesAny(name, [
    '铜钱',
    '小印',
    '私印',
    '铜印',
    '官印',
    '私玺',
    '腰牌',
    '马牌',
    '钥',
    '发簪',
    '银针',
    '琉璃珠',
    '药研',
    '丹砂盒',
    '香囊',
    '铜铃',
    '封泥',
    '玉佩',
    '玉杯',
    '茶盏',
    '酒盏',
    '银扣',
    '嚼环',
    '项链',
    '玛瑙串'
  ]);

  if (tinyObject || ['印章', '珠宝', '饰品'].includes(category)) {
    return boxObject ? { w: 2, h: 1 } : { w: 1, h: 1 };
  }
  if (longObject) {
    return { w: rarity === 'junk' ? 2 : 3, h: 1 };
  }
  if (category === '文书' || category === '字画') {
    return { w: 3, h: 1 };
  }
  if (includesAny(name, ['玉璧', '玉璜']) && ['rare', 'legendary'].includes(rarity)) {
    return { w: 2, h: 2 };
  }
  if (flatObject) {
    return { w: 2, h: 1 };
  }
  if (tallObject) {
    return ['rare', 'legendary'].includes(rarity) ? { w: 2, h: 2 } : { w: 1, h: 2 };
  }
  if (boxObject) {
    return { w: 2, h: 1 };
  }
  if (['盔甲', '马具', '器物', '瓷器', '服饰', '工艺', '医药'].includes(category)) {
    return ['rare', 'legendary'].includes(rarity) ? { w: 2, h: 2 } : { w: 1, h: 2 };
  }
  if (category === '玉器') {
    return ['rare', 'legendary'].includes(rarity) ? { w: 2, h: 2 } : { w: 2, h: 1 };
  }
  if (category === '密藏') {
    return { w: 2, h: 1 };
  }
  return { w: 1, h: 1 };
}

const itemBases = itemBaseGroups.flatMap((group, groupIndex) =>
  group.entries.map(([name, baseValue, repairBase = 0], entryIndex) => ({
    name,
    category: group.category,
    baseValue,
    repairBase,
    setId: group.setId,
    artSeed: (groupIndex * 6 + entryIndex) % 25 + 1
  }))
);

const generatedItems: GameConfig['items'] = itemBases.flatMap((base, baseIndex) =>
  itemValueBands.flatMap((band) =>
    itemVariants.map((variant) => {
      const id = `item_${String(baseIndex + 1).padStart(3, '0')}_${band.code}_${variant.code}`;
      const iconKey = `item_${String(base.artSeed).padStart(2, '0')}_${variant.label}`;
      const value = Math.max(100, Math.round(base.baseValue * band.valueScale * variant.valueFactor));
      const displayValue = Math.max(100, Math.round(base.baseValue * band.displayScale * variant.displayFactor));
      return {
        id,
        name: `${band.prefix}${base.name}·${variant.label}`,
        category: base.category,
        rarity: band.rarity,
        value,
        displayValue: band.fake ? Math.max(displayValue, Math.round(base.baseValue * 0.9)) : displayValue,
        isFake: band.fake,
        repairCost: Math.max(0, Math.round(base.repairBase * band.repairScale * variant.valueFactor)),
        setId: band.fake ? undefined : base.setId,
        iconKey,
        footprint: footprintForItem(base.name, base.category, band.rarity)
      };
    })
  )
) as GameConfig['items'];

const sampleItems = ([
  { id: 'sample_r1_copper_basin', name: '老铜盆', category: '杂物', rarity: 'common', value: 5000, displayValue: 5000, isFake: false, repairCost: 0, iconKey: 'sample_r1_copper_basin' },
  { id: 'sample_r1_wood_carving', name: '民间木雕', category: '器物', rarity: 'fine', value: 12000, displayValue: 12000, isFake: false, repairCost: 0, iconKey: 'sample_r1_wood_carving' },
  { id: 'sample_r1_jade_pendant', name: '小玉佩', category: '玉器', rarity: 'fine', value: 18000, displayValue: 18000, isFake: false, repairCost: 0, iconKey: 'sample_r1_jade_pendant' },
  { id: 'sample_r1_old_painting', name: '破旧字画', category: '字画', rarity: 'common', value: 7000, displayValue: 7000, isFake: false, repairCost: 0, iconKey: 'sample_r1_old_painting' },

  { id: 'sample_r2_fake_porcelain', name: '青花瓷瓶', category: '瓷器', rarity: 'fake', value: 5000, displayValue: 80000, isFake: true, repairCost: 0, iconKey: 'sample_r2_fake_porcelain' },
  { id: 'sample_r2_bronze_mirror', name: '旧铜镜', category: '器物', rarity: 'fine', value: 15000, displayValue: 15000, isFake: false, repairCost: 0, iconKey: 'sample_r2_bronze_mirror' },
  { id: 'sample_r2_calligraphy', name: '书法残卷', category: '文书', rarity: 'common', value: 8000, displayValue: 8000, isFake: false, repairCost: 0, iconKey: 'sample_r2_calligraphy' },
  { id: 'sample_r2_wood_box', name: '木盒杂件', category: '杂物', rarity: 'common', value: 10000, displayValue: 10000, isFake: false, repairCost: 0, iconKey: 'sample_r2_wood_box' },

  { id: 'sample_r3_xiliang_helmet', name: '西凉铁盔', category: '盔甲', rarity: 'fine', value: 18000, displayValue: 18000, isFake: false, repairCost: 0, setId: 'battlefield_relics', iconKey: 'sample_r3_xiliang_helmet' },
  { id: 'sample_r3_old_armor', name: '旧战甲', category: '盔甲', rarity: 'rare', value: 35000, displayValue: 35000, isFake: false, repairCost: 0, setId: 'battlefield_relics', iconKey: 'sample_r3_old_armor' },
  { id: 'sample_r3_blade_fragment', name: '青龙刀残片', category: '兵器', rarity: 'rare', value: 28000, displayValue: 28000, isFake: false, repairCost: 0, setId: 'five_tiger_arms', iconKey: 'sample_r3_blade_fragment' },
  { id: 'sample_r3_war_flag', name: '军旗残布', category: '军需', rarity: 'common', value: 5000, displayValue: 5000, isFake: false, repairCost: 0, iconKey: 'sample_r3_war_flag' },
  { id: 'sample_r3_stirrup', name: '铁质马镫', category: '马具', rarity: 'fine', value: 10000, displayValue: 10000, isFake: false, repairCost: 0, iconKey: 'sample_r3_stirrup' },

  { id: 'sample_r4_cracked_jade', name: '破损玉璧', category: '玉器', rarity: 'rare', value: 45000, displayValue: 65000, isFake: false, repairCost: 20000, setId: 'palace_jade', iconKey: 'sample_r4_cracked_jade' },
  { id: 'sample_r4_black_sword', name: '黑市短剑', category: '兵器', rarity: 'fine', value: 18000, displayValue: 18000, isFake: false, repairCost: 0, iconKey: 'sample_r4_black_sword' },
  { id: 'sample_r4_old_box', name: '旧木匣', category: '杂物', rarity: 'common', value: 4000, displayValue: 4000, isFake: false, repairCost: 0, iconKey: 'sample_r4_old_box' },
  { id: 'sample_r4_broken_burner', name: '残破香炉', category: '器物', rarity: 'common', value: 5000, displayValue: 5000, isFake: false, repairCost: 2000, iconKey: 'sample_r4_broken_burner' },

  { id: 'sample_r5_imperial_seal', name: '宫廷玉玺残角', category: '玉器', rarity: 'legendary', value: 100000, displayValue: 100000, isFake: false, repairCost: 0, setId: 'palace_jade', iconKey: 'sample_r5_imperial_seal' },
  { id: 'sample_r5_sachet', name: '金丝香囊', category: '饰品', rarity: 'rare', value: 30000, displayValue: 30000, isFake: false, repairCost: 0, iconKey: 'sample_r5_sachet' },
  { id: 'sample_r5_copper_lamp', name: '宫廷铜灯', category: '器物', rarity: 'fine', value: 18000, displayValue: 18000, isFake: false, repairCost: 0, iconKey: 'sample_r5_copper_lamp' },
  { id: 'sample_r5_cloth_bundle', name: '破布包', category: '杂物', rarity: 'common', value: 7000, displayValue: 7000, isFake: false, repairCost: 0, iconKey: 'sample_r5_cloth_bundle' }
] satisfies Array<Omit<GameConfig['items'][number], 'footprint'>>).map((item) => ({
  ...item,
  footprint: footprintForItem(item.name, item.category, item.rarity)
})) as GameConfig['items'];

const items: GameConfig['items'] = [...generatedItems, ...sampleItems];

const setItemIds = new Map<string, string[]>();
for (const item of items) {
  if (!item.setId) {
    continue;
  }
  setItemIds.set(item.setId, [...(setItemIds.get(item.setId) ?? []), item.id]);
}

const setsWithItems = sets.map((set) => ({
  ...set,
  itemIds: setItemIds.get(set.id) ?? []
}));

const byCategory = (categories: string[]): string[] =>
  items.filter((item) => categories.includes(item.category)).map((item) => item.id);

const byRarity = (rarities: string[]): string[] =>
  items.filter((item) => rarities.includes(item.rarity)).map((item) => item.id);

const lowPool = byRarity(['junk', 'common', 'fine']);
const riskPool = byRarity(['fake', 'rare', 'legendary', 'fine']);
const warPool = byCategory(['兵器', '军需', '盔甲', '马具', '杂物']);
const palacePool = byCategory(['玉器', '器物', '瓷器', '印章', '文书']);
const riverPool = byCategory(['珠宝', '器物', '饰品', '杂物']);
const scrollPool = byCategory(['文书', '印章', '杂物']);

type ContainerSeed = readonly [
  id: string,
  name: string,
  source: string,
  tags: readonly string[],
  risk: 'low' | 'medium' | 'high',
  pool: readonly string[],
  artKey: string
];

const containerSeeds = [
  ['luoyang_palace', '洛阳旧宫', '宫廷旧藏', ['玉器', '竹简', '宫廷'], 'medium', palacePool, 'container_palace'],
  ['battlefield', '古战场遗址', '战场残库', ['兵器', '盔甲', '破损'], 'medium', warPool, 'container_battlefield'],
  ['jiangdong_ship', '江东商船', '江东商船', ['珠宝', '漆器', '异域'], 'medium', riverPool, 'container_ship'],
  ['xiliang_armory', '西凉军库', '军需旧库', ['军需', '铁器', '马具'], 'low', warPool, 'container_armory'],
  ['ruined_academy', '破败书院', '旧书院', ['古籍', '字画', '印章'], 'low', scrollPool, 'container_academy'],
  ['black_market', '黑市密仓', '黑市密仓', ['高风险', '赝品', '密藏'], 'high', riskPool, 'container_black_market']
] satisfies ContainerSeed[];

const containers: GameConfig['containers'] = Array.from({ length: 30 }, (_, index) => {
  const seed = containerSeeds[index % containerSeeds.length]!;
  const round = Math.floor(index / containerSeeds.length) + 1;
  const [id, name, source, tags, risk, pool, artKey] = seed;
  const riskBias: [number, number] =
    risk === 'high' ? [0.45, 1.55] : risk === 'medium' ? [0.58, 1.35] : [0.7, 1.2];
  return {
    id: `${id}_${round}`,
    name: `${name}·第${round}批`,
    source,
    tags: [...tags],
    risk,
    itemPool: [...(pool.length >= 5 ? pool : lowPool)],
    itemCountRange: risk === 'high' ? [5, 8] : [4, 7],
    publicEstimateBias: riskBias,
    auctionModeWeights: {
      open: index % 3 === 0 ? 3 : 1,
      sealed: index % 3 === 1 ? 3 : 1,
      second_price: index % 3 === 2 ? 3 : 1,
      deposit_open: 0,
      flash: 0
    },
    artKey
  };
});

const scriptedRounds: GameConfig['scriptedRounds'] = [
  {
    id: 'sample_round_1',
    name: '民间杂货柜',
    source: '民间旧宅清仓',
    tags: ['民间', '稳定', '新手'],
    risk: 'low',
    auctionMode: 'open',
    estimateMin: 20000,
    estimateMax: 50000,
    itemIds: ['sample_r1_copper_basin', 'sample_r1_wood_carving', 'sample_r1_jade_pendant', 'sample_r1_old_painting'],
    publicClues: ['这批货来自民间旧宅，物件保存较完整，但很少出现顶级珍品。'],
    privateCluesBySeat: [
      ['你看到一件小玉器，成色不错。'],
      ['你感觉这个货柜价值比较稳定，但上限不高。'],
      ['你观察到玩家A看到线索后兴趣上升。'],
      ['系统提示：适合新手尝试，风险较低。']
    ],
    artKey: 'container_sample_home'
  },
  {
    id: 'sample_round_2',
    name: '古玩店清仓柜',
    source: '破产古玩店',
    tags: ['古玩', '赝品', '高估值'],
    risk: 'high',
    auctionMode: 'sealed',
    estimateMin: 40000,
    estimateMax: 120000,
    itemIds: ['sample_r2_fake_porcelain', 'sample_r2_bronze_mirror', 'sample_r2_calligraphy', 'sample_r2_wood_box'],
    publicClues: ['这批货来自破产古玩店，外观看起来有几件高价藏品，但来源记录不完整。'],
    privateCluesBySeat: [
      ['有一件瓷器釉色异常，可能不是真品。'],
      ['你看到一个青花瓷瓶，外观非常抢眼。'],
      ['玩家B看到线索后表现得很兴奋。'],
      ['风险提示：本轮适合使用保险，但仍需控制出价。']
    ],
    artKey: 'container_sample_antique'
  },
  {
    id: 'sample_round_3',
    name: '西凉军需柜',
    source: '古战场军需旧库',
    tags: ['兵器', '盔甲', '套装'],
    risk: 'medium',
    auctionMode: 'second_price',
    estimateMin: 50000,
    estimateMax: 110000,
    itemIds: ['sample_r3_xiliang_helmet', 'sample_r3_old_armor', 'sample_r3_blade_fragment', 'sample_r3_war_flag', 'sample_r3_stirrup'],
    publicClues: ['货柜来自古战场旧库，金属兵器和盔甲类物品概率较高。'],
    privateCluesBySeat: [
      ['你判断总价值可能在80,000以上。'],
      ['你看到一件兵器残片，可能属于某个套装。'],
      ['玩家A本轮明显有兴趣。'],
      ['本轮风险不高，但竞争可能激烈。']
    ],
    artKey: 'container_sample_armory'
  },
  {
    id: 'sample_round_4',
    name: '黑市密仓柜',
    source: '黑市密仓',
    tags: ['黑市', '修复费', '诱导'],
    risk: 'high',
    auctionMode: 'deposit_open',
    estimateMin: 30000,
    estimateMax: 150000,
    itemIds: ['sample_r4_cracked_jade', 'sample_r4_black_sword', 'sample_r4_old_box', 'sample_r4_broken_burner'],
    publicClues: ['黑市货柜价值波动极高，可能有稀有物，也可能有较高修复成本。'],
    privateCluesBySeat: [
      ['有一件玉器价值不低，但表面有明显裂痕。'],
      ['你看到玉器光泽很好，可能是高价物。'],
      ['玩家D正在犹豫是否使用保险。'],
      ['如果本轮高价拍下，建议开启保险。']
    ],
    depositValue: 2000,
    artKey: 'container_sample_black_market'
  },
  {
    id: 'sample_round_5',
    name: '洛阳旧宫急拍柜',
    source: '洛阳旧宫',
    tags: ['闪拍', '传说', '翻盘'],
    risk: 'high',
    auctionMode: 'flash',
    estimateMin: 20000,
    estimateMax: 180000,
    itemIds: ['sample_r5_cloth_bundle', 'sample_r5_copper_lamp', 'sample_r5_sachet', 'sample_r5_imperial_seal'],
    publicClues: ['急拍货柜，来源很高，但可查看时间极短。'],
    privateCluesBySeat: [
      ['你看到一件玉质物品，但无法确认真假。'],
      ['这批货来源级别很高，可能存在高价值宫廷物。'],
      ['玩家A虽然领先，但本轮不敢冒险。'],
      ['本轮可能是翻盘机会，但风险极高。']
    ],
    auctionDurationMs: 10000,
    artKey: 'container_sample_flash_palace'
  }
];

export const gameConfig: GameConfig = {
  roles,
  items,
  containers,
  sets: setsWithItems,
  scriptedRounds,
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
    minIncrement: 1000,
    depositValue: 2000,
    depositRefund: 1000,
    insuranceLossThreshold: 20000,
    insuranceRefundRate: 0.5
  }
};
