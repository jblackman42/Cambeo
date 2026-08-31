/**
 * Heaven / hell hooks.
 *
 * Special discard and flip-onto-heaven rules are implemented in `jokers.ts`
 * and enforced from turn / flip paths, driven by RuleSet flags:
 * `heavenDiscardableAfterCambeo`, `hellDiscardOnlyOntoHeaven`.
 *
 * This module remains for optional scoring / future overlays.
 */

import type { CardKey, RuleSet } from '@cambeo/shared';
import type { GameState } from '../state.js';
import type { Rng } from '../rng.js';

export interface SpecialCardHooks {
  onFlipAttempt(
    state: GameState,
    cardKey: CardKey,
    ruleSet: RuleSet,
    rng: Rng,
  ): GameState | null;

  onPowerResolve(
    state: GameState,
    cardKey: CardKey,
    ruleSet: RuleSet,
    rng: Rng,
  ): GameState | null;

  onScoreCard(cardKey: CardKey, baseValue: number, ruleSet: RuleSet): number | null;
}

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

export function setSpecialCardHooks(hooks: SpecialCardHooks): void {
  specialCardHooks = hooks;
}
