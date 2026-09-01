import { cardValue, type GameEvent, type RuleSet } from '@cambeo/shared';
import type { CardId, GameState, PlayerId } from './state.js';

export type RevealKind = 'INITIAL_PEEK' | 'POWER' | 'FLIP_FAIL' | 'DRAW';

/** `slotIndex` for a reveal of a card that is not sitting in anyone's hand. */
export const NO_SLOT = -1;

function revealDurationMs(ruleSet: RuleSet, kind: RevealKind): number {
  switch (kind) {
    case 'INITIAL_PEEK':
      return ruleSet.initialPeekDurationMs;
    case 'FLIP_FAIL':
      return ruleSet.flipRevealDurationMs;
    case 'DRAW':
      return ruleSet.drawRevealDurationMs;
    default:
      return ruleSet.powerRevealDurationMs;
  }
}

export function cardRevealedEvent(
  state: GameState,
  ruleSet: RuleSet,
  args: {
    revealedToPlayerId: PlayerId;
    ownerId: PlayerId;
    slotIndex: number;
    cardId: CardId;
    kind: RevealKind;
  },
): GameEvent {
  const card = state.cards[args.cardId];
  if (!card) throw new Error(`Unknown card ${args.cardId}`);
  return {
    type: 'CARD_REVEALED',
    cardId: args.cardId,
    ownerId: args.ownerId,
    slotIndex: args.slotIndex,
    revealedToPlayerId: args.revealedToPlayerId,
    kind: args.kind,
    durationMs: revealDurationMs(ruleSet, args.kind),
    key: card.key,
    suit: card.suit,
    value: cardValue(ruleSet, card.key),
  };
}
