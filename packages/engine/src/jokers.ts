/**
 * Heaven / hell discard legality from docs/cambeo-rules.md.
 * Behavior is driven by RuleSet flags — never hardcode outside these helpers.
 */

import type { CardKey, RuleSet } from '@cambeo/shared';
import type { GameState } from './state.js';
import { getCard } from './setup.js';

/** True once cambeo has been called (final round or later). */
export function cambeoCalled(state: GameState): boolean {
  return state.cambeo !== null;
}

export function canPlaceOnDiscard(
  state: GameState,
  ruleSet: RuleSet,
  cardKey: CardKey,
): { ok: true } | { ok: false; reason: string } {
  if (cardKey === 'HELL' && ruleSet.hellDiscardOnlyOntoHeaven) {
    return {
      ok: false,
      reason: 'Hell can only be discarded by flipping onto heaven',
    };
  }
  if (
    cardKey === 'HEAVEN' &&
    !ruleSet.heavenDiscardableAfterCambeo &&
    cambeoCalled(state)
  ) {
    return {
      ok: false,
      reason: 'Heaven cannot be discarded after cambeo is called',
    };
  }
  return { ok: true };
}

/** Hell flip onto discard top: requires heaven when the flag is set. */
export function hellFlipOntoDiscardLegal(
  state: GameState,
  ruleSet: RuleSet,
  flippedKey: CardKey,
): { ok: true } | { ok: false; reason: string } {
  if (flippedKey !== 'HELL' || !ruleSet.hellDiscardOnlyOntoHeaven) {
    return { ok: true };
  }
  if (state.discard.length === 0) {
    return { ok: false, reason: 'No discard to flip hell onto' };
  }
  const top = getCard(state, state.discard[state.discard.length - 1]!);
  if (top.key !== 'HEAVEN') {
    // Rank may still match another joker; only heaven is a legal dump target.
    if (top.key === 'HELL') {
      return { ok: false, reason: 'Hell can only be discarded onto heaven' };
    }
    // Non-joker: let normal rank matching produce a wrong-flip failure.
    return { ok: true };
  }
  return { ok: true };
}

/**
 * Invariant: every hell on the discard pile must sit directly on heaven.
 * Hell reaching discard by any other route is a bug.
 */
export function assertHellDiscardInvariant(state: GameState, ruleSet: RuleSet): void {
  if (!ruleSet.hellDiscardOnlyOntoHeaven) return;
  for (let i = 0; i < state.discard.length; i++) {
    const id = state.discard[i]!;
    const card = state.cards[id];
    if (!card || card.key !== 'HELL') continue;
    if (i === 0) {
      throw new Error(
        'INVARIANT: hell on discard with no card beneath (must sit on heaven)',
      );
    }
    const beneath = state.cards[state.discard[i - 1]!]!;
    if (beneath.key !== 'HEAVEN') {
      throw new Error(
        `INVARIANT: hell on discard must sit on heaven (found ${beneath.key})`,
      );
    }
  }
}
