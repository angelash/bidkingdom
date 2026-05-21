import type { BidKingRawTableRow } from './schema';

export type BidKingGuildResourceUsage = 'badge' | 'member_title' | 'unknown';

export interface BidKingGuildResourceRuntime {
  resourceId: string;
  typeCode: number;
  usage: BidKingGuildResourceUsage;
  usageLabel: string;
  displayKey: string;
  iconKey: string;
  description: string;
}

export function bidKingGuildResourceRuntime(row: BidKingRawTableRow): BidKingGuildResourceRuntime {
  const typeCode = Number(row.columns[2] ?? 0) || 0;
  const usage = guildResourceUsage(typeCode);
  return {
    resourceId: row.id,
    typeCode,
    usage,
    usageLabel: guildResourceUsageLabel(usage),
    displayKey: row.columns[3] ?? '',
    iconKey: row.columns[4] ?? '',
    description: guildResourceDescription(usage)
  };
}

function guildResourceUsage(typeCode: number): BidKingGuildResourceUsage {
  if (typeCode === 1) {
    return 'badge';
  }
  if (typeCode === 2) {
    return 'member_title';
  }
  return 'unknown';
}

function guildResourceUsageLabel(usage: BidKingGuildResourceUsage): string {
  if (usage === 'badge') {
    return '会馆徽记素材';
  }
  if (usage === 'member_title') {
    return '成员称号模板';
  }
  return '未分类资源';
}

function guildResourceDescription(usage: BidKingGuildResourceUsage): string {
  if (usage === 'badge') {
    return '用于地区会馆徽记展示和资源领取审计。';
  }
  if (usage === 'member_title') {
    return '用于成员称号、名片装饰和资源消耗审计。';
  }
  return '保留原表资源类型，采用通用会馆资源处理。';
}
