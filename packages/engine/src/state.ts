import type { CardKey, PowerId, PowerTarget, Suit } from '@cambeo/shared';
import type { CardId, PlayerId } from '@cambeo/shared';

export type { CardId, PlayerId, PowerTarget };

export interface Card {
  id: CardId;
  key: CardKey;
  suit: Suit;
}

export interface PlayerState {
  id: PlayerId;
  hand: CardId[];
}

export interface TurnState {
  playerId: PlayerId;
  hasDrawn: boolean;
  drawnFrom: 'DECK' | 'DISCARD' | null;
}

export interface PendingPower {
  playerId: PlayerId;
  powerId: PowerId;
  sourceCardId: CardId;
  stepIndex: number;
  selections: PowerTarget[];
  /** For LOOK_THEN_OPTIONAL_SWAP: the two revealed cards to optionally swap. */
  revealedForOptionalSwap?: Array<{ playerId: PlayerId; slotIndex: number }>;
}

export interface PendingGive {
  flipperId: PlayerId;
  targetId: PlayerId;
  /** Slot that was successfully flipped (already removed from target hand). */
  removedCardId: CardId;
}

export interface CambeoState {
  callerId: PlayerId;
}

export interface GameResult {
  totals: Record<PlayerId, number>;
  winnerIds: PlayerId[];
  callerBeaten: boolean;
}

export interface GameState {
  seed: string;
  rngState: number;
  phase: import('./phases.js').Phase;
  /** Phase to return to after GIVE_CARD_PENDING resolves. */
  phaseBeforeGive: import('./phases.js').Phase | null;
  seating: PlayerId[];
  players: Record<PlayerId, PlayerState>;
  cards: Record<CardId, Card>;
  deck: CardId[];
  /** Last element is the top of the discard pile. */
  discard: CardId[];
  discardEpoch: number;
  flipWonForEpoch: number | null;
  turn: TurnState | null;
  drawnCard: CardId | null;
  pendingPower: PendingPower | null;
  pendingGive: PendingGive | null;
  cambeo: CambeoState | null;
  finalRoundRemaining: PlayerId[];
  ackedPeek: PlayerId[];
  /** Players who exceeded lossThreshold. Flag only — see TODO(spec 11.2). */
  overThreshold: PlayerId[];
  result: GameResult | null;
  lastEvents: import('./events.js').GameEvent[];
}
