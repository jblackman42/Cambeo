import type { RuleSet } from '@cambeo/shared';
import type { Action } from './actions.js';
import type { GameState } from './state.js';
import { createRng, type Rng } from './rng.js';
import { startGame, ackPeek, reject } from './setup.js';
import { drawDeck, drawDiscard, discardDrawn, replaceCard } from './turn.js';
import { resolvePowerTarget } from './powers.js';
import { flipAttempt, giveCard } from './flip.js';
import { callCambeo } from './cambeo.js';

/**
 * Pure rules reducer. Deterministic given seed/rng cursor.
 * Illegal actions return prior state with a single ACTION_REJECTED event.
 */
export function reduce(
  state: GameState,
  action: Action,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  // Keep rng cursor aligned with state for resume
  rng.setState(state.rngState);

  switch (action.type) {
    case 'START_GAME':
      return startGame(state, action, ruleSet, rng);
    case 'ACK_PEEK':
      return ackPeek(state, action, ruleSet, rng);
    case 'DRAW_DECK':
      return drawDeck(state, action, ruleSet, rng);
    case 'DRAW_DISCARD':
      return drawDiscard(state, action, ruleSet, rng);
    case 'DISCARD_DRAWN':
      return discardDrawn(state, action, ruleSet, rng);
    case 'REPLACE_CARD':
      return replaceCard(state, action, ruleSet, rng);
    case 'RESOLVE_POWER_TARGET':
      return resolvePowerTarget(state, action, ruleSet, rng);
    case 'FLIP_ATTEMPT':
      return flipAttempt(state, action, ruleSet, rng);
    case 'GIVE_CARD':
      return giveCard(state, action, ruleSet, rng);
    case 'CALL_CAMBEO':
      return callCambeo(state, action, ruleSet, rng);
    default: {
      const _exhaustive: never = action;
      return reject(state, 'unknown', 'UNKNOWN', `Unknown action ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export function reduceWithSeed(
  state: GameState,
  action: Action,
  ruleSet: RuleSet,
): GameState {
  const rng = createRng(state.seed, state.rngState);
  return reduce(state, action, ruleSet, rng);
}
