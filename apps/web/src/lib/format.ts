import type { CardKey, PowerId, Suit } from '@cambeo/shared';

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

export function cardKeyLabel(key: CardKey): string {
  switch (key) {
    case 'Q_RED':
      return 'Q red';
    case 'Q_BLACK':
      return 'Q black';
    case 'K_RED':
      return 'K red';
    case 'K_BLACK':
      return 'K black';
    case 'HEAVEN':
      return 'Heaven';
    case 'HELL':
      return 'Hell';
    default:
      return key;
  }
}

export function powerLabel(id: PowerId | string): string {
  switch (id) {
    case 'NONE':
      return 'None';
    case 'PEEK_OWN':
      return 'Peek own';
    case 'PEEK_OTHER':
      return 'Spy';
    case 'BLIND_SWAP':
      return 'Blind swap';
    case 'LOOK_THEN_BLIND_SWAP':
      return 'Look and Swap';
    case 'LOOK_THEN_OPTIONAL_SWAP':
      return 'Look then optional swap';
    case 'SHUFFLE_TARGET_HAND':
      return 'Shuffle a hand';
    default:
      return id;
  }
}

export function formatPoints(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
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

/** Spoken rank for prompts ("Queen", "7", "Heaven"). */
export function rankSpokenName(key: CardKey): string {
  switch (key) {
    case 'A':
      return 'Ace';
    case 'J':
      return 'Jack';
    case 'Q_RED':
    case 'Q_BLACK':
      return 'Queen';
    case 'K_RED':
    case 'K_BLACK':
      return 'King';
    case 'HEAVEN':
      return 'Heaven';
    case 'HELL':
      return 'Hell';
    default:
      return key;
  }
}

function withArticle(name: string): string {
  if (name === 'Heaven' || name === 'Hell') return name;
  const an = /^(Ace|8|11|18|[AEIOU])/i.test(name);
  return `${an ? 'an' : 'a'} ${name}`;
}

export function flipPenaltyMessage(flippedKey: CardKey, discardKey: CardKey): string {
  return `No match. You flipped ${withArticle(rankSpokenName(flippedKey))} onto ${withArticle(rankSpokenName(discardKey))}. You take a penalty card.`;
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
