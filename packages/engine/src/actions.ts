import type { PlayerId } from './state.js';
import type { PowerTarget } from './state.js';

export type Action =
  | { type: 'START_GAME'; playerId: PlayerId }
  | { type: 'ACK_PEEK'; playerId: PlayerId }
  | { type: 'DRAW_DECK'; playerId: PlayerId }
  | { type: 'DRAW_DISCARD'; playerId: PlayerId }
  | { type: 'DISCARD_DRAWN'; playerId: PlayerId }
  | { type: 'REPLACE_CARD'; playerId: PlayerId; slotIndex: number }
  | { type: 'RESOLVE_POWER_TARGET'; playerId: PlayerId; target: PowerTarget }
  | {
      type: 'FLIP_ATTEMPT';
      playerId: PlayerId;
      target: { playerId: PlayerId; slotIndex: number };
    }
  | { type: 'GIVE_CARD'; playerId: PlayerId; slotIndex: number }
  | { type: 'CALL_CAMBEO'; playerId: PlayerId };
