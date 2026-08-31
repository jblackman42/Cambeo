import type { CardKey, Suit } from '@cambeo/shared';

const SUIT_GLYPH: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  joker: '★',
};

export function suitGlyph(suit: Suit): string {
  return SUIT_GLYPH[suit];
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function rankLabel(key: CardKey): string {
  switch (key) {
    case 'Q_RED':
    case 'Q_BLACK':
      return 'Q';
    case 'K_RED':
    case 'K_BLACK':
      return 'K';
    case 'HEAVEN':
      return 'HVN';
    case 'HELL':
      return 'HEL';
    default:
      return key;
  }
}

export function powerPromptLabel(powerId: string, stepKind: string): string {
  const map: Record<string, string> = {
    'PEEK_OWN:OWN_CARD': 'Peek one of your cards',
    'PEEK_OTHER:OTHER_CARD': 'Peek one opponent card',
    'BLIND_SWAP:ANY_CARD': 'Choose a card to swap',
    'LOOK_THEN_BLIND_SWAP:OTHER_CARD': 'Look at an opponent card',
    'LOOK_THEN_BLIND_SWAP:ANY_CARD': 'Choose a card to swap',
    'LOOK_THEN_OPTIONAL_SWAP:OWN_CARD': 'Look at one of your cards',
    'LOOK_THEN_OPTIONAL_SWAP:OTHER_CARD': 'Look at an opponent card',
    'LOOK_THEN_OPTIONAL_SWAP:CONFIRM': 'Swap those two cards?',
    'SHUFFLE_TARGET_HAND:ANY_PLAYER': 'Choose a player to shuffle',
  };
  return map[`${powerId}:${stepKind}`] ?? `${powerId}: ${stepKind}`;
}

export function formatEvent(type: string, names: Record<string, string>): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\bp\d+\b/g, (id) => names[id] ?? id);
}
