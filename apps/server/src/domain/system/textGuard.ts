import { DirtyWords } from '@bitkingdom/bidking-compat';

const dirtyWords = DirtyWords
  .map((row) => row.columns[1]?.trim())
  .filter((word): word is string => Boolean(word));

export function sanitizeDisplayName(value: string | undefined, defaultValue: string): string {
  const cleaned = sanitizeText(value ?? '').trim().slice(0, 12);
  return cleaned || defaultValue;
}

export function sanitizeText(value: string): string {
  let next = value;
  for (const word of dirtyWords) {
    next = next.replace(new RegExp(escapeRegExp(word), 'gi'), '***');
  }
  return next;
}

export function containsDirtyWord(value: string): boolean {
  const lowered = value.toLowerCase();
  return dirtyWords.some((word) => lowered.includes(word.toLowerCase()));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
