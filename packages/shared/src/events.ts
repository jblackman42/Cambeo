import type { CardKey, Suit } from './cards.js';
import type { PowerId } from './powers.js';
import type { PowerTarget } from './action.js';
import type { CardId, PlayerId } from './view.js';

export type GameEvent =
  | { type: 'ACTION_REJECTED'; playerId: PlayerId; actionType: string; reason: string }
  | { type: 'GAME_STARTED'; seating: PlayerId[] }
  | { type: 'DEALT'; playerId: PlayerId; cardIds: CardId[] }
  | { type: 'INITIAL_PEEK_GRANTED'; playerId: PlayerId; cardIds: CardId[] }
  | { type: 'PEEK_ACKED'; playerId: PlayerId }
  | { type: 'TURN_STARTED'; playerId: PlayerId }
  | { type: 'TURN_PASSED'; playerId: PlayerId }
  | { type: 'CARD_DRAWN'; playerId: PlayerId; from: 'DECK' | 'DISCARD'; cardId?: CardId }
  | { type: 'CARD_DISCARDED'; playerId: PlayerId; cardId: CardId; triggeredPower: PowerId | null }
  | {
      type: 'CARD_REPLACED';
      playerId: PlayerId;
      newCardId: CardId;
      oldCardId: CardId;
      slotIndex: number;
    }
  | { type: 'CARD_KEPT'; playerId: PlayerId; cardId: CardId }
  | { type: 'POWER_STARTED'; playerId: PlayerId; powerId: PowerId; sourceCardId: CardId }
  | {
      type: 'POWER_REVEAL';
      playerId: PlayerId;
      targetPlayerId: PlayerId;
      slotIndex: number;
      cardId: CardId;
      key?: CardKey;
      suit?: Suit;
    }
  | {
      type: 'POWER_SWAP';
      playerId: PlayerId;
      a: { playerId: PlayerId; slotIndex: number; cardId: CardId };
      b: { playerId: PlayerId; slotIndex: number; cardId: CardId };
    }
  | {
      type: 'POWER_SHUFFLE';
      playerId: PlayerId;
      targetPlayerId: PlayerId;
      newOrder: CardId[];
    }
  | { type: 'POWER_COMPLETED'; playerId: PlayerId; powerId: PowerId }
  | { type: 'POWER_DECLINED_SWAP'; playerId: PlayerId }
  | {
      type: 'FLIP_SUCCESS';
      playerId: PlayerId;
      targetPlayerId: PlayerId;
      slotIndex: number;
      cardId: CardId;
      key: CardKey;
    }
  | {
      type: 'FLIP_FAIL';
      playerId: PlayerId;
      targetPlayerId: PlayerId;
      slotIndex: number;
      cardId: CardId;
      key: CardKey;
    }
  | { type: 'PENALTY_DRAWN'; playerId: PlayerId; cardId: CardId }
  | { type: 'PENALTY_SKIPPED'; playerId: PlayerId; reason: string }
  | {
      type: 'GIVE_REQUIRED';
      flipperId: PlayerId;
      targetId: PlayerId;
    }
  | {
      type: 'CARD_GIVEN';
      fromPlayerId: PlayerId;
      toPlayerId: PlayerId;
      cardId: CardId;
      blind: boolean;
    }
  | {
      type: 'BLIND_DRAW_FOR_TARGET';
      targetId: PlayerId;
      cardId: CardId;
    }
  | { type: 'DECK_RESHUFFLED'; newDeckCount: number; discardTopId: CardId }
  | { type: 'CAMBEO_CALLED'; playerId: PlayerId }
  | { type: 'FINAL_ROUND_TURN'; playerId: PlayerId }
  | { type: 'SCORING_STARTED'; totals: Record<PlayerId, number> }
  | {
      type: 'GAME_OVER';
      winnerIds: PlayerId[];
      callerBeaten: boolean;
      totals: Record<PlayerId, number>;
    }
  | { type: 'LOSS_THRESHOLD_EXCEEDED'; playerId: PlayerId; handSize: number }
  | { type: 'KNOWLEDGE_CLEARED'; cardIds: CardId[] }
  | { type: 'PHASE_CHANGED'; from: string; to: string }
  | { type: 'POWER_TARGET_ACCEPTED'; playerId: PlayerId; target: PowerTarget };
