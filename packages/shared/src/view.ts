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

/** A card held mid-turn. Carries no identity: the face travels in the draw reveal. */
export interface HeldCardView {
  id: CardId;
}

/**
 * Legal finishes for the held card, so the client can offer the right buttons without
 * reading the drawn card's key.
 */
export interface DrawnOptionsView {
  /** `DISCARD_DRAWN` is legal (hell, and heaven after cambeo, are blocked). */
  canDiscard: boolean;
  /** At least one held card could legally go on the pile, so `REPLACE_CARD` has a target. */
  canReplace: boolean;
  /** `KEEP_DRAWN` is legal. Always true mid-turn; present so the shape reads as a full set. */
  canKeep: boolean;
  /** The draw fired from the discard pile, so discarding it can never trigger a power. */
  fromDiscard: boolean;
}

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
  /**
   * The card the current player is holding mid-turn, identity-free. Its face travels only in the
   * time-boxed `CARD_REVEALED{kind:'DRAW'}` issued when it was drawn, like every other reveal.
   * Present only in the drawing player's own view.
   */
  drawnCard: HeldCardView | null;
  /**
   * Which finishes are legal for the held card. The engine computes this because the client can
   * no longer read the drawn key once the draw reveal expires.
   */
  drawnOptions: DrawnOptionsView | null;
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
