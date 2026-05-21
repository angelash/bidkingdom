import { LanguageName } from '@bitkingdom/bidking-compat';

const rawLanguageNamePattern = /^languagename_\d+_\d+$/i;

export function languageNameFromSeed(seed: number): string {
  const row = LanguageName[Math.abs(Math.floor(seed)) % Math.max(1, LanguageName.length)];
  if (!row) {
    return '试拍掌柜';
  }
  const candidates = row.columns.slice(1).filter((value) => isDisplayLanguageName(value));
  return candidates[Math.abs(Math.floor(seed / Math.max(1, LanguageName.length))) % Math.max(1, candidates.length)] ?? row.packaged_name;
}

export function languageNamesFromSeed(seed: number, count: number): string[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => languageNameFromSeed(seed + index));
}

function isDisplayLanguageName(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && !rawLanguageNamePattern.test(normalized);
}
