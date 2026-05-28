import { useEffect, useRef, type MutableRefObject } from 'react';
import { bidKingSoundCueAssetUrls } from './bidKingSoundAssetUrls';
import type { BidKingSoundCue } from './bidKingSystemRuntime';

export function useBidKingSoundBridge(): void {
  const bgmRef = useRef<HTMLAudioElement>();
  const oneShotsRef = useRef(new Set<HTMLAudioElement>());

  useEffect(() => {
    function handleSoundCue(event: Event): void {
      const cue = (event as CustomEvent<BidKingSoundCue>).detail;
      if (!cue) {
        return;
      }
      void playCue(cue, bgmRef, oneShotsRef.current);
    }

    window.addEventListener('bidking:sound-cue', handleSoundCue);
    return () => {
      window.removeEventListener('bidking:sound-cue', handleSoundCue);
      bgmRef.current?.pause();
      for (const audio of oneShotsRef.current) {
        audio.pause();
      }
      oneShotsRef.current.clear();
    };
  }, []);
}

async function playCue(
  cue: BidKingSoundCue,
  bgmRef: MutableRefObject<HTMLAudioElement | undefined>,
  oneShots: Set<HTMLAudioElement>
): Promise<void> {
  const urls = bidKingSoundCueAssetUrls(cue);
  if (urls.length === 0) {
    return;
  }

  if (cue.loop) {
    const current = bgmRef.current;
    if (current?.dataset.sourceCueId === String(cue.id) && !current.paused) {
      return;
    }
    current?.pause();
  }

  for (const url of urls) {
    const audio = new Audio(url);
    audio.volume = clampVolume(cue.volume);
    audio.loop = cue.loop;
    audio.preload = 'auto';
    audio.dataset.sourceCueId = String(cue.id);
    try {
      await audio.play();
      if (cue.loop) {
        bgmRef.current = audio;
      } else {
        oneShots.add(audio);
        audio.addEventListener('ended', () => oneShots.delete(audio), { once: true });
        audio.addEventListener('error', () => oneShots.delete(audio), { once: true });
      }
      return;
    } catch {
      audio.pause();
    }
  }
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return 1;
  }
  return Math.min(1, Math.max(0, volume));
}
