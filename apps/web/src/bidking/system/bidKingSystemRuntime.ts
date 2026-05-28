import {
  Language,
  LanguageListen,
  Guide,
  Notice,
  Sound,
  type BidKingRawTableRow,
  type BidKingSoundRow
} from '@bitkingdom/bidking-compat';
export { bidKingSoundCueAssetUrls } from './bidKingSoundAssetUrls';

export interface BidKingSoundCue {
  id: number;
  name: string;
  fullPath: string;
  playablePath: string;
  type: number;
  loop: boolean;
  volume: number;
  delay: number;
  fadeInTime: number;
  fadeOutTime: number;
  priority: number;
  maxPlayingCount: number;
  i18nPathKey: string;
}

export interface BidKingStartupNotice {
  id: string;
  title: string;
  body: string;
  type: string;
  typeLabel: string;
  titleKey: string;
  bodyKey: string;
  okLabelKey: string;
  cancelLabelKey: string;
  hasCancel: boolean;
  actionTarget?: BidKingNoticeActionTarget;
  priority: number;
}

export type BidKingNoticeActionTarget = 'auctionHouse' | 'mail' | 'settings' | 'feedback';

export interface BidKingGuideStep {
  id: string;
  title: string;
  titleKey: string;
  descriptionKey: string;
  textKey: string;
  targetWindow: string;
  targetNode: string;
  anchor?: { x: number; y: number };
  focus?: { x: number; y: number };
  guideType: number;
  triggerType: number;
  heroId?: string;
  isDynamic: boolean;
  maskAlpha: number;
  delayMs: number;
  order: number;
}

const languageRowsByKey = new Map(Language.map((row) => [row.id, row]));
const languageListenRowsByKey = new Map(LanguageListen.map((row) => [row.id, row]));
const soundRowsById = new Map(Sound.map((row) => [row.Id, row]));
const soundRowsByName = new Map(Sound.filter((row) => row.Name.length > 0).map((row) => [row.Name, row]));
const rawLocalizationValuePattern = /(?:achievement_tipsname|activity|emoji_name|guide_text|language|languagelisten|languagename|mail|notice|pay_orderdesc|pay_steamdesc|rank|sound|text|ui|voice_path|wh)_[a-z0-9_]+/i;
const rawAssetValuePattern = /(?:itemName|itemDesc)_\d+|tx_\d+|hero_(?:n|skin|xq|bs|bg)_[a-z0-9_]+/i;
const rawConfigValuePattern = /(?:UI\/Prefab\/|WareHouse\.|house_type|store_type|profile\.inventory|[A-Za-z]+_[A-Za-z0-9_]*_Main\b|\b(?:login|uimain)BGM\b|\bBGM_?\d+\b|^\s*\[\s*\[.*\]\s*\]\s*$)/i;

const commonLanguageLabels: Record<string, string> = {
  ui_common_1: '返回',
  ui_common_2: '确定',
  ui_common_3: '取消'
};
const startupNoticeTypes = new Set(['notice_login', 'notice_announcement', 'notice_activity']);

export function normalizeBidKingLanguageColumn(column: unknown): number {
  return clampInteger(column, 1, 15);
}

export function normalizeBidKingLanguageListenColumn(column: unknown): number {
  return clampInteger(column, 1, 16);
}

export function translateBidKingLanguage(key: string, column: unknown, defaultText = key): string {
  const row = languageRowsByKey.get(key);
  if (!row) {
    return safeDisplayValue(defaultText) || commonLanguageLabels[key] || humanizeBidKingLocalizationKey(key, '文书条目');
  }
  return safeDisplayValue(columnValue(row, normalizeBidKingLanguageColumn(column)))
    || commonLanguageLabels[key]
    || safeDisplayValue(defaultText)
    || safeDisplayValue(row.packaged_name)
    || safeDisplayValue(row.packaged_desc)
    || humanizeBidKingLocalizationKey(key, '文书条目');
}

export function translateBidKingListen(key: string, column: unknown, defaultText = key): string {
  const row = languageListenRowsByKey.get(key);
  if (!row) {
    return safeDisplayValue(defaultText) || formatBidKingLanguageListenLabel(key) || '语音试听';
  }
  return safeDisplayValue(columnValue(row, normalizeBidKingLanguageListenColumn(column)))
    || formatBidKingLanguageListenLabel(key)
    || safeDisplayValue(defaultText)
    || safeDisplayValue(row.packaged_name)
    || safeDisplayValue(row.packaged_desc)
    || '语音试听';
}

export function formatBidKingLanguageListenLabel(value: string): string {
  const voicePathMatch = value.match(/voice_path_(\d+)/i);
  if (!voicePathMatch) {
    return humanizeBidKingLocalizationKey(value, '语音试听');
  }
  const code = voicePathMatch[1]!;
  if (code.length >= 7) {
    return `语音 ${code.slice(0, 2)}-${code.slice(2, 4)}-${code.slice(4)}`;
  }
  return `语音 ${code}`;
}

export function isBidKingRawLocalizationValue(value: string): boolean {
  const normalized = value.trim();
  return rawLocalizationValuePattern.test(normalized) || rawAssetValuePattern.test(normalized) || rawConfigValuePattern.test(normalized);
}

export function safeBidKingDisplayText(value: string, defaultText = ''): string {
  return safeDisplayValue(value) || safeDisplayValue(defaultText);
}

export function findBidKingSound(soundRef: number | string): BidKingSoundRow | undefined {
  if (typeof soundRef === 'number') {
    return soundRowsById.get(soundRef);
  }
  const numeric = Number(soundRef);
  if (Number.isFinite(numeric) && soundRowsById.has(numeric)) {
    return soundRowsById.get(numeric);
  }
  return soundRowsByName.get(soundRef);
}

export function createBidKingSoundCue(
  soundRef: number | string,
  options: { languageColumn?: unknown; masterVolume?: unknown } = {}
): BidKingSoundCue | undefined {
  const sound = findBidKingSound(soundRef);
  if (!sound) {
    return undefined;
  }
  const languageColumn = normalizeBidKingLanguageListenColumn(options.languageColumn ?? 1);
  const masterVolume = clampPercent(options.masterVolume ?? 100) / 100;
  const rowVolume = Number.isFinite(sound.Volume) ? sound.Volume : 1;
  const localizedPath = sound.i18nEnabled === 1 && sound.i18nPathKey
    ? translateBidKingListen(sound.i18nPathKey, languageColumn, sound.FullPathName)
    : sound.FullPathName;
  return {
    id: sound.Id,
    name: bidKingSoundDisplayName(sound),
    fullPath: sound.FullPathName,
    playablePath: localizedPath || sound.FullPathName,
    type: sound.Type,
    loop: sound.IsLoop === 1,
    volume: Number((rowVolume * masterVolume).toFixed(4)),
    delay: sound.Delay,
    fadeInTime: sound.FadeInTime,
    fadeOutTime: sound.FadeOutTime,
    priority: sound.Priority,
    maxPlayingCount: sound.CurMaxPlayingCount,
    i18nPathKey: sound.i18nPathKey
  };
}

export function emitBidKingSoundCue(cue: BidKingSoundCue): BidKingSoundCue {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bidking:sound-cue', { detail: cue }));
  }
  return cue;
}

export function bidKingStartupNoticeQueue(readNoticeIds: readonly string[] = [], limit = 1): BidKingStartupNotice[] {
  const read = new Set(readNoticeIds);
  return Notice
    .filter((row) => startupNoticeTypes.has(columnValue(row, 4)) && !read.has(row.id))
    .map(bidKingNoticeRuntime)
    .sort((left, right) => right.priority - left.priority || Number(left.id) - Number(right.id))
    .slice(0, Math.max(0, limit));
}

export function bidKingNoticeRuntime(row: BidKingRawTableRow): BidKingStartupNotice {
  const type = columnValue(row, 4) || 'notice_general';
  const titleKey = columnValue(row, 5) || columnValue(row, 2);
  const bodyKey = columnValue(row, 8);
  const okLabelKey = nonZeroColumn(row, 6) || 'ui_common_2';
  const cancelLabelKey = nonZeroColumn(row, 7);
  const typeLabel = formatBidKingNoticeTypeLabel(type);
  const translatedBody = translateBidKingLanguage(titleKey, 1, '');
  return {
    id: row.id,
    title: safeNoticeTitle(row.packaged_name) || typeLabel,
    body: safeDisplayValue(row.packaged_desc) || translatedBody || '公告内容待同步',
    type,
    typeLabel,
    titleKey,
    bodyKey,
    okLabelKey,
    cancelLabelKey,
    hasCancel: cancelLabelKey.length > 0,
    actionTarget: noticeActionTarget(row),
    priority: numberColumn(row, 3, 0)
  };
}

export function formatBidKingNoticeTypeLabel(type: string): string {
  const normalized = type.trim();
  const defaultLabel = '公告';
  const knownLabels: Record<string, string> = {
    notice_general: defaultLabel,
    notice_system: '系统公告',
    notice_songpai: '送拍确认',
    notice_quxiaosongpai: '下架确认'
  };
  if (!normalized) {
    return defaultLabel;
  }
  const knownLabel = knownLabels[normalized];
  if (knownLabel) {
    return knownLabel;
  }
  const translated = safeDisplayValue(translateBidKingLanguage(normalized, 1, ''));
  return translated && translated !== '文书条目' ? translated : defaultLabel;
}

export function nextBidKingGuideStep(
  completedGuideIds: readonly string[] = [],
  targetWindow?: string
): BidKingGuideStep | undefined {
  const completed = new Set(completedGuideIds);
  const candidates = Guide
    .filter((row) => !completed.has(row.id))
    .filter((row) => !targetWindow || row.columns[11] === targetWindow)
    .map(bidKingGuideRuntime)
    .sort((left, right) => left.order - right.order || Number(left.id) - Number(right.id));
  return candidates[0];
}

export function bidKingGuideRuntime(row: BidKingRawTableRow): BidKingGuideStep {
  return {
    id: row.id,
    title: row.packaged_name,
    titleKey: columnValue(row, 2),
    descriptionKey: columnValue(row, 7),
    textKey: columnValue(row, 9),
    targetWindow: columnValue(row, 11),
    targetNode: columnValue(row, 12),
    anchor: parseBidKingGuidePoint(columnValue(row, 10)),
    focus: parseBidKingGuidePoint(columnValue(row, 13)),
    guideType: numberColumn(row, 3, 0),
    triggerType: numberColumn(row, 4, 0),
    heroId: nonZeroColumn(row, 6) || undefined,
    isDynamic: columnValue(row, 8) === '1',
    maskAlpha: numberColumn(row, 14, 0),
    delayMs: numberColumn(row, 15, 0),
    order: numberColumn(row, 5, Number(row.id) || 0)
  };
}

export function parseBidKingGuidePoint(raw: string): { x: number; y: number } | undefined {
  const match = raw.match(/^\[(-?\d+),(-?\d+)\]$/);
  if (!match) {
    return undefined;
  }
  return { x: Number(match[1]), y: Number(match[2]) };
}

export function columnValue(row: BidKingRawTableRow, index: number): string {
  return row.columns[index]?.trim() ?? '';
}

function bidKingSoundDisplayName(sound: BidKingSoundRow): string {
  return formatBidKingSoundReference(sound.Name)
    || safeDisplayValue(sound.packaged_name)
    || safeDisplayValue(sound.Name)
    || safeDisplayValue(sound.Desc)
    || (sound.i18nPathKey ? formatBidKingLanguageListenLabel(sound.i18nPathKey) : '')
    || `音频 ${sound.Id}`;
}

function safeDisplayValue(value: string): string {
  const normalized = stripBidKingTextArtifacts(value);
  if (!normalized || normalized === '本地化文本' || isBidKingRawLocalizationValue(normalized) || isGeneratedConfigDescription(normalized)) {
    return '';
  }
  return normalized;
}

function formatBidKingSoundReference(value: string): string {
  const normalized = stripBidKingTextArtifacts(value);
  if (/^loginBGM$/i.test(normalized)) {
    return '登录乐曲';
  }
  if (/^uimainBGM$/i.test(normalized)) {
    return '主厅乐曲';
  }
  const bgmMatch = normalized.match(/^BGM_?(\d+)$/i);
  if (bgmMatch) {
    return `乐曲 ${bgmMatch[1]}`;
  }
  return '';
}

function stripBidKingTextArtifacts(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<sprite=[^>]+>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGeneratedConfigDescription(value: string): boolean {
  return /配置行\s+\d+，保留结构、数值和资源键，显示文本使用本项目包装。$/.test(value);
}

function safeNoticeTitle(value: string): string {
  const title = safeDisplayValue(value);
  return /^公告弹窗\d+$/.test(title) ? '' : title;
}

function humanizeBidKingLocalizationKey(key: string, defaultText: string): string {
  const voiceLabel = key.includes('voice_path_') ? formatBidKingLanguageListenLabel(key) : '';
  if (voiceLabel) {
    return voiceLabel;
  }
  return defaultText;
}

function numberColumn(row: BidKingRawTableRow, index: number, defaultValue: number): number {
  const numeric = Number(row.columns[index]);
  return Number.isFinite(numeric) ? numeric : defaultValue;
}

function nonZeroColumn(row: BidKingRawTableRow, index: number): string {
  const value = columnValue(row, index);
  return value === '0' ? '' : value;
}

function noticeActionTarget(row: BidKingRawTableRow): BidKingNoticeActionTarget | undefined {
  const tokens = [row.columns[2], row.columns[4], row.columns[5], row.columns[8], row.packaged_name].join(' ').toLowerCase();
  if (tokens.includes('songpai')) {
    return 'auctionHouse';
  }
  if (tokens.includes('mail')) {
    return 'mail';
  }
  if (tokens.includes('system')) {
    return 'settings';
  }
  if (tokens.includes('qa') || tokens.includes('feedback')) {
    return 'feedback';
  }
  return undefined;
}

function clampInteger(value: unknown, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function clampPercent(value: unknown): number {
  return clampInteger(value, 0, 100);
}
