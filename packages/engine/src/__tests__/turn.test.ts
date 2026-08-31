import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { knows } from '../index.js';
import {
  apply,
  findSlot,
  hasEvent,
  P1,
  P2,
  rejected,
  startStacked,
} from '../testkit.js';

describe('turn', () => {
  it('deck draw then discard triggers the card power', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '6' }, { key: '5' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    expect(state.phase).toBe('TURN_CHOICE');
    expect(state.drawnCard).toBeTruthy();
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(state.phase).toBe('POWER_TARGETING');
    expect(state.pendingPower?.powerId).toBe('PEEK_OWN');
    expect(hasEvent(state, 'POWER_STARTED')).toBe(true);
  });

  it('discard-pile draw then discard never triggers a power', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '5' }],
      discard: [{ key: '6' }],
    });
    state = apply(state, { type: 'DRAW_DISCARD', playerId: P1 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(state.phase).not.toBe('POWER_TARGETING');
    expect(state.pendingPower).toBeNull();
    // Turn advanced to P2
    expect(state.turn?.playerId).toBe(P2);
  });

  it('replace puts the old card face up and triggers nothing', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '5' }],
      discard: [{ key: 'K_BLACK' }],
    });
    const oldId = state.players[P1]!.hand[0]!;
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const newId = state.drawnCard!;
    state = apply(state, { type: 'REPLACE_CARD', playerId: P1, slotIndex: 0 });
    expect(state.pendingPower).toBeNull();
    expect(state.discard[state.discard.length - 1]).toBe(oldId);
    expect(state.players[P1]!.hand[0]).toBe(newId);
    expect(hasEvent(state, 'CARD_REPLACED')).toBe(true);
  });

  it('replace updates the owner knowledge of the new card', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '5' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const newId = state.drawnCard!;
    state = apply(state, { type: 'REPLACE_CARD', playerId: P1, slotIndex: 3 });
    expect(knows(state, P1, newId)).toBe(true);
  });

  it('out-of-turn draw is rejected', () => {
    const state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '5' }],
      discard: [{ key: 'K_BLACK' }],
    });
    const next = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    expect(rejected(next)).toBe(true);
  });

  it('acting before drawing is rejected', () => {
    const state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '5' }],
      discard: [{ key: 'K_BLACK' }],
    });
    const next = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(rejected(next)).toBe(true);
    const next2 = apply(state, { type: 'REPLACE_CARD', playerId: P1, slotIndex: 0 });
    expect(rejected(next2)).toBe(true);
  });

  it('discard of NONE power advances turn without POWER_TARGETING', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '5' }],
      discard: [{ key: 'K_BLACK' }],
    });
    expect(HOUSE_RULES.powers['5']).toBe('NONE');
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(state.phase).toBe('TURN_DRAW');
    expect(state.turn?.playerId).toBe(P2);
  });

  void findSlot;
});
