import { describe, expect, it } from 'vitest';
import { bidKingGuildResourceRuntime } from './guildResourceRuntime';
import { GuildResources } from './tables/GuildResources';

describe('BidKing guild resource runtime helpers', () => {
  it('explains GuildResources type, display key, and icon key from original rows', () => {
    const badge = GuildResources.find((row) => row.columns[2] === '1')!;
    const title = GuildResources.find((row) => row.columns[2] === '2')!;
    const badgeRuntime = bidKingGuildResourceRuntime(badge);
    const titleRuntime = bidKingGuildResourceRuntime(title);

    expect(badgeRuntime).toEqual(expect.objectContaining({
      resourceId: badge.id,
      typeCode: 1,
      usage: 'badge',
      usageLabel: '会馆徽记素材',
      iconKey: badge.columns[4]
    }));
    expect(titleRuntime).toEqual(expect.objectContaining({
      resourceId: title.id,
      typeCode: 2,
      usage: 'member_title',
      usageLabel: '成员称号模板',
      displayKey: title.columns[3]
    }));
    expect(GuildResources.every((row) => bidKingGuildResourceRuntime(row).usage !== 'unknown')).toBe(true);
  });
});
