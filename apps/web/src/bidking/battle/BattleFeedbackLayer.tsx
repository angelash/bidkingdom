import { useCallback, useEffect, useRef, useState } from 'react';
import { Hero, HeroSkin } from '@bitkingdom/bidking-compat';
import type { PlayerSnapshot, PublicPlayer, SkillFeedEntry } from '@bitkingdom/shared';
import {
  createBidKingSoundCue,
  emitBidKingSoundCue
} from '../system/bidKingSystemRuntime';
import { playerNameById } from './BattlePanels';

type CurrentRound = NonNullable<PlayerSnapshot['public']['currentRound']>;

interface BattleFeedbackLayerProps {
  currentRound: CurrentRound;
  phaseRemaining: number;
  selfPlayer?: PublicPlayer;
  snapshot: PlayerSnapshot;
}

interface FloatingCue {
  id: string;
  tone: 'round' | 'urgent' | 'skill' | 'settlement' | 'emote';
  title: string;
  detail?: string;
}

const HERO_VOICE_PICK = 0;
const HERO_VOICE_CAST_SKILL = 1;
const HERO_VOICE_VICTORY = 2;
const HERO_VOICE_LOSS = 3;
const HERO_VOICE_PROFIT = 4;

export function BattleFeedbackLayer({
  currentRound,
  phaseRemaining,
  selfPlayer,
  snapshot
}: BattleFeedbackLayerProps): JSX.Element {
  const [cues, setCues] = useState<FloatingCue[]>([]);
  const nextCueIdRef = useRef(0);
  const roundIdRef = useRef('');
  const phaseKeyRef = useRef('');
  const countdownKeyRef = useRef('');
  const skillSeenRef = useRef(new Set<string>());
  const settlementKeyRef = useRef('');
  const emoteKeyByPlayerRef = useRef(new Map<string, string>());

  const pushCue = useCallback((cue: Omit<FloatingCue, 'id'>) => {
    const id = `battle_cue_${nextCueIdRef.current++}`;
    setCues((current) => [...current.slice(-3), { ...cue, id }]);
    window.setTimeout(() => {
      setCues((current) => current.filter((entry) => entry.id !== id));
    }, 1900);
  }, []);

  useEffect(() => {
    if (roundIdRef.current === currentRound.id) {
      return;
    }
    roundIdRef.current = currentRound.id;
    phaseKeyRef.current = '';
    countdownKeyRef.current = '';
    settlementKeyRef.current = '';
    skillSeenRef.current = new Set();
    playSound(10);
    pushCue({
      tone: 'round',
      title: `第 ${currentRound.index + 1} 轮`,
      detail: currentRound.container.name
    });
    if (currentRound.index === 0 && selfPlayer) {
      window.setTimeout(() => playHeroVoice(selfPlayer, HERO_VOICE_PICK), 900);
    }
  }, [currentRound.container.name, currentRound.id, currentRound.index, pushCue, selfPlayer]);

  useEffect(() => {
    const key = `${currentRound.id}:${currentRound.phase}`;
    if (phaseKeyRef.current === key) {
      return;
    }
    phaseKeyRef.current = key;
    if (currentRound.phase === 'auction') {
      pushCue({ tone: 'round', title: '开拍', detail: `${phaseRemaining}s` });
    }
    if (currentRound.phase === 'settlement' && currentRound.settlement?.isFinal === false) {
      pushCue({ tone: 'settlement', title: '本轮反馈', detail: currentRound.bidFeedback?.decision?.reason });
    }
  }, [
    currentRound.bidFeedback?.decision?.reason,
    currentRound.id,
    currentRound.phase,
    currentRound.settlement?.isFinal,
    phaseRemaining,
    pushCue
  ]);

  useEffect(() => {
    if (currentRound.phase !== 'auction' || phaseRemaining !== 5) {
      return;
    }
    const key = `${currentRound.id}:5`;
    if (countdownKeyRef.current === key) {
      return;
    }
    countdownKeyRef.current = key;
    playSound(20);
    pushCue({ tone: 'urgent', title: '五息将尽', detail: '竞价即将落槌' });
  }, [currentRound.id, currentRound.phase, phaseRemaining, pushCue]);

  useEffect(() => {
    const feed = currentRound.skillFeed ?? [];
    const added = feed.filter((entry) => !skillSeenRef.current.has(entry.id));
    for (const entry of added) {
      skillSeenRef.current.add(entry.id);
    }
    for (const [index, entry] of added.slice(-4).entries()) {
      window.setTimeout(() => {
        const actor = entry.playerId
          ? snapshot.public.players.find((player) => player.id === entry.playerId)
          : undefined;
        if (actor) {
          playHeroVoice(actor, HERO_VOICE_CAST_SKILL);
        } else {
          playSound(23);
        }
        pushCue({
          tone: 'skill',
          title: entry.skillName,
          detail: skillCueDetail(entry, snapshot.public.players)
        });
      }, index * 420);
    }
  }, [currentRound.skillFeed, pushCue, snapshot.public.players]);

  useEffect(() => {
    const settlement = currentRound.settlement;
    if (!settlement?.isFinal) {
      return;
    }
    const key = `${currentRound.id}:${currentRound.phase}:${settlement.winnerId ?? 'no_winner'}`;
    if (settlementKeyRef.current === key) {
      return;
    }
    settlementKeyRef.current = key;
    playSound(9);
    const winner = snapshot.public.players.find((player) => player.id === settlement.winnerId);
    if (winner) {
      playHeroVoice(winner, HERO_VOICE_VICTORY);
      if (currentRound.phase === 'settlement') {
        playHeroVoice(winner, settlement.profit >= 0 ? HERO_VOICE_PROFIT : HERO_VOICE_LOSS);
      }
    }
    pushCue({
      tone: 'settlement',
      title: '成交揭晓',
      detail: winner ? `${winner.name} · ${settlement.payment.toLocaleString()}` : '无人成交'
    });
  }, [
    currentRound.id,
    currentRound.phase,
    currentRound.settlement,
    pushCue,
    snapshot.public.players
  ]);

  useEffect(() => {
    for (const player of snapshot.public.players) {
      if (!player.emote || !player.emoteSoundId) {
        continue;
      }
      const key = `${player.emote}:${player.emoteSoundId}`;
      if (emoteKeyByPlayerRef.current.get(player.id) === key) {
        continue;
      }
      emoteKeyByPlayerRef.current.set(player.id, key);
      playSound(player.emoteSoundId);
      pushCue({ tone: 'emote', title: player.name, detail: player.emote });
    }
  }, [pushCue, snapshot.public.players]);

  return (
    <div className="battle-feedback-layer" aria-live="polite">
      {cues.map((cue) => (
        <div className={`battle-floating-cue tone-${cue.tone}`} key={cue.id}>
          <strong>{cue.title}</strong>
          {cue.detail && <span>{cue.detail}</span>}
        </div>
      ))}
    </div>
  );
}

function skillCueDetail(entry: SkillFeedEntry, players: PublicPlayer[]): string {
  const actor = entry.playerId ? playerNameById(players, entry.playerId) : entry.sourceName;
  return `${actor} · ${entry.sourceName}`;
}

function playSound(soundId: number): void {
  const cue = createBidKingSoundCue(soundId);
  if (cue) {
    emitBidKingSoundCue(cue);
  }
}

function playHeroVoice(player: PublicPlayer, voiceIndex: number): void {
  const voiceId = heroVoiceId(player, voiceIndex);
  if (voiceId) {
    playSound(voiceId);
  }
}

function heroVoiceId(player: PublicPlayer, voiceIndex: number): number | undefined {
  const skin = player.heroSkinCid ? HeroSkin.find((row) => row.id === player.heroSkinCid) : undefined;
  const skinVoice = skin?.voices[voiceIndex];
  if (skinVoice) {
    return skinVoice;
  }
  const hero = player.heroCid ? Hero.find((row) => row.id === player.heroCid) : undefined;
  return hero?.voices[voiceIndex];
}
