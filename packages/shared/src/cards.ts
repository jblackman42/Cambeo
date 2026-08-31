export const CARD_KEYS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q_RED',
  'Q_BLACK',
  'K_RED',
  'K_BLACK',
  'HEAVEN',
  'HELL',
] as const;

export type CardKey = (typeof CARD_KEYS)[number];

export const MATCH_KEYS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'JOKER',
] as const;

export type MatchKey = (typeof MATCH_KEYS)[number];

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number] | 'joker';

export type CardColor = 'red' | 'black' | 'none';

/** Flip matching is by rank only. Color-split keys share a match key. */
export const CARD_KEY_TO_MATCH_KEY: Record<CardKey, MatchKey> = {
  A: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  J: 'J',
  Q_RED: 'Q',
  Q_BLACK: 'Q',
  K_RED: 'K',
  K_BLACK: 'K',
  // Both jokers share a match key so hell flips onto heaven (rank = joker).
  HEAVEN: 'JOKER',
  HELL: 'JOKER',
};

export function matchKeyFor(cardKey: CardKey): MatchKey {
  return CARD_KEY_TO_MATCH_KEY[cardKey];
}

/**
 * Structural deck composition: how many physical cards of each key exist,
 * and which suits they use. This is not a rule value — it describes the
 * physical deck. Values and powers come from RuleSet.
 */
export interface DeckSlot {
  key: CardKey;
  suits: readonly Suit[];
}

export const STANDARD_DECK_COMPOSITION: readonly DeckSlot[] = [
  { key: 'A', suits: SUITS },
  { key: '2', suits: SUITS },
  { key: '3', suits: SUITS },
  { key: '4', suits: SUITS },
  { key: '5', suits: SUITS },
  { key: '6', suits: SUITS },
  { key: '7', suits: SUITS },
  { key: '8', suits: SUITS },
  { key: '9', suits: SUITS },
  { key: '10', suits: SUITS },
  { key: 'J', suits: SUITS },
  { key: 'Q_RED', suits: ['hearts', 'diamonds'] },
  { key: 'Q_BLACK', suits: ['clubs', 'spades'] },
  { key: 'K_RED', suits: ['hearts', 'diamonds'] },
  { key: 'K_BLACK', suits: ['clubs', 'spades'] },
] as const;

export const JOKER_DECK_COMPOSITION: readonly DeckSlot[] = [
  { key: 'HEAVEN', suits: ['joker'] },
  { key: 'HELL', suits: ['joker'] },
] as const;

export function deckComposition(jokers: boolean): readonly DeckSlot[] {
  return jokers
    ? [...STANDARD_DECK_COMPOSITION, ...JOKER_DECK_COMPOSITION]
    : STANDARD_DECK_COMPOSITION;
}

export function deckSizeFromComposition(jokers: boolean): number {
  return deckComposition(jokers).reduce((sum, slot) => sum + slot.suits.length, 0);
}
