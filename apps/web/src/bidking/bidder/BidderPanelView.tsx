import { useState, type CSSProperties } from 'react';
import { BookOpen, Crown, Info, Lock, Shield, Users } from 'lucide-react';
import {
  HeroSkin as bidKingHeroSkins,
  bidKingHeroSkinRuntime,
  type BidKingHeroSkinRuntime
} from '@bitkingdom/bidking-compat';
import { gameConfig } from '@bitkingdom/config';
import { bidKingHeroIdForRoleId, bidKingHeroStateFromProfile, bidKingSourceRoles } from '@bitkingdom/match-core';
import type { PlayerProfile } from '@bitkingdom/shared';
import { roleAvatarForRoleId, rolePortraitForRoleId } from '../../artAssets';
import {
  createBidKingSoundCue,
  emitBidKingSoundCue,
  type BidKingSoundCue
} from '../system/bidKingSystemRuntime';
import { FullScreenPanel } from '../ui/FullScreenPanel';
import { bidderBio, roleSkillDetails } from './roleSkillDetails';

type RoleDefinition = (typeof gameConfig.roles)[number];
type BidderTab = 'detail' | 'skin' | 'voice';

interface BidderPanelViewProps {
  profile: PlayerProfile;
  roles: RoleDefinition[];
  selectedRoleId: string;
  onClose: () => void;
  onSelectHeroSkin: (skinId: number) => void;
  onUnlockHero: (heroId: number) => void;
  onSelectRole: (roleId: string) => void;
}

export function BidderPanelView({
  profile,
  roles,
  selectedRoleId,
  onClose,
  onSelectHeroSkin,
  onUnlockHero,
  onSelectRole
}: BidderPanelViewProps): JSX.Element {
  const [tab, setTab] = useState<BidderTab>('detail');
  const [focusedRoleId, setFocusedRoleId] = useState(selectedRoleId);
  const [previewCue, setPreviewCue] = useState<BidKingSoundCue>();
  const sourceRoles = bidKingSourceRoles(roles);
  const focusedRole = sourceRoles.find((role) => role.id === focusedRoleId) ?? sourceRoles[0]!;
  const sourceHeroId = bidKingHeroIdForRoleId(focusedRole.id, sourceRoles);
  const heroState = bidKingHeroStateFromProfile(profile, sourceHeroId);
  const selectable = heroState.state !== 'locked';
  const skill = roleSkillDetails[focusedRole.skillId];
  const skinRows = bidKingHeroSkins.filter((skin) => skin.skinhero === sourceHeroId);
  const skinRuntimes = skinRows.map((skin) => bidKingHeroSkinRuntime(skin));
  const selectedSkinId = profile.selectedHeroSkins?.[String(sourceHeroId)];
  const activeSkin = skinRuntimes.find((skin) => skin.skinId === selectedSkinId) ?? skinRuntimes[0];
  const currentLanguageColumn = Number(profile.settings.languageColumn ?? 1);
  const currentVolume = Number(profile.settings.masterVolume ?? 80);
  const voiceRows = skinRows.flatMap((skin) => skin.voices.map((voiceId) => ({
    skin,
    voiceId,
    cue: createBidKingSoundCue(voiceId, { languageColumn: currentLanguageColumn, masterVolume: currentVolume })
  })));

  function chooseRole(): void {
    if (selectable) {
      onSelectRole(focusedRole.id);
    }
  }

  function previewVoice(cue: BidKingSoundCue): void {
    setPreviewCue(emitBidKingSoundCue(cue));
  }

  return (
    <FullScreenPanel icon={<Users size={32} />} title="竞买人" english="名士席" onClose={onClose}>
      <section className={`bidder-layout tab-${tab}`} style={{ '--role-color': focusedRole.color } as CSSProperties}>
        <aside className="bidder-tabs">
          {[
            { id: 'detail', label: '详情', icon: <BookOpen size={34} /> },
            { id: 'skin', label: '外观', icon: <Shield size={34} /> },
            { id: 'voice', label: '语音', icon: <Info size={34} /> }
          ].map((entry) => (
            <button className={tab === entry.id ? 'active' : ''} key={entry.id} onClick={() => setTab(entry.id as BidderTab)} type="button">
              {entry.icon}
              <span>{entry.label}</span>
            </button>
          ))}
        </aside>

        <main className="bidder-stage">
          <section className="bidder-copy">
            <span>{focusedRole.animal}</span>
            <h3>{focusedRole.name}</h3>
            <p>{bidderBio(focusedRole)}</p>
            <button type="button" onClick={() => setTab('detail')}>
              <Crown size={18} />
              名士掌眼
            </button>
          </section>
          <img className="bidder-portrait" src={rolePortraitForRoleId(focusedRole.id)} alt="" loading="lazy" />
          {tab === 'detail' && (
            <article className="bidder-skill-card">
              <strong>{skill.skillName}</strong>
              <p>{skill.active}</p>
              <hr />
              <span>掌眼效果</span>
              <p>{focusedRole.passive}</p>
            </article>
          )}
          {tab === 'skin' && (
            <article className="bidder-skill-card bidder-skin-card">
              <strong>外观</strong>
              <p>{skinRuntimes.length ? `衣装 ${skinRuntimes.length} 套 · 当前 ${activeSkin?.label ?? focusedRole.name}` : '该竞买人暂无外观配置。'}</p>
              <hr />
              {activeSkin && (
                <HeroSkinPreview
                  runtime={activeSkin}
                  portraitSrc={rolePortraitForRoleId(focusedRole.id)}
                />
              )}
              <div className="hero-skin-choice-grid">
                {skinRuntimes.map((skin) => (
                  <button
                    className={selectedSkinId === skin.skinId ? 'selected' : ''}
                    key={skin.skinId}
                    onClick={() => onSelectHeroSkin(skin.skinId)}
                    title={`外观 ${skin.label} · ${skin.accessLabel}`}
                    type="button"
                  >
                    <strong>{skin.label}</strong>
                    <span>{skin.accessLabel}</span>
                    <em>{skin.voiceIds.length} 语音 · 乐曲 {skin.battleBgmIds.join('/')}</em>
                  </button>
                ))}
              </div>
            </article>
          )}
          {tab === 'voice' && (
            <article className="bidder-skill-card bidder-skin-card">
              <strong>语音</strong>
              <p>{voiceRows.length ? `衣装语音已连接声闻与多语音册，共 ${voiceRows.length} 条。` : '该竞买人暂无语音配置。'}</p>
              <hr />
              {voiceRows.slice(0, 6).map(({ cue, skin: skinRow, voiceId }) => (
                <span key={`${skinRow.id}_${voiceId}`}>
                  {cue ? `${cue.name} · ${cue.playablePath}` : `${voiceId} · 未找到声闻`}
                  {cue && <button type="button" onClick={() => previewVoice(cue)}>试听</button>}
                </span>
              ))}
              {previewCue && <em>最近触发 {previewCue.name} · {previewCue.playablePath}</em>}
            </article>
          )}
        </main>

        <aside className="bidder-roster">
          <div className="bidder-roster-grid">
            {sourceRoles.map((role) => {
              const state = bidKingHeroStateFromProfile(profile, bidKingHeroIdForRoleId(role.id, sourceRoles));
              const roleSelectable = state.state !== 'locked';
              return (
                <button
                  className={`${role.id === focusedRole.id ? 'selected' : ''} ${roleSelectable ? 'owned' : 'locked'} state-${state.state}`}
                  key={role.id}
                  onClick={() => setFocusedRoleId(role.id)}
                  title={heroStateLabel(state.state)}
                  type="button"
                >
                  <img src={roleAvatarForRoleId(role.id)} alt="" loading="lazy" />
                  {!roleSelectable && <Lock size={16} />}
                </button>
              );
            })}
          </div>
          <div className="bidder-action">
            {selectable ? (
              <>
                <span>{heroStateLabel(heroState.state)}</span>
                <button className="primary" type="button" onClick={chooseRole} disabled={selectedRoleId === focusedRole.id}>
                  {selectedRoleId === focusedRole.id ? '已选用' : '选用'}
                </button>
              </>
            ) : (
              <>
                <span>{heroCostLabel(heroState.accessCost)}</span>
                <button className="primary buy" type="button" onClick={() => onUnlockHero(sourceHeroId)}>购买</button>
              </>
            )}
          </div>
        </aside>
      </section>
    </FullScreenPanel>
  );
}

function heroStateLabel(state: string): string {
  if (state === 'owned') {
    return '已拥有';
  }
  if (state === 'free') {
    return '限免';
  }
  if (state === 'trial') {
    return '体验';
  }
  return '未拥有';
}

function heroCostLabel(cost: ReturnType<typeof bidKingHeroStateFromProfile>['accessCost']): string {
  if (!cost) {
    return '待开放';
  }
  return `${cost.label} ${cost.quantity.toLocaleString()}`;
}

function HeroSkinPreview({
  runtime,
  portraitSrc
}: {
  runtime: BidKingHeroSkinRuntime;
  portraitSrc?: string;
}): JSX.Element {
  return (
    <div
      className="hero-skin-substitute"
      style={{ '--skin-hue': `${runtime.accentHue}deg` } as CSSProperties}
      title={heroSkinSourceLabel(runtime)}
    >
      {portraitSrc && <img src={portraitSrc} alt="" loading="lazy" />}
      <div>
        <strong>{runtime.label}</strong>
        <span>{heroSkinVisualLabel(runtime)}</span>
        <em>{heroSkinSourceLabel(runtime)}</em>
      </div>
    </div>
  );
}

function heroSkinVisualLabel(runtime: BidKingHeroSkinRuntime): string {
  return `自有角色立绘替代 · 色调 ${runtime.accentHue}°`;
}

function heroSkinSourceLabel(runtime: BidKingHeroSkinRuntime): string {
  return `${runtime.sourceFields.length} 个原表字段映射 · 角色色调已接入`;
}
