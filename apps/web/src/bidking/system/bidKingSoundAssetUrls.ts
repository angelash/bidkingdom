import type { BidKingSoundCue } from './bidKingSystemRuntime';

export function bidKingSoundCueAssetUrls(cue: Pick<BidKingSoundCue, 'fullPath' | 'playablePath'>): string[] {
  const urls = [
    ...sourceAudioUrlsForPath(cue.playablePath),
    ...sourceAudioUrlsForPath(cue.fullPath)
  ];
  return [...new Set(urls)];
}

function sourceAudioUrlsForPath(value: string): string[] {
  const normalized = normalizeSourceAudioPath(value);
  if (!normalized) {
    return [];
  }
  const variants = new Set<string>();
  const withoutExtension = normalized.replace(/\.(?:wav|mp3|ogg)$/i, '');
  const extensions = /\.(?:wav|mp3|ogg)$/i.test(normalized)
    ? ['']
    : ['_None.wav', '.wav', '.mp3', '.ogg'];
  for (const base of [withoutExtension, normalized]) {
    for (const extension of extensions) {
      variants.add(`${base}${extension}`);
    }
  }
  return [...variants].map((pathValue) => `/source-audio/${pathValue.split('/').map(encodeURIComponent).join('/')}`);
}

function normalizeSourceAudioPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^(?:语音|音频|乐曲|登录乐曲|主厅乐曲|文书条目)/.test(trimmed)) {
    return '';
  }
  const normalized = trimmed
    .replace(/\\/g, '/')
    .replace(/^Sound\//i, '')
    .replace(/^\/+/, '');
  if (!/^[A-Za-z0-9_&./ -]+$/.test(normalized)) {
    return '';
  }
  const parts = normalized.split('/').filter(Boolean);
  return parts
    .map((part, index) => (index < parts.length - 1 ? part.toLowerCase() : part))
    .join('/');
}
