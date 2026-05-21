import { gameConfig } from '@bitkingdom/config';

type RoleDefinition = (typeof gameConfig.roles)[number];

export const roleSkillDetails: Record<RoleDefinition['skillId'], {
  skillName: string;
  short: string;
  active: string;
  positioning: string;
  difficulty: string;
  tips: string[];
}> = {
  appraise_value: {
    skillName: '价值鉴定',
    short: '给出货柜总值区间，减少估价漂移。',
    active: '立即获得一条高可信总值线索，帮助判断是否继续跟价或及时停手。',
    positioning: '稳健型入门角色，适合用信息优势压低大额误判。',
    difficulty: '易上手',
    tips: ['优先在高估值或高波动轮使用。', '区间上沿不是必追价，仍要结合占格、品类和拍卖规则成本。']
  },
  single_treasure: {
    skillName: '盯货',
    short: '定位最高价值单品的品类与稀有度。',
    active: '查看本轮压轴单品的大致稀有度和品类，判断货柜上限是否值得争夺。',
    positioning: '爆点识别角色，适合寻找传说或稀有单品带来的翻盘窗口。',
    difficulty: '中等',
    tips: ['发现高价值品类后继续结合占格判断密度。', '适合在次高价或闪拍前提前锁定心理价。']
  },
  read_intent: {
    skillName: '读心',
    short: '观察目标玩家的心理价位。',
    active: '指定一名对手，获得其可能愿意承受的价格区间。',
    positioning: '对抗型信息角色，擅长控制抬价、诱导和停手时机。',
    difficulty: '中等',
    tips: ['优先读当前领先或明显感兴趣的对手。', '明拍中读心可以辅助决定是否继续抬价。']
  },
  spread_rumor: {
    skillName: '散布传言',
    short: '向公共线索池加入误导性高估信息。',
    active: '制造一条偏高的公共传言，影响所有玩家对货柜上限的判断。',
    positioning: '博弈型干扰角色，适合诱导对手高价接盘。',
    difficulty: '较高',
    tips: ['在自己准备停手前使用更容易诱导对手。', '频繁造势会暴露风格，后续轮次要混入真实行动。']
  },
  repair_audit: {
    skillName: '占格审计',
    short: '复核藏品占格、品质与价值密度。',
    active: '获得本轮若干格位的尺寸、品质或价值密度线索。',
    positioning: '信息管理角色，适合处理大件、盔甲、兵器等高占格货柜。',
    difficulty: '易上手',
    tips: ['看到大件或高波动仓时优先使用。', '占格效率会直接影响整仓上限，推荐价需要主动校准。']
  },
  loss_insurance: {
    skillName: '低值复核',
    short: '检查低价值样本与竞价上限。',
    active: '复核低价值或低密度样本，辅助判断是否及时停手。',
    positioning: '容错型角色，适合新手或高波动暗拍轮。',
    difficulty: '易上手',
    tips: ['在暗拍、闪拍和高风险货柜中价值更高。', '复核不是盈利手段，仍要避免明显超过安全价。']
  }
};

export function bidderBio(role: RoleDefinition): string {
  return `${role.name}是珍宝局中的${role.archetype}型竞买人，擅长在复杂拍卖中利用“${roleSkillDetails[role.skillId].skillName}”建立判断优势。${role.passive}。`;
}
