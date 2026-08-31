import type { Action, PlayerId } from '@cambeo/shared';
import type { GameState } from '@cambeo/engine';

/** Map a disconnected player's blocking state to an existing (or PASS_TURN) engine action. */
export function disconnectAction(game: GameState, playerId: PlayerId): Action | null {
  if (!game.seating.includes(playerId)) return null;

  if (game.phase === 'INITIAL_PEEK') {
    if (!game.ackedPeek.includes(playerId)) {
      return { type: 'ACK_PEEK', playerId };
    }
    return null;
  }

  if (!game.turn || game.turn.playerId !== playerId) return null;

  if ((game.phase === 'TURN_DRAW' || game.phase === 'FINAL_ROUND') && !game.turn.hasDrawn) {
    return { type: 'PASS_TURN', playerId };
  }
  if (game.phase === 'TURN_CHOICE') {
    return { type: 'KEEP_DRAWN', playerId };
  }

  // POWER_TARGETING / GIVE_CARD_PENDING: no legal skip without inventing play.
  return null;
}

export function nextTimeoutTarget(
  game: GameState,
  isConnected: (id: PlayerId) => boolean,
): PlayerId | null {
  if (game.phase === 'INITIAL_PEEK') {
    return (
      game.seating.find((id) => !game.ackedPeek.includes(id) && !isConnected(id)) ?? null
    );
  }
  if (!game.turn) return null;
  if (isConnected(game.turn.playerId)) return null;
  if (disconnectAction(game, game.turn.playerId)) return game.turn.playerId;
  return null;
}
