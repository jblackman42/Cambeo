/**
 * EXTENSION POINT (spec 11.1)
 *
 * Heaven and hell have additional special rules that are not yet documented
 * in docs/cambeo-rules.md. Do not invent behavior here.
 *
 * Call sites in flip / power / scoring paths invoke these hooks so that
 * when the rules are written, behavior can be plugged in without reshaping
 * the engine.
 */

import type { CardKey } from '@cambeo/shared';
import type { GameState } from '../state.js';
import type { Rng } from '../rng.js';
import type { RuleSet } from '@cambeo/shared';

export interface SpecialCardHooks {
  /** Called when a heaven/hell card is involved in a flip attempt. */
  onFlipAttempt(
    state: GameState,
    cardKey: CardKey,
    ruleSet: RuleSet,
    rng: Rng,
  ): GameState | null;

  /** Called when a heaven/hell card's power would resolve (currently NONE). */
  onPowerResolve(
    state: GameState,
    cardKey: CardKey,
    ruleSet: RuleSet,
    rng: Rng,
  ): GameState | null;

  /** Called during scoring for heaven/hell cards. Return adjusted score delta or null. */
  onScoreCard(cardKey: CardKey, baseValue: number, ruleSet: RuleSet): number | null;
}

/** No-op implementations until special rules are documented. */
export const noopSpecialCardHooks: SpecialCardHooks = {
  onFlipAttempt() {
    return null;
  },
  onPowerResolve() {
    return null;
  },
  onScoreCard() {
    return null;
  },
};

export let specialCardHooks: SpecialCardHooks = noopSpecialCardHooks;

/** Test / future override. Production always uses noop until rules land. */
export function setSpecialCardHooks(hooks: SpecialCardHooks): void {
  specialCardHooks = hooks;
}
