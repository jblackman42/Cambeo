import { cardValue, type RuleSet } from '@cambeo/shared';
import type { GameEvent } from './events.js';
import type { GameState, PlayerId } from './state.js';
import type { Rng } from './rng.js';
import { getCard } from './setup.js';
import { specialCardHooks } from './extensions/heavenHell.js';
import { withRng } from './setup.js';

/**
 * TODO(spec 11.2): "More than 6 cards and you lose" vs "there are no eliminated players."
 * Crossing the threshold currently only flags the player and emits an event.
 * No elimination and no forced game end. Behavior TBD.
 */
export function maybeFlagLossThreshold(
  state: GameState,
  playerId: PlayerId,
  ruleSet: RuleSet,
): { state: GameState; event: GameEvent | null } {
  const handSize = state.players[playerId]?.hand.length ?? 0;
  // lossThreshold: card count above which a player loses.
  // Rules: "more than 6 cards" → handSize > lossThreshold (default 6 → >= 7).
  if (handSize > ruleSet.lossThreshold && !state.overThreshold.includes(playerId)) {
    return {
      state: {
        ...state,
        overThreshold: [...state.overThreshold, playerId],
      },
      event: { type: 'LOSS_THRESHOLD_EXCEEDED', playerId, handSize },
    };
  }
  return { state, event: null };
}

export function computeScores(
  state: GameState,
  ruleSet: RuleSet,
): Record<PlayerId, number> {
  const totals: Record<PlayerId, number> = {};
  for (const playerId of state.seating) {
    let total = 0;
    for (const cardId of state.players[playerId]!.hand) {
      const card = getCard(state, cardId);
      const base = cardValue(ruleSet, card.key);
      // EXTENSION POINT (spec 11.1)
      const adjusted = specialCardHooks.onScoreCard(card.key, base, ruleSet);
      total += adjusted ?? base;
    }
    totals[playerId] = total;
  }
  return totals;
}

export function finishGame(
  state: GameState,
  ruleSet: RuleSet,
  rng: Rng,
  priorEvents: GameEvent[],
): GameState {
  const totals = computeScores(state, ruleSet);
  const events = [...priorEvents, { type: 'SCORING_STARTED' as const, totals }];

  const callerId = state.cambeo?.callerId;
  let winnerIds: PlayerId[];
  let callerBeaten = false;

  if (callerId) {
    const callerScore = totals[callerId]!;
    const others = state.seating.filter((id) => id !== callerId);
    // Ties go against the caller. If anyone ties or beats (lower or equal) the caller, they win.
    const beaters = others.filter((id) => totals[id]! <= callerScore);
    if (beaters.length > 0) {
      callerBeaten = true;
      const best = Math.min(...beaters.map((id) => totals[id]!));
      winnerIds = beaters.filter((id) => totals[id] === best);
    } else {
      winnerIds = [callerId];
    }
  } else {
    const best = Math.min(...state.seating.map((id) => totals[id]!));
    winnerIds = state.seating.filter((id) => totals[id] === best);
  }

  events.push({
    type: 'GAME_OVER',
    winnerIds,
    callerBeaten,
    totals,
  });
  events.push({ type: 'PHASE_CHANGED', from: 'SCORING', to: 'OVER' });

  // Reveal all hands: grant all knowledge
  const knowledge = { ...state.knowledge };
  for (const playerId of state.seating) {
    const all: Record<string, true> = { ...knowledge[playerId] };
    for (const pid of state.seating) {
      for (const cardId of state.players[pid]!.hand) {
        all[cardId] = true;
      }
    }
    for (const cardId of state.discard) {
      all[cardId] = true;
    }
    knowledge[playerId] = all;
  }

  return withRng(
    {
      ...state,
      phase: 'OVER',
      turn: null,
      knowledge,
      result: { totals, winnerIds, callerBeaten },
    },
    rng,
    events,
  );
}
