import type { RuleSet } from '@cambeo/shared';
import type { Action } from './actions.js';
import type { GameEvent } from './events.js';
import type { GameState, PlayerId } from './state.js';
import type { Rng } from './rng.js';
import { reject, withRng } from './setup.js';
import { computeScores, finishGame } from './scoring.js';

export function callCambeo(
  state: GameState,
  action: Extract<Action, { type: 'CALL_CAMBEO' }>,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase === 'GIVE_CARD_PENDING') {
    return reject(state, action.playerId, 'CALL_CAMBEO', 'Must give a card first');
  }
  if (state.phase === 'FINAL_ROUND' || state.cambeo !== null) {
    return reject(state, action.playerId, 'CALL_CAMBEO', 'Cambeo already called / final round');
  }
  if (state.phase !== 'TURN_DRAW') {
    return reject(state, action.playerId, 'CALL_CAMBEO', 'Can only call before drawing');
  }
  if (!state.turn || state.turn.playerId !== action.playerId) {
    return reject(state, action.playerId, 'CALL_CAMBEO', 'Not your turn');
  }
  if (state.turn.hasDrawn) {
    return reject(state, action.playerId, 'CALL_CAMBEO', 'Already drawn');
  }

  // Every other player gets one more turn
  const finalRoundRemaining = state.seating.filter((id) => id !== action.playerId);
  const events: GameEvent[] = [
    { type: 'CAMBEO_CALLED', playerId: action.playerId },
    { type: 'PHASE_CHANGED', from: state.phase, to: 'FINAL_ROUND' },
  ];

  if (finalRoundRemaining.length === 0) {
    // Shouldn't happen with min 3 players, but score immediately
    return finishGame(
      {
        ...state,
        cambeo: { callerId: action.playerId },
        finalRoundRemaining: [],
        phase: 'SCORING',
        turn: null,
      },
      ruleSet,
      rng,
      events,
    );
  }

  const nextPlayer = finalRoundRemaining[0]!;
  events.push({ type: 'FINAL_ROUND_TURN', playerId: nextPlayer });
  events.push({ type: 'TURN_STARTED', playerId: nextPlayer });

  return withRng(
    {
      ...state,
      cambeo: { callerId: action.playerId },
      finalRoundRemaining: finalRoundRemaining.slice(1),
      phase: 'FINAL_ROUND',
      turn: { playerId: nextPlayer, hasDrawn: false, drawnFrom: null },
      drawnCard: null,
      pendingPower: null,
    },
    rng,
    events,
  );
}

/**
 * After a player's turn action completes (discard without power, replace, or power done),
 * advance to the next player — or score if final round is done.
 */
export function advanceAfterTurnAction(
  state: GameState,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  const events = [...state.lastEvents];

  if (state.cambeo) {
    // Final round: remaining players each get one turn
    if (state.finalRoundRemaining.length === 0) {
      events.push({ type: 'PHASE_CHANGED', from: state.phase, to: 'SCORING' });
      return finishGame(
        {
          ...state,
          phase: 'SCORING',
          turn: null,
          drawnCard: null,
          pendingPower: null,
        },
        ruleSet,
        rng,
        events,
      );
    }

    const nextPlayer = state.finalRoundRemaining[0]!;
    const remaining = state.finalRoundRemaining.slice(1);
    events.push({ type: 'FINAL_ROUND_TURN', playerId: nextPlayer });
    events.push({ type: 'TURN_STARTED', playerId: nextPlayer });
    return withRng(
      {
        ...state,
        finalRoundRemaining: remaining,
        phase: 'FINAL_ROUND',
        turn: { playerId: nextPlayer, hasDrawn: false, drawnFrom: null },
        drawnCard: null,
        pendingPower: null,
      },
      rng,
      events,
    );
  }

  // Normal turn order
  const currentIdx = state.seating.indexOf(state.turn!.playerId);
  const nextIdx = (currentIdx + 1) % state.seating.length;
  const nextPlayer = state.seating[nextIdx]!;
  events.push({ type: 'TURN_STARTED', playerId: nextPlayer });
  events.push({ type: 'PHASE_CHANGED', from: state.phase, to: 'TURN_DRAW' });

  return withRng(
    {
      ...state,
      phase: 'TURN_DRAW',
      turn: { playerId: nextPlayer, hasDrawn: false, drawnFrom: null },
      drawnCard: null,
      pendingPower: null,
    },
    rng,
    events,
  );
}

export function nextPlayerId(state: GameState, from: PlayerId): PlayerId {
  const idx = state.seating.indexOf(from);
  return state.seating[(idx + 1) % state.seating.length]!;
}

// re-export for scoring path
void computeScores;
