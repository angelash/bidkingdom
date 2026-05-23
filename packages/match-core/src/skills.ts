import type { Clue } from '@bitkingdom/shared';
import { buildBidKingManualSkillFeedEntry, buildBidKingManualSkillResult } from './bidking/compatRuntime';
import { rarityName } from './clues';
import { pushEvent, requirePlayer, requireRound } from './match';
import { sumItemValue, sumRepairCost } from './scoring';
import type { MatchRuntimeState } from './types';

export function useSkill(
  state: MatchRuntimeState,
  playerId: string,
  targetPlayerId?: string,
  now = Date.now()
): MatchRuntimeState {
  const round = requireRound(state);
  const player = requirePlayer(state, playerId);
  const role = state.config.roles.find((candidate) => candidate.id === player.roleId);

  if (state.coreMode) {
    throw new Error('BidKing core hero skills are automatic');
  }
  if (!role) {
    throw new Error(`Missing role ${player.roleId}`);
  }
  if (!['intel', 'auction'].includes(round.phase)) {
    throw new Error('Skills are only allowed during intel or auction phase');
  }
  if (round.phase === 'auction' && (player.hasSubmittedBid || round.bids.some((bid) => bid.playerId === playerId))) {
    throw new Error('Skills must be used before bidding');
  }
  if (player.skillCooldown > 0 || player.skillUsedThisRound || player.skillUsesRemaining <= 0) {
    throw new Error('Skill is on cooldown');
  }

  const bidKingResult = state.coreMode ? buildBidKingManualSkillResult(state, player, targetPlayerId) : undefined;
  const clue = bidKingResult?.clue ?? buildSkillClue(state, playerId, role.skillId, targetPlayerId);
  if (clue) {
    if (bidKingResult?.publishTo === 'public' || (!bidKingResult && role.skillId === 'spread_rumor')) {
      round.container.publicClues.push(clue);
    } else {
      player.privateClues.push(clue);
      round.container.privateCluesByPlayerId[player.id] = [
        ...(round.container.privateCluesByPlayerId[player.id] ?? []),
        clue
      ];
    }
  }
  if (bidKingResult?.insuranceActive || (!bidKingResult && role.skillId === 'loss_insurance')) {
    player.insuranceActive = true;
  }
  const skillFeedEntry = bidKingResult
    ? buildBidKingManualSkillFeedEntry(state, player, clue, now)
    : {
        id: `${round.id}_manual_skill_${player.id}_${role.skillId}_${round.skillFeed.length + 1}`,
        round: round.index + 1,
        playerId: player.id,
        source: 'manual' as const,
        sourceName: role.name,
        skillName: role.passive,
        text: clue?.text ?? `${role.name}使用${role.passive}。`,
        visibility: role.skillId === 'spread_rumor' ? 'public' as const : 'private' as const,
        targetItemIds: clue?.targetItemIds ?? (clue?.targetItemId ? [clue.targetItemId] : undefined),
        createdAt: now
      };
  if (skillFeedEntry) {
    round.skillFeed.push(skillFeedEntry);
  }

  player.skillCooldown = bidKingResult?.cooldownRounds ?? role.cooldownRounds;
  player.skillUsesRemaining -= 1;
  player.skillUsedThisRound = true;
  state.updatedAt = now;
  pushEvent(state, 'skill_used', playerId, {
    roleId: role.id,
    skillId: role.skillId,
    skillCid: bidKingResult?.effectPlan.skillId,
    effectCategory: bidKingResult?.effectPlan.effectCategory,
    effectPlan: bidKingResult?.effectPlan,
    targetPlayerId,
    clue
  });
  if (skillFeedEntry) {
    pushEvent(state, 'skill_triggered', playerId, { entry: skillFeedEntry }, now);
  }
  return state;
}

function buildSkillClue(
  state: MatchRuntimeState,
  playerId: string,
  skillId: string,
  targetPlayerId?: string
): Clue | undefined {
  const round = requireRound(state);
  const hiddenItems = round.container.hiddenItems;
  const trueValue = sumItemValue(hiddenItems);
  const bestItem = [...hiddenItems].sort((left, right) => right.value - left.value)[0]!;
  const repairCost = sumRepairCost(hiddenItems, 0);
  const prefix = `skill_${skillId}_${playerId}_${round.index}`;

  if (skillId === 'appraise_value') {
    const low = Math.round(trueValue * 0.86);
    const high = Math.round(trueValue * 1.08);
    return {
      id: prefix,
      kind: 'value',
      text: `价值鉴定：总值很可能在 ${low.toLocaleString()} ～ ${high.toLocaleString()}。`,
      accuracy: 0.88,
      valueHint: { min: low, max: high },
      source: 'skill',
      isTruthful: true
    };
  }

  if (skillId === 'single_treasure') {
    return {
      id: prefix,
      kind: 'category',
      text: `盯货：最高价值单品接近“${rarityName(bestItem.rarity)}”，品类为${bestItem.category}。`,
      accuracy: 0.82,
      targetItemId: bestItem.id,
      source: 'skill',
      isTruthful: true
    };
  }

  if (skillId === 'read_intent') {
    const target = targetPlayerId ? state.players.find((candidate) => candidate.id === targetPlayerId) : undefined;
    const targetBids = target ? round.bids.filter((bid) => bid.playerId === target.id) : [];
    const targetBid = targetBids[targetBids.length - 1]?.amount ?? 0;
    const base = Math.max(targetBid, Math.round((round.container.publicInfo.estimateMin + round.container.publicInfo.estimateMax) / 2));
    return {
      id: prefix,
      kind: 'opponent',
      text: `读心：${target?.name ?? '目标'}的心理价位大约在 ${Math.round(base * 0.75).toLocaleString()} ～ ${Math.round(base * 1.15).toLocaleString()}。`,
      accuracy: 0.74,
      valueHint: { min: Math.round(base * 0.75), max: Math.round(base * 1.15) },
      source: 'skill',
      isTruthful: true
    };
  }

  if (skillId === 'spread_rumor') {
    const inflated = Math.round(trueValue * (1.25 + state.rng.next() * 0.35));
    return {
      id: prefix,
      kind: 'false',
      text: `场边传言：这批货可能藏着价值超过 ${inflated.toLocaleString()} 的压轴宝物。`,
      accuracy: 0.2,
      valueHint: { min: Math.round(inflated * 0.75), max: inflated },
      source: 'rumor',
      isTruthful: false
    };
  }

  if (skillId === 'repair_audit') {
    return {
      id: prefix,
      kind: 'risk',
      text:
        repairCost > 0
          ? `预估修复：这批货存在约 ${repairCost.toLocaleString()} 的修复成本。`
          : '预估修复：没有发现明显高修复费物件。',
      accuracy: 0.86,
      source: 'skill',
      isTruthful: true,
      riskHint: repairCost > 0 ? 'repair' : 'safe'
    };
  }

  if (skillId === 'loss_insurance') {
    return {
      id: prefix,
      kind: 'risk',
      text: '风险保险：本轮若出现严重亏损，会返还部分损失。',
      accuracy: 1,
      source: 'skill',
      isTruthful: true,
      riskHint: 'safe'
    };
  }

  return undefined;
}
