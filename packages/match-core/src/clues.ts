import type { Clue, RevealedItem } from '@bitkingdom/shared';

export function reviewClues(clues: readonly Clue[], hiddenItems: readonly RevealedItem[], trueValue: number) {
  return clues.map((clue) => {
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
