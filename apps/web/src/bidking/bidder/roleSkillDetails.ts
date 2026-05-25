import { gameConfig } from '@bitkingdom/config';
import { bidKingHeroIdForRoleId } from '@bitkingdom/match-core';

type RoleDefinition = (typeof gameConfig.roles)[number];

export interface BidderSkillDetail {
  sourceHeroId?: number;
  originalBidder?: string;
  skillName: string;
  short: string;
  active: string;
  positioning: string;
  difficulty: string;
  tips: string[];
}

const genericRoleSkillDetails: Record<RoleDefinition['skillId'], BidderSkillDetail> = {
  appraise_value: {
    skillName: '总值掌眼',
    short: '给出整箱总值区间，减少估价漂移。',
    active: '立即获得一条高可信总值线索，帮助判断是否继续跟价或及时停手。',
    positioning: '稳健掌眼型竞买人，适合用总值线索压低大额误判。',
    difficulty: '易上手',
    tips: ['优先在高估值或高波动轮使用。', '区间上沿不是必追价，仍要结合占格、品类和拍卖规则成本。']
  },
  single_treasure: {
    skillName: '压轴辨珍',
    short: '定位最高价值单品的品类与稀有度。',
    active: '查看本轮压轴单品的大致稀有度和品类，判断整箱上限是否值得争夺。',
    positioning: '压轴辨珍型竞买人，适合寻找传世或稀有单品带来的翻盘窗口。',
    difficulty: '中等',
    tips: ['发现高价值品类后继续结合占格判断密度。', '适合在最终成交轮前提前锁定心理价。']
  },
  read_intent: {
    skillName: '观席',
    short: '观察目标玩家的心理价位。',
    active: '指定一名对手，获得其可能愿意承受的价格区间。',
    positioning: '席间观风型竞买人，擅长控制抬价、诱导和停手时机。',
    difficulty: '中等',
    tips: ['优先读上一轮领先或明显感兴趣的对手。', '明拍中读心可以辅助判断本轮心理价。']
  }
};

export const bidderSkillDetailsBySourceHeroId: Record<number, BidderSkillDetail> = {
  104: {
    sourceHeroId: 104,
    originalBidder: '加布里埃拉 / 启迪之光',
    skillName: '启迪之光',
    short: '每回合开始时，随机点明 2 件信息完全未知藏品的轮廓和品质。',
    active: '每回合开始时，随机点明 2 件信息完全未知藏品的轮廓和品质。',
    positioning: '书院授业型竞买人，稳定补全完全未知藏品的轮廓与品质。',
    difficulty: '易上手',
    tips: ['只命中信息完全未知的藏品。', '轮廓和品质会同时出现，数量固定为每回合 2 件。']
  },
  107: {
    sourceHeroId: 107,
    originalBidder: '索菲 / 原版品质揭示',
    skillName: '声闻辨品',
    short: '开拍时先验 5 件藏品品质；之后每回合再点明 2 件品质未知藏品的品质。',
    active: '开拍时，随机显示 5 件藏品的品质；之后每个回合，随机揭示 2 件品质未知藏品的品质。',
    positioning: '声闻客型竞买人，靠市井声价逐轮辨别藏品品质。',
    difficulty: '易上手',
    tips: ['首回合是 5 件品质，后续每回合是 2 件未知品质。', '不会额外揭示轮廓或价值。']
  },
  108: {
    sourceHeroId: 108,
    originalBidder: '玛丽亚 / 原版低阶验品',
    skillName: '市井货眼',
    short: '开拍时，显示白、绿、蓝品质藏品的总价值和品质。',
    active: '开拍时，显示白色、绿色、蓝色品质藏品的总价值和品质。',
    positioning: '市井货眼型竞买人，专看低三档藏品的总价值与品质。',
    difficulty: '易上手',
    tips: ['统计范围只包含白、绿、蓝品质。', '核心信息是总价值与品质，不是高阶藏品爆点。']
  },
  101: {
    sourceHeroId: 101,
    originalBidder: '法蒂玛 / 纯净之眼',
    skillName: '纯净之眼',
    short: '开拍显示 1 件最高价值文玩古器的轮廓和品质；第 2、4 回合揭示 3 件未知轮廓；第 3、5 回合揭示 3 件未知品质。',
    active: '开拍时，显示 1 件本场价值最高的文玩古器类藏品的轮廓和品质；第 2、4 回合随机显示 3 件轮廓未知文玩古器类藏品的轮廓；第 3、5 回合随机显示 3 件品质未知文玩古器类藏品的品质。',
    positioning: '古籍清鉴型竞买人，按回合拆解文玩古器类藏品的轮廓与品质。',
    difficulty: '中等',
    tips: ['首回合锁定本场价值最高的文玩古器。', '第 2、4 回合看轮廓，第 3、5 回合看品质。']
  },
  105: {
    sourceHeroId: 105,
    originalBidder: '塔蒂安娜 / 潮流象限',
    skillName: '锦衣象限',
    short: '开拍时，显示所有锦衣冠服类藏品的品质和轮廓。',
    active: '开拍时，显示所有锦衣冠服类藏品的品质和轮廓。',
    positioning: '锦衣冠服型竞买人，开拍时一次性看清该珍阁分类的轮廓与品质。',
    difficulty: '易上手',
    tips: ['目标范围是全部锦衣冠服类藏品。', '品质和轮廓同时揭示。']
  },
  110: {
    sourceHeroId: 110,
    originalBidder: '伊莎贝拉 / 稀世估值',
    skillName: '稀世估值',
    short: '开拍时，显示本场品质最高的 1 件藏品的品质，并显示 4 件矿玉珠宝类藏品的轮廓。',
    active: '开拍时，显示本场品质最高的 1 件藏品的品质，并显示 4 件矿玉珠宝类藏品的轮廓。',
    positioning: '世家稀鉴型竞买人，同时关注最高品质单品与矿玉珠宝轮廓。',
    difficulty: '中等',
    tips: ['最高品质单品只揭示品质。', '矿玉珠宝类固定揭示 4 件轮廓。']
  },
  208: {
    sourceHeroId: 208,
    originalBidder: '伊森 / 原版轮廓觉知',
    skillName: '画格识形',
    short: '开拍显示 5 种随机珍阁分类藏品的轮廓；之后每回合显示所有品质已知藏品的轮廓；第 5 回合显示所有藏品轮廓。',
    active: '开拍时，显示 5 种随机珍阁分类藏品的轮廓；之后每个回合显示所有品质已知藏品的轮廓；第 5 回合显示所有藏品的轮廓。',
    positioning: '画格识形型竞买人，逐步把品质情报转化为仓格轮廓。',
    difficulty: '中等',
    tips: ['前期依赖随机类型和已知品质条件。', '第 5 回合会补成全藏品轮廓。']
  },
  209: {
    sourceHeroId: 209,
    originalBidder: '维克托 / 价值洞察',
    skillName: '高阶点数',
    short: '开拍时，显示本次竞拍中紫、金、红品质藏品的总件数。',
    active: '开拍时，显示本次竞拍中紫色、金色、红色品质藏品的总件数。',
    positioning: '老行家型竞买人，用高阶品质件数判断整场上限。',
    difficulty: '易上手',
    tips: ['只统计紫、金、红三档。', '给出的是总件数，不是价值或轮廓。']
  },
  102: {
    sourceHeroId: 102,
    originalBidder: '陈美 / 璀钻视界',
    skillName: '珠玉视界',
    short: '开拍时，显示所有矿玉珠宝类藏品的品质和轮廓。',
    active: '开拍时，显示所有矿玉珠宝类藏品的品质和轮廓。',
    positioning: '珠玉视界型竞买人，开拍看清矿玉珠宝类藏品的品质与轮廓。',
    difficulty: '易上手',
    tips: ['目标范围是全部矿玉珠宝类藏品。', '品质和轮廓同时揭示。']
  },
  103: {
    sourceHeroId: 103,
    originalBidder: '艾莎 / 遗珍慧眼',
    skillName: '遗珍慧眼',
    short: '第 1 到第 4 回合依次显示白、绿、蓝、紫品质藏品的轮廓和品质。',
    active: '第 1 回合显示所有白色品质藏品的轮廓和品质；第 2 回合显示所有绿色品质藏品的轮廓和品质；第 3 回合显示所有蓝色品质藏品的轮廓和品质；第 4 回合显示所有紫色品质藏品的轮廓和品质。',
    positioning: '遗珍复核型竞买人，按品质阶梯逐回合看清低到中高阶藏品。',
    difficulty: '易上手',
    tips: ['触发顺序固定为白、绿、蓝、紫。', '第 5 回合不新增该技能效果。']
  },
  106: {
    sourceHeroId: 106,
    originalBidder: '娜奥米 / 灵魂和声',
    skillName: '声闻和合',
    short: '开拍时，显示所有锦衣冠服与机巧器具类藏品的轮廓，并显示其中金色、红色品质藏品数量之和。',
    active: '开拍时，显示所有锦衣冠服与机巧器具类藏品的轮廓，并显示其中金色、红色品质藏品数量之和。',
    positioning: '声闻行商型竞买人，同时读取两类藏品轮廓和高阶品质数量。',
    difficulty: '中等',
    tips: ['轮廓范围包含锦衣冠服与机巧器具两类。', '数量统计只计算这两类中的金色、红色品质。']
  },
  109: {
    sourceHeroId: 109,
    originalBidder: '海琳娜 / 医典通鉴',
    skillName: '医典通鉴',
    short: '开拍显示所有医药军需类藏品品质；之后每回合显示 2 件轮廓未知医药军需类藏品的轮廓。',
    active: '开拍时，显示所有医药军需类藏品的品质；之后每个回合显示 2 件轮廓未知医药军需类藏品的轮廓。',
    positioning: '医典药器型竞买人，先看医药军需类品质，再逐回合补轮廓。',
    difficulty: '中等',
    tips: ['首回合是全部医药军需品质。', '后续每回合只补 2 件轮廓未知医药军需类藏品。']
  },
  201: {
    sourceHeroId: 201,
    originalBidder: '乔治 / 御览兵锋',
    skillName: '御览兵锋',
    short: '开拍时，显示所有军械兵装类藏品的品质和轮廓。',
    active: '开拍时，显示所有军械兵装类藏品的品质和轮廓。',
    positioning: '王府兵库型竞买人，开拍看清军械兵装类藏品的品质与轮廓。',
    difficulty: '易上手',
    tips: ['目标范围是全部军械兵装类藏品。', '品质和轮廓同时揭示。']
  },
  202: {
    sourceHeroId: 202,
    originalBidder: '卡洛斯 / 归朴之眼',
    skillName: '归朴器鉴',
    short: '开拍显示所有府邸日用与机巧器具类藏品轮廓；之后每回合显示 2 件品质未知同类藏品品质。',
    active: '开拍时，显示所有府邸日用与机巧器具类藏品的轮廓；之后每个回合随机显示 2 件品质未知的府邸日用或机巧器具类藏品的品质。',
    positioning: '归朴器鉴型竞买人，先定器用轮廓，再补未知品质。',
    difficulty: '中等',
    tips: ['首回合只揭示府邸日用与机巧器具轮廓。', '后续每回合固定补 2 件品质未知目标。']
  },
  203: {
    sourceHeroId: 203,
    originalBidder: '莱昂纳德 / 食珍双鉴',
    skillName: '食珍双鉴',
    short: '开拍时，显示所有酒食香料类藏品的品质，并显示 2 件文玩古器类藏品的品质。',
    active: '开拍时，显示所有酒食香料类藏品的品质，并显示 2 件文玩古器类藏品的品质。',
    positioning: '庖厨古器型竞买人，同时鉴别酒食香料与文玩古器品质。',
    difficulty: '易上手',
    tips: ['酒食香料类是全部品质。', '文玩古器类只显示 2 件品质。']
  },
  204: {
    sourceHeroId: 204,
    originalBidder: '艾哈迈德 / 原版汇算',
    skillName: '主簿汇算',
    short: '开拍显示总藏品数量；第 2、3、4 回合显示橙、紫、蓝品质平均格数；第 5 回合显示绿、白总数量。',
    active: '开拍时，显示本场竞拍总藏品数量；第 2 回合显示橙色藏品平均格数；第 3 回合显示紫色藏品平均格数；第 4 回合显示蓝色藏品平均格数；第 5 回合显示绿色、白色藏品总数量。',
    positioning: '情报主簿型竞买人，按回合汇总数量与平均占格。',
    difficulty: '中等',
    tips: ['该技能给统计信息，不直接揭示单件轮廓。', '每回合统计口径不同，不能合并成泛化价值线索。']
  },
  205: {
    sourceHeroId: 205,
    originalBidder: '伊万 / 原版兵装轮廓',
    skillName: '武库本能',
    short: '开拍时，显示所有军械兵装和车马舟楫类藏品的轮廓。',
    active: '开拍时，显示所有军械兵装和车马舟楫类藏品的轮廓。',
    positioning: '武库本能型竞买人，开拍锁定军械兵装与车马舟楫类轮廓。',
    difficulty: '易上手',
    tips: ['目标范围包含军械兵装和车马舟楫两类。', '只揭示轮廓，不揭示品质或总价。']
  },
  206: {
    sourceHeroId: 206,
    originalBidder: '武田宏志 / 一期一现',
    skillName: '一期一现',
    short: '开拍显示所有书画典籍类藏品轮廓；从第 2 回合开始，每回合显示 2 件品质未知书画典籍类藏品品质。',
    active: '开拍时，显示所有书画典籍类藏品的轮廓；从第 2 回合开始，每个回合随机显示 2 件品质未知书画典籍类藏品的品质。',
    positioning: '书画典籍型竞买人，先看书画轮廓，再逐回合补品质。',
    difficulty: '中等',
    tips: ['第 1 回合是全部书画典籍轮廓。', '第 2 回合开始每回合补 2 件未知品质。']
  },
  207: {
    sourceHeroId: 207,
    originalBidder: '吴起灵 / 四步鉴物',
    skillName: '四步验器',
    short: '每回合依次揭示文玩古器类藏品数量、轮廓、品质、随机 1/3 完整信息。',
    active: '每个回合开始时依次揭示文玩古器类藏品信息：先显示数量，再显示轮廓，再显示品质，再随机显示 1/3 文玩古器类藏品完整信息。',
    positioning: '四步验器型竞买人，严格按数量、轮廓、品质、完整信息推进。',
    difficulty: '较高',
    tips: ['四步顺序不能调换。', '第 4 步是约 1/3 文玩古器类藏品的完整信息。']
  },
  301: {
    sourceHeroId: 301,
    originalBidder: '拉文 / 终局洞见',
    skillName: '终局洞见',
    short: '前 4 回合不触发；第 5 回合开始时显示所有藏品的品质。',
    active: '前 4 回合不触发；当珍宝局进入第 5 回合开始时，显示所有藏品的品质。',
    positioning: '终局算筹型竞买人，放弃前期技能换取第 5 回合全品质。',
    difficulty: '中等',
    tips: ['第 1 到第 4 回合没有该技能收益。', '第 5 回合一次性揭示所有藏品品质。']
  }
};

export const roleSkillDetails = genericRoleSkillDetails;

export function roleSkillDetailForRole(role: RoleDefinition, roles: readonly Pick<RoleDefinition, 'id'>[] = gameConfig.roles): BidderSkillDetail {
  const sourceHeroId = bidKingHeroIdForRoleId(role.id, roles);
  return bidderSkillDetailsBySourceHeroId[sourceHeroId] ?? genericRoleSkillDetails[role.skillId];
}

export function bidderBio(role: RoleDefinition, roles: readonly Pick<RoleDefinition, 'id'>[] = gameConfig.roles): string {
  const detail = roleSkillDetailForRole(role, roles);
  return `${role.name}是珍宝局中的${role.archetype}型竞买人，擅长以“${detail.skillName}”建立判断优势。${detail.active}`;
}
