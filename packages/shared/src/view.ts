import type { CardKey, Suit } from './cards.js';
import type { GameEvent } from './events.js';
import type { PowerId } from './powers.js';
import type { PowerTarget } from './action.js';
import type { RuleSet } from './ruleset.js';

/** Wire / client-facing redacted view shapes. Engine projects GameState into these. */

export type PlayerId = string;
export type CardId = string;

export interface PublicCardView {
  id: CardId;
  key: CardKey;
  suit: Suit;
  value: number;
}

export interface HiddenCardView {
  id: CardId;
  known: false;
}

export interface KnownCardView {
  id: CardId;
  known: true;
  key: CardKey;
  suit: Suit;
  value: number;
}

export type SlotView = HiddenCardView | KnownCardView;

export interface PlayerView {
  id: PlayerId;
  hand: SlotView[];
  cardCount: number;
}

export interface PendingPowerView {
  playerId: PlayerId;
  powerId: PowerId;
  stepIndex: number;
  /** Step-aligned targets already chosen (card slots are public; identities are not). */
  selections?: PowerTarget[];
}

export interface PendingGiveView {
  flipperId: PlayerId;
  targetId: PlayerId;
}

export interface GameResultView {
  totals: Record<PlayerId, number>;
  winnerIds: PlayerId[];
  callerBeaten: boolean;
}

export interface RedactedGameView {
  viewerId: PlayerId;
  phase: string;
  seating: PlayerId[];
  players: Record<PlayerId, PlayerView>;
  deckCount: number;
  discardTop: PublicCardView | null;
  discardCount: number;
  turn: {
    playerId: PlayerId;
    hasDrawn: boolean;
    drawnFrom: 'DECK' | 'DISCARD' | null;
  } | null;
  /** Drawn card is only visible to the drawing player. */
  drawnCard: PublicCardView | null;
  pendingPower: PendingPowerView | null;
  pendingGive: PendingGiveView | null;
  cambeoCallerId: PlayerId | null;
  finalRoundRemaining: PlayerId[];
  overThreshold: PlayerId[];
  result: GameResultView | null;
  ruleSet: RuleSet;
  ackedPeek: PlayerId[];
  lastEvents: GameEvent[];
}
