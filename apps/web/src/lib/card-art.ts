import type { CardKey, Suit } from '@cambeo/shared';
import {
  CARD_ART_MANIFEST,
  CARD_BACK_ASSET,
  type CardArtFile,
  type CardArtStem,
} from '@/lib/card-art-manifest';

const RANK_FILE: Record<CardKey, string> = {
  A: 'ace',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'jack',
  Q_RED: 'queen',
  Q_BLACK: 'queen',
  K_RED: 'king',
  K_BLACK: 'king',
  HEAVEN: 'red_joker',
  HELL: 'black_joker',
};

function stemFor(key: CardKey, suit: Suit): CardArtStem {
  if (key === 'HEAVEN') return 'red_joker';
  if (key === 'HELL') return 'black_joker';
  return `${RANK_FILE[key]}_of_${suit}` as CardArtStem;
}

/** Single mapping from engine card identity → static asset. Use this nowhere else. */
export function cardKeyToAsset(key: CardKey, suit: Suit): CardArtFile {
  return CARD_ART_MANIFEST[stemFor(key, suit)];
}

export function cardBackAsset(): CardArtFile {
  return CARD_BACK_ASSET;
}

export function allCardArtUrls(): string[] {
  const urls = new Set<string>([CARD_BACK_ASSET.src]);
  for (const part of CARD_BACK_ASSET.srcSet.split(',')) {
    const url = part.trim().split(/\s+/)[0];
    if (url) urls.add(url);
  }
  for (const entry of Object.values(CARD_ART_MANIFEST)) {
    urls.add(entry.src);
    if (entry.kind === 'webp') {
      for (const part of entry.srcSet.split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (url) urls.add(url);
      }
    }
  }
  return [...urls];
}
