import type { Clue, RevealedItem } from '@bitkingdom/shared';
import type { RuntimePlayer } from './types';
import type { RandomSource } from './random';

let clueSerial = 0;

function clueId(prefix: string): string {
  clueSerial += 1;
  return `${prefix}_${clueSerial}`;
}

export function buildPublicClues(params: {
  source: string;
  tags: readonly string[];
  risk: 'low' | 'medium' | 'high';
  trueValue: number;
  estimateMin: number;
  estimateMax: number;
  hiddenItems: readonly RevealedItem[];
}): Clue[] {
  const hasFake = params.hiddenItems.some((item) => item.isFake);
  const hasRepair = params.hiddenItems.some((item) => item.repairCost > 0);
  const riskText =
    params.risk === 'high'
      ? '拍卖师提醒这批货来路复杂，可能藏着高价值物，也可能有赝品。'
      : params.risk === 'medium'
        ? '这批货信息有些混杂，适合结合私人线索再决定上限。'
        : '这批货来源较稳，暴雷概率低，但上限也不会太夸张。';

  return [
    {
      id: clueId('public_source'),
      kind: 'category',
      text: `货柜来自${params.source}，常见品类：${params.tags.join(' / ')}。`,
      accuracy: 1,
      source: 'public',
      isTruthful: true,
      riskHint: 'unknown'
    },
    {
      id: clueId('public_value'),
      kind: 'value',
      text: `公共估值约为 ${params.estimateMin.toLocaleString()} ～ ${params.estimateMax.toLocaleString()}。`,
      accuracy: 0.78,
      valueHint: { min: params.estimateMin, max: params.estimateMax },
      source: 'public',
      isTruthful: true
    },
    {
      id: clueId('public_risk'),
      kind: 'risk',
      text: riskText,
      accuracy: hasFake || hasRepair ? 0.82 : 0.72,
      source: 'public',
      isTruthful: true,
      riskHint: hasFake ? 'fake' : hasRepair ? 'repair' : 'safe'
    }
  ];
}

export function buildPrivateClues(params: {
  player: RuntimePlayer;
  hiddenItems: readonly RevealedItem[];
  trueValue: number;
  rng: RandomSource;
}): Clue[] {
  const bestItem = [...params.hiddenItems].sort((left, right) => right.value - left.value)[0]!;
  const fakeItem = params.hiddenItems.find((item) => item.isFake);
  const repairItem = [...params.hiddenItems].sort((left, right) => right.repairCost - left.repairCost)[0];
  const roleAccuracyBonus = params.player.roleId === 'appraiser' ? 0.08 : 0;
  const low = Math.round(params.trueValue * (0.72 + params.rng.next() * 0.12));
  const high = Math.round(params.trueValue * (1.02 + params.rng.next() * 0.18));
  const clues: Clue[] = [
    {
      id: clueId(`private_value_${params.player.id}`),
      kind: 'value',
      text: `你判断这批货的真实总值大概率在 ${low.toLocaleString()} ～ ${high.toLocaleString()}。`,
      accuracy: Math.min(0.92, 0.72 + roleAccuracyBonus),
      valueHint: { min: low, max: high },
      source: 'private',
      isTruthful: true
    },
    {
      id: clueId(`private_best_${params.player.id}`),
      kind: 'category',
      text: `你留意到一件${bestItem.category}，品质看起来接近“${rarityName(bestItem.rarity)}”。`,
      accuracy: 0.74,
      targetItemId: bestItem.id,
      source: 'private',
      isTruthful: true
    }
  ];

  if (fakeItem) {
    clues.push({
      id: clueId(`private_fake_${params.player.id}`),
      kind: 'risk',
      text: `有一件看似昂贵的${fakeItem.category}细节不太对，可能存在赝品风险。`,
      accuracy: Math.min(0.9, 0.7 + roleAccuracyBonus),
      targetItemId: fakeItem.id,
      source: 'private',
      isTruthful: true,
      riskHint: 'fake'
    });
  } else if (repairItem && repairItem.repairCost > 0) {
    clues.push({
      id: clueId(`private_repair_${params.player.id}`),
      kind: 'risk',
      text: `你看到一件破损较重的${repairItem.category}，成交后可能产生修复费用。`,
      accuracy: 0.76,
      targetItemId: repairItem.id,
      source: 'private',
      isTruthful: true,
      riskHint: 'repair'
    });
  }

  return clues;
}

export function rarityName(rarity: RevealedItem['rarity']): string {
  const names: Record<RevealedItem['rarity'], string> = {
    junk: '破烂',
    common: '普通',
    fine: '精良',
    rare: '稀有',
    legendary: '传说',
    fake: '可疑高价'
  };
  return names[rarity];
}

export function reviewClues(clues: readonly Clue[], hiddenItems: readonly RevealedItem[], trueValue: number) {
  return clues.map((clue) => {
    if (clue.source === 'rumor' || !clue.isTruthful) {
      return {
        clueId: clue.id,
        text: clue.text,
        result: '这是误导信息，不能作为稳定判断依据。',
        verdict: 'rumor' as const
      };
    }

    if (clue.valueHint) {
      const hit = trueValue >= clue.valueHint.min && trueValue <= clue.valueHint.max;
      return {
        clueId: clue.id,
        text: clue.text,
        result: `真实总值为 ${trueValue.toLocaleString()}。`,
        verdict: hit ? ('hit' as const) : ('partial' as const)
      };
    }

    if (clue.targetItemId) {
      const item = hiddenItems.find((candidate) => candidate.id === clue.targetItemId);
      return {
        clueId: clue.id,
        text: clue.text,
        result: item ? `对应物品是 ${item.name}，真实价值 ${item.value.toLocaleString()}。` : '未找到对应物品。',
        verdict: item ? ('hit' as const) : ('miss' as const)
      };
    }

    return {
      clueId: clue.id,
      text: clue.text,
      result: '该线索方向基本有效。',
      verdict: 'partial' as const
    };
  });
}
