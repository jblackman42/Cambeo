import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_KEYS, SUITS, type CardKey, type Suit } from '@cambeo/shared';
import { describe, expect, it } from 'vitest';
import { CARD_ART_MANIFEST } from '@/lib/card-art-manifest';
import { allCardArtUrls, cardBackAsset, cardKeyToAsset } from '@/lib/card-art';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');

describe('cardKeyToAsset', () => {
  it('maps ranks and suits onto the vendored filenames', () => {
    expect(cardKeyToAsset('A', 'hearts').src).toMatch(/ace_of_hearts/);
    expect(cardKeyToAsset('10', 'clubs').src).toMatch(/10_of_clubs/);
    expect(cardKeyToAsset('J', 'diamonds').src).toMatch(/jack_of_diamonds/);
    expect(cardKeyToAsset('Q_RED', 'hearts').src).toMatch(/queen_of_hearts/);
    expect(cardKeyToAsset('Q_BLACK', 'spades').src).toMatch(/queen_of_spades/);
    expect(cardKeyToAsset('K_RED', 'diamonds').src).toMatch(/king_of_diamonds/);
    expect(cardKeyToAsset('K_BLACK', 'clubs').src).toMatch(/king_of_clubs/);
  });

  it('uses red joker for heaven and black joker for hell', () => {
    expect(cardKeyToAsset('HEAVEN', 'joker').src).toMatch(/red_joker/);
    expect(cardKeyToAsset('HELL', 'joker').src).toMatch(/black_joker/);
  });

  it('serves SVG for pip cards and WebP for faces and jokers', () => {
    expect(cardKeyToAsset('2', 'hearts').kind).toBe('svg');
    expect(cardKeyToAsset('A', 'spades').kind).toBe('svg');
    expect(cardKeyToAsset('J', 'hearts').kind).toBe('webp');
    expect(cardKeyToAsset('Q_RED', 'diamonds').kind).toBe('webp');
    expect(cardKeyToAsset('K_BLACK', 'spades').kind).toBe('webp');
    expect(cardKeyToAsset('HEAVEN', 'joker').kind).toBe('webp');
    expect(cardKeyToAsset('HELL', 'joker').kind).toBe('webp');
  });

  it('covers every non-joker key × suit used in the deck', () => {
    const pipKeys: CardKey[] = CARD_KEYS.filter(
      (k) => k !== 'HEAVEN' && k !== 'HELL' && !k.startsWith('Q_') && !k.startsWith('K_'),
    );
    for (const key of pipKeys) {
      for (const suit of SUITS) {
        const asset = cardKeyToAsset(key, suit);
        expect(asset.src.startsWith('/cards/')).toBe(true);
      }
    }
    for (const suit of ['hearts', 'diamonds'] as Suit[]) {
      expect(cardKeyToAsset('Q_RED', suit).src).toMatch(/queen_of_/);
      expect(cardKeyToAsset('K_RED', suit).src).toMatch(/king_of_/);
    }
    for (const suit of ['clubs', 'spades'] as Suit[]) {
      expect(cardKeyToAsset('Q_BLACK', suit).src).toMatch(/queen_of_/);
      expect(cardKeyToAsset('K_BLACK', suit).src).toMatch(/king_of_/);
    }
  });

  it('has a hashed card-back asset', () => {
    const back = cardBackAsset();
    expect(back.kind).toBe('webp');
    expect(back.src).toMatch(/^\/cards\/back-/);
  });

  it('preloads the full 54-face deck plus the back', () => {
    expect(Object.keys(CARD_ART_MANIFEST)).toHaveLength(54);
    const urls = allCardArtUrls();
    expect(urls.length).toBeGreaterThanOrEqual(54 + 1);
    expect(urls.every((u) => u.startsWith('/cards/'))).toBe(true);
  });

  it('ships a public file for every mapped asset URL', () => {
    for (const url of allCardArtUrls()) {
      const file = path.join(publicDir, url.replace(/^\//, ''));
      expect(existsSync(file), file).toBe(true);
    }
  });
});
