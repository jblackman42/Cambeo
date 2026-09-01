import { describe, expect, it } from 'vitest';
import { viewFor } from '../index.js';
import { HOUSE_RULES } from '@cambeo/shared';
import {
  apply,
  hasEvent,
  P1,
  P2,
  P3,
  rejected,
  startStacked,
} from '../testkit.js';

describe('deck', () => {
  it('[spec] deck runs out mid-draw and the discard is reshuffled in', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [],
      discard: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: 'K_BLACK' }],
    });
    const topBefore = state.discard[state.discard.length - 1]!;
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    expect(rejected(state)).toBe(false);
    expect(hasEvent(state, 'DECK_RESHUFFLED')).toBe(true);
    expect(state.discard).toEqual([topBefore]);
    expect(state.drawnCard).toBeTruthy();
    expect(state.deck.length).toBe(2); // 5,6,7 shuffled minus the drawn one = 2 left... wait 3 rest, draw 1 = 2
  });

  it('reshuffle preserves the discard top so flip matching is unaffected', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'Q_RED' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [],
      discard: [{ key: '5' }, { key: '6' }, { key: 'Q_BLACK' }],
    });
    const topKey = state.cards[state.discard[state.discard.length - 1]!]!.key;
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    expect(state.cards[state.discard[0]!]!.key).toBe(topKey);
    // Still can flip Q_RED onto Q_BLACK top
    state = apply(state, {
      type: 'FLIP_ATTEMPT',
      playerId: P2,
      target: { playerId: P1, slotIndex: 0 },
    });
    // P1 is mid TURN_CHOICE with drawn card — flip should still work
    expect(hasEvent(state, 'FLIP_SUCCESS')).toBe(true);
  });

  it('reshuffle does not leak buried discard identities into the view', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [],
      discard: [{ key: '5' }, { key: '6' }, { key: 'K_BLACK' }],
    });
    const buried = state.discard[0]!;
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const view = viewFor(state, P1, HOUSE_RULES);
    expect(view.drawnCard).not.toBeNull();
    expect(view.players[P1]!.hand.find((s) => s.id === buried)).toBeUndefined();
    expect(view.discardTop?.id).not.toBe(buried);
  });

  it('[spec] deck out with an empty discard, draw rejected, state unchanged', () => {
    const state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [],
      discard: [],
    });
    const next = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    expect(rejected(next)).toBe(true);
    expect(next.phase).toBe(state.phase);
    expect(next.deck).toEqual(state.deck);
  });

  it('[spec] deck out with a single-card discard, draw rejected', () => {
    const state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [],
      discard: [{ key: 'K_BLACK' }],
    });
    const next = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    expect(rejected(next)).toBe(true);
  });

  it('penalty draw with nothing available is skipped and the flip still resolves', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [],
      discard: [{ key: 'K_BLACK' }],
    });
    const handBefore = state.players[P2]!.hand.length;
    state = apply(state, {
      type: 'FLIP_ATTEMPT',
      playerId: P2,
      target: { playerId: P1, slotIndex: 0 },
    });
    expect(hasEvent(state, 'FLIP_FAIL')).toBe(true);
    expect(hasEvent(state, 'PENALTY_SKIPPED')).toBe(true);
    expect(state.players[P2]!.hand.length).toBe(handBefore);
  });

  void P3;
});
