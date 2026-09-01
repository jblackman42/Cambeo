import { cardValue, type GameEvent, type RuleSet } from '@cambeo/shared';
import type { CardId, GameState, PlayerId } from './state.js';

export type RevealKind = 'INITIAL_PEEK' | 'POWER';

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
    durationMs:
      args.kind === 'INITIAL_PEEK' ? ruleSet.initialPeekDurationMs : ruleSet.powerRevealDurationMs,
    key: card.key,
    suit: card.suit,
    value: cardValue(ruleSet, card.key),
  };
}
