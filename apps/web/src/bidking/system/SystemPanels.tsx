import { useState } from 'react';
import {
  DirtyWords as bidKingDirtyWords,
  ErrorCode as bidKingErrorCodes,
  Guide as bidKingGuides,
  Language as bidKingLanguages,
  LanguageListen as bidKingLanguageListens,
  LanguageName as bidKingLanguageNames,
  Notice as bidKingNotices,
  Sound as bidKingSounds
} from '@bitkingdom/bidking-compat';
import type { PlayerProfile } from '@bitkingdom/shared';
import { bidKingWindowRegistry, mainBidKingWindows } from '../app/windowRegistry';
import {
  bidKingGuideRuntime,
  bidKingNoticeRuntime,
  createBidKingSoundCue,
  emitBidKingSoundCue,
  findBidKingSound,
  formatBidKingLanguageListenLabel,
  safeBidKingDisplayText,
  translateBidKingLanguage,
  translateBidKingListen,
  type BidKingSoundCue
} from './bidKingSystemRuntime';
import { bidKingErrorCodeStyle } from './errorCodeStyleRuntime';

interface SettingsPanelViewProps {
  profile: PlayerProfile;
  onApplyLanguageName: () => void;
  onUpdateSettings: (settings: Record<string, string | number | boolean>) => void;
}

export function SettingsPanelView({
  profile,
  onApplyLanguageName,
  onUpdateSettings
}: SettingsPanelViewProps): JSX.Element {
  const [previewCue, setPreviewCue] = useState<BidKingSoundCue>();
  const mainWindows = mainBidKingWindows;
  const bgmRows = bidKingSounds.filter((sound) => sound.Type === 0).slice(0, 12);
  const currentLanguageColumn = Number(profile.settings.languageColumn ?? 1);
  const currentVolume = Number(profile.settings.masterVolume ?? 80);
  const currentBgmRef = profile.settings.bgm ?? bgmRows[0]?.Id ?? 'uimainBGM';
  const currentBgmRow = findBidKingSound(String(currentBgmRef)) ?? bgmRows[0];
  const currentBgmCue = currentBgmRow
    ? createBidKingSoundCue(currentBgmRow.Id, { languageColumn: currentLanguageColumn, masterVolume: currentVolume })
    : undefined;
  const languageSample = bidKingLanguages[0]
    ? safeBidKingDisplayText(translateBidKingLanguage(bidKingLanguages[0].id, currentLanguageColumn), '')
    : '';

  function previewSound(soundRef: number | string): void {
    const cue = createBidKingSoundCue(soundRef, { languageColumn: currentLanguageColumn, masterVolume: currentVolume });
    if (cue) {
      setPreviewCue(emitBidKingSoundCue(cue));
    }
  }

  return (
    <div className="config-table-panel settings-config-panel">
      <header>
        <strong>章程与声闻</strong>
        <span>{bidKingWindowRegistry.length} 扇界面 · {bidKingSounds.length} 条声闻 · {bidKingLanguages.length} 篇文书 · {bidKingLanguageListens.length} 条语音 · {bidKingLanguageNames.length} 册名簿 · {bidKingDirtyWords.length} 条禁言簿</span>
      </header>
      <article>
        <strong>声音</strong>
        <label>
          乐曲
          <select value={String(currentBgmRow?.Id ?? '')} onChange={(event) => onUpdateSettings({ bgm: Number(event.target.value) })}>
            {bgmRows.map((sound) => (
              <option key={sound.Id} value={sound.Id}>{createBidKingSoundCue(sound.Id, { languageColumn: currentLanguageColumn, masterVolume: currentVolume })?.name ?? `音频 ${sound.Id}`}</option>
            ))}
          </select>
        </label>
        <label>
          音量 {currentVolume}
          <input
            max={100}
            min={0}
            type="range"
            value={currentVolume}
            onChange={(event) => onUpdateSettings({ masterVolume: Number(event.target.value) })}
          />
        </label>
        <div className="settings-preview-row">
          <button disabled={!currentBgmCue} onClick={() => currentBgmCue && previewSound(currentBgmCue.id)} type="button">试听乐曲</button>
          <span>{currentBgmCue ? `${currentBgmCue.name} · 音量 ${Math.round(currentBgmCue.volume * 100)}%` : '未选乐曲'}</span>
        </div>
        {previewCue && <em>最近试听 {previewCue.name}</em>}
      </article>
      <article>
        <strong>文书列</strong>
        <label>
          文书栏
          <select value={currentLanguageColumn} onChange={(event) => onUpdateSettings({ languageColumn: Number(event.target.value) })}>
            {Array.from({ length: 15 }, (_, index) => index + 1).map((column) => (
              <option key={column} value={column}>第 {column} 列</option>
            ))}
          </select>
        </label>
        <p>{languageSample && languageSample !== '文书条目' ? languageSample : '文书样例已接入'}</p>
        <button onClick={onApplyLanguageName} type="button">抽取名册称谓</button>
      </article>
      {mainWindows.slice(0, 12).map((uiWnd) => (
        <article key={uiWnd.id}>
          <strong>{windowDisplayLabel(uiWnd.displayName)}</strong>
          <p>{windowDisplayDesc(uiWnd.description)}</p>
        </article>
      ))}
      {bidKingLanguageListens.slice(0, 6).map((row) => {
        const voiceLabel = formatBidKingLanguageListenLabel(row.id);
        const localizedPreview = translateBidKingListen(row.id, currentLanguageColumn, voiceLabel);
        const aiPreview = translateBidKingListen(row.id, 16, voiceLabel);
        return (
          <article key={`language_listen_${row.id}`}>
            <strong>{voiceLabel}</strong>
            <p>{safeBidKingDisplayText(localizedPreview, voiceLabel) || voiceLabel}</p>
            <em>语音 · {safeBidKingDisplayText(aiPreview, voiceLabel) || voiceLabel}</em>
          </article>
        );
      })}
    </div>
  );
}

interface FeedbackPanelViewProps {
  profile: PlayerProfile;
  onCompleteGuide: (guideId: string) => void;
  onMarkNoticeRead: (noticeId: string) => void;
}

export function FeedbackPanelView({
  profile,
  onCompleteGuide,
  onMarkNoticeRead
}: FeedbackPanelViewProps): JSX.Element {
  const readNotices = new Set(profile.readNotices ?? []);
  const completedGuides = new Set(profile.completedGuides ?? []);
  return (
    <div className="config-table-panel config-grid-panel">
      <header>
        <strong>告示、指引与回执</strong>
        <span>{bidKingNotices.length} 条告示 · {bidKingGuides.length} 条指引 · {bidKingErrorCodes.length} 个回执</span>
      </header>
      {bidKingNotices.slice(0, 8).map((notice) => {
        const runtime = bidKingNoticeRuntime(notice);
        return (
          <article className={readNotices.has(notice.id) ? 'claimed' : ''} key={`notice_${notice.id}`}>
            <strong>{runtime.title}</strong>
            <p>{runtime.body}</p>
            <em>{readNotices.has(notice.id) ? '已读' : runtime.typeLabel}</em>
            <button disabled={readNotices.has(notice.id)} onClick={() => onMarkNoticeRead(notice.id)} type="button">阅毕</button>
          </article>
        );
      })}
      {bidKingGuides.slice(0, 8).map((guide) => (
        <article className={completedGuides.has(guide.id) ? 'claimed' : ''} key={`guide_${guide.id}`}>
          <strong>{safeBidKingDisplayText(guide.packaged_name, '指引步骤') || '指引步骤'}</strong>
          <p>{guideSummary(guide)}</p>
          <em>{completedGuides.has(guide.id) ? '已完成' : guideAnchorLabel(guide)}</em>
          <button disabled={completedGuides.has(guide.id)} onClick={() => onCompleteGuide(guide.id)} type="button">完成指引</button>
        </article>
      ))}
      {bidKingErrorCodes.slice(0, 8).map((code) => {
        const style = bidKingErrorCodeStyle(code);
        return (
        <article className={`error-style-card ${style.className}`} key={`code_${code.id}`}>
          <strong>{safeBidKingDisplayText(code.packaged_name, `回执 ${code.id}`) || `回执 ${code.id}`}</strong>
          <p>{safeBidKingDisplayText(code.packaged_desc, `${style.label}提示会以珍宝局回执返回。`) || `${style.label}提示会以珍宝局回执返回。`}</p>
          <em>{style.label} · {code.columns[3] || code.id}</em>
        </article>
        );
      })}
    </div>
  );
}

function guideSummary(guide: typeof bidKingGuides[number]): string {
  const runtime = bidKingGuideRuntime(guide);
  const target = guideWindowLabel(runtime.targetWindow);
  const node = guideNodeLabel(runtime.targetNode);
  const title = safeBidKingDisplayText(guide.packaged_desc, runtime.textKey);
  return title ? `${target} · ${node} · ${title}` : `${target} · ${node}`;
}

function guideAnchorLabel(guide: typeof bidKingGuides[number]): string {
  const runtime = bidKingGuideRuntime(guide);
  if (!runtime.anchor) {
    return '等待触发';
  }
  return `坐标 ${runtime.anchor.x}, ${runtime.anchor.y}`;
}

function guideWindowLabel(targetWindow: string): string {
  const labels: Record<string, string> = {
    Battle_Main: '竞拍局内',
    UIMain: '主界面'
  };
  return labels[targetWindow] ?? '目标窗口';
}

function guideNodeLabel(targetNode: string): string {
  if (!targetNode) {
    return '界面目标';
  }
  const lastSegment = targetNode.split('/').filter(Boolean).at(-1) ?? targetNode;
  if (/^[A-Za-z]+[_A-Za-z0-9]*$/.test(lastSegment)) {
    return '界面目标';
  }
  return safeBidKingDisplayText(lastSegment, '界面目标') || '界面目标';
}

function windowDisplayLabel(label: string): string {
  if (label.includes('UIMain')) {
    return '珍宝局主厅';
  }
  return safeBidKingDisplayText(label, '界面章程') || '界面章程';
}

function windowDisplayDesc(description: string): string {
  const polished = description
    .replace(/Prefab\s+UI\/Prefab\/[^，。]+/g, '原窗口链路已登记')
    .replace(/BGM/g, '乐曲');
  return safeBidKingDisplayText(polished, '界面层级、乐曲与关闭行为已接入窗口账本。') || '界面层级、乐曲与关闭行为已接入窗口账本。';
}
