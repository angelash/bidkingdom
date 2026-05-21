import {
  DirtyWords,
  ErrorCode,
  Guide,
  HeroSkin,
  Language,
  LanguageListen,
  Notice,
  Sound,
  UIWnd
} from '@bitkingdom/bidking-compat';
import { describe, expect, it } from 'vitest';
import {
  bidKingOutgameHubWindowSources,
  bidKingWindowRegistry,
  findBidKingWindow,
  implementedBidKingOutgameHubs,
  mainBidKingWindows,
  sourcePathForOutgameHub
} from '../app/windowRegistry';
import {
  bidKingStartupNoticeQueue,
  bidKingGuideRuntime,
  bidKingNoticeRuntime,
  createBidKingSoundCue,
  formatBidKingLanguageListenLabel,
  isBidKingRawLocalizationValue,
  nextBidKingGuideStep,
  normalizeBidKingLanguageColumn,
  normalizeBidKingLanguageListenColumn,
  parseBidKingGuidePoint,
  safeBidKingDisplayText,
  translateBidKingLanguage,
  translateBidKingListen
} from './bidKingSystemRuntime';
import {
  bidKingErrorCodeStyle,
  bidKingToastErrorStyle
} from './errorCodeStyleRuntime';
import { bidKingRewardRowsLabel, parseBidKingRewardRows } from './rewardText';

describe('BidKing system table coverage', () => {
  it('registers every UIWnd row and resolves every implemented outgame hub to an original window', () => {
    expect(bidKingWindowRegistry).toHaveLength(UIWnd.length);
    expect(mainBidKingWindows.length).toBeGreaterThan(0);
    expect(bidKingWindowRegistry.every((entry) => entry.row.id === entry.id && entry.path.length > 0)).toBe(true);
    expect(bidKingWindowRegistry.every((entry) => entry.runtime.id === entry.id && entry.navigationMode.length > 0)).toBe(true);
    expect(bidKingWindowRegistry.some((entry) => entry.closeBehavior === 'close' && entry.isBlur)).toBe(true);

    for (const hub of implementedBidKingOutgameHubs) {
      const sourceName = bidKingOutgameHubWindowSources[hub];
      expect(findBidKingWindow(sourceName)).toBeDefined();
      expect(sourcePathForOutgameHub(hub)).not.toBe(sourceName);
    }
  });

  it('keeps Sound, Language, LanguageListen, Notice, Guide, ErrorCode, and DirtyWords available for system panels', () => {
    expect(Sound.some((row) => row.Type === 0 && row.Name.length > 0)).toBe(true);
    expect(Language.some((row) => row.columns.slice(1).some((value) => value.trim().length > 0))).toBe(true);
    expect(LanguageListen.some((row) => row.columns.slice(1).some((value) => value.trim().length > 0))).toBe(true);
    expect(Notice.length).toBeGreaterThan(0);
    expect(Guide.some((row) => row.columns[11]?.length || row.columns[12]?.length)).toBe(true);
    expect(ErrorCode.every((row) => row.columns[1]?.startsWith('text_ErrorCode_'))).toBe(true);
    expect(DirtyWords.length).toBeGreaterThan(0);
  });

  it('resolves Language keys, LanguageListen paths, and Sound playback cues for UI triggers', () => {
    const languageRow = Language[0]!;
    expect(normalizeBidKingLanguageColumn(999)).toBe(15);
    expect(normalizeBidKingLanguageColumn(0)).toBe(1);
    expect(isBidKingRawLocalizationValue(languageRow.columns[2]!)).toBe(true);
    expect(isBidKingRawLocalizationValue('wh_allitem')).toBe(true);
    expect(isBidKingRawLocalizationValue('UI/Prefab/UIMain/UIMain')).toBe(true);
    expect(isBidKingRawLocalizationValue('WareHouse.house_type')).toBe(true);
    expect(isBidKingRawLocalizationValue('profile.inventory')).toBe(true);
    expect(isBidKingRawLocalizationValue('BGM_5')).toBe(true);
    expect(isBidKingRawLocalizationValue('itemName_120000')).toBe(true);
    expect(isBidKingRawLocalizationValue('tx_120001')).toBe(true);
    expect(isBidKingRawLocalizationValue('hero_xq_101_2')).toBe(true);
    expect(isBidKingRawLocalizationValue('[[17,140009,1],[18,150019,1]]')).toBe(true);
    expect(safeBidKingDisplayText('公告配置行 1，保留结构、数值和资源键，显示文本使用本项目包装。')).toBe('');
    expect(safeBidKingDisplayText('text_Notice_1_8', '可读提示')).toBe('可读提示');
    expect(safeBidKingDisplayText('wh_allitem', '随身珍阁')).toBe('随身珍阁');
    expect(safeBidKingDisplayText('本地化文本', '文书样例')).toBe('文书样例');
    expect(translateBidKingLanguage(languageRow.id, 2)).not.toMatch(/(?:language_|配置行)/);
    expect(translateBidKingLanguage('ui_common_2', 2)).toBe('确定');
    expect(createBidKingSoundCue('loginBGM')?.name).toBe('登录乐曲');
    expect(createBidKingSoundCue('BGM_5')?.name).toBe('乐曲 5');
    expect(bidKingRewardRowsLabel(parseBidKingRewardRows('[[17,140009,1],[18,150019,1]]'))).not.toMatch(/\[\[|itemName_|itemDesc_|tx_/);

    const voiceSound = Sound.find((row) => row.i18nEnabled === 1 && row.i18nPathKey.length > 0)!;
    const languageListenRow = LanguageListen.find((row) => row.id === voiceSound.i18nPathKey)!;
    expect(normalizeBidKingLanguageListenColumn(999)).toBe(16);
    expect(isBidKingRawLocalizationValue(languageListenRow.columns[1]!)).toBe(true);
    expect(translateBidKingListen(voiceSound.i18nPathKey, 1)).toBe(formatBidKingLanguageListenLabel(voiceSound.i18nPathKey));
    expect(translateBidKingListen(voiceSound.i18nPathKey, 16)).not.toMatch(/(?:languagelisten|voice_path)_/);

    const voiceCue = createBidKingSoundCue(voiceSound.Id, { languageColumn: 2, masterVolume: 80 })!;
    expect(voiceCue.name).toBe(formatBidKingLanguageListenLabel(voiceSound.i18nPathKey));
    expect(voiceCue.playablePath).toBe(formatBidKingLanguageListenLabel(voiceSound.i18nPathKey));
    expect(voiceCue.volume).toBe(0.8);
    expect(voiceCue.loop).toBe(false);

    const skinVoiceCue = createBidKingSoundCue(HeroSkin[0]!.voices[0]!, { languageColumn: 1, masterVolume: 100 })!;
    expect(skinVoiceCue.id).toBe(HeroSkin[0]!.voices[0]);
    expect(skinVoiceCue.i18nPathKey).toMatch(/^voice_path_/);
  });

  it('keeps business Notice rows out of startup pushes and builds Guide overlay targets', () => {
    const notices = bidKingStartupNoticeQueue([], 3);
    expect(notices).toEqual([]);

    const feedbackNotice = Notice.find((row) => row.id === '2011')!;
    expect(bidKingNoticeRuntime(feedbackNotice)).toEqual(expect.objectContaining({
      title: '问题反馈',
      body: '您的问题我们已经收到，非常感谢您的反馈',
      typeLabel: '公告'
    }));

    const auctionNotice = Notice.find((row) => row.columns[4]?.includes('songpai'))!;
    expect(bidKingNoticeRuntime(auctionNotice)).toEqual(expect.objectContaining({
      actionTarget: 'auctionHouse',
      hasCancel: true
    }));

    const battleGuide = nextBidKingGuideStep([], 'Battle_Main')!;
    expect(battleGuide.targetWindow).toBe('Battle_Main');
    expect(battleGuide.targetNode.length).toBeGreaterThan(0);
    expect(battleGuide.guideType).toBeGreaterThan(0);
    expect(battleGuide.triggerType).toBeGreaterThan(0);
    expect(battleGuide.anchor).toEqual(parseBidKingGuidePoint(Guide.find((row) => row.id === battleGuide.id)!.columns[10]!));
    expect(nextBidKingGuideStep([battleGuide.id], 'Battle_Main')?.id).not.toBe(battleGuide.id);

    const dynamicGuide = bidKingGuideRuntime(Guide.find((row) => row.columns[8] === '1')!);
    expect(dynamicGuide).toEqual(expect.objectContaining({ isDynamic: true, maskAlpha: 50 }));

    const delayedGuide = bidKingGuideRuntime(Guide.find((row) => Number(row.columns[15] ?? 0) > 0)!);
    expect(delayedGuide.delayMs).toBeGreaterThan(0);
    expect(parseBidKingGuidePoint('[-760,220]')).toEqual({ x: -760, y: 220 });
  });

  it('maps ErrorCode rows and toast envelopes to business style classes', () => {
    expect(ErrorCode.every((row) => bidKingErrorCodeStyle(row).className.startsWith('error-tone-'))).toBe(true);
    expect(bidKingErrorCodeStyle(ErrorCode.find((row) => row.id === '102')!).tone).toBe('danger');
    expect(bidKingToastErrorStyle('CODE_70 · 业务失败').tone).toBe('warning');
  });
});
