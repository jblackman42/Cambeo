import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { viewFor } from '../index.js';
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

  it('replace does not leave the new card known in the slot', () => {
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
    expect(viewFor(state, P1, HOUSE_RULES).drawnCard?.id).toBe(newId);
    state = apply(state, { type: 'REPLACE_CARD', playerId: P1, slotIndex: 3 });
    const view = viewFor(state, P1, HOUSE_RULES);
    expect(view.drawnCard).toBeNull();
    expect(view.players[P1]!.hand.find((s) => s.id === newId)?.known).toBe(false);
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

  it('keep adds the drawn card without touching discard or firing a power', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'Q_RED' }, { key: 'K_RED' }, { key: 'Q_RED' }, { key: 'K_RED' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: 'K_RED' }],
      discard: [{ key: 'K_BLACK' }],
    });
    const discardBefore = [...state.discard];
    const handBefore = state.players[P1]!.hand.length;
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const keptId = state.drawnCard!;
    state = apply(state, { type: 'KEEP_DRAWN', playerId: P1 });
    expect(rejected(state)).toBe(false);
    expect(state.drawnCard).toBeNull();
    expect(state.discard).toEqual(discardBefore);
    expect(state.players[P1]!.hand).toHaveLength(handBefore + 1);
    expect(state.players[P1]!.hand).toContain(keptId);
    expect(state.pendingPower).toBeNull();
    expect(hasEvent(state, 'CARD_KEPT')).toBe(true);
    expect(viewFor(state, P1, HOUSE_RULES).drawnCard).toBeNull();
    expect(viewFor(state, P1, HOUSE_RULES).players[P1]!.hand.find((s) => s.id === keptId)?.known).toBe(
      false,
    );
    expect(state.turn?.playerId).toBe(P2);
  });

  it('keep of a power card does not start POWER_TARGETING', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '6' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'KEEP_DRAWN', playerId: P1 });
    expect(state.phase).toBe('TURN_DRAW');
    expect(state.pendingPower).toBeNull();
    expect(hasEvent(state, 'POWER_STARTED')).toBe(false);
  });

  it('keep works with an empty hand (late-game draw for a negative)', () => {
    let state = startStacked({
      hands: {
        p1: [],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: 'Q_RED' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const keptId = state.drawnCard!;
    state = apply(state, { type: 'KEEP_DRAWN', playerId: P1 });
    expect(rejected(state)).toBe(false);
    expect(state.players[P1]!.hand).toEqual([keptId]);
  });

  it('keep from the discard pile is legal and does not fire a power', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '5' }],
      discard: [{ key: '6' }],
    });
    const top = state.discard[state.discard.length - 1]!;
    state = apply(state, { type: 'DRAW_DISCARD', playerId: P1 });
    state = apply(state, { type: 'KEEP_DRAWN', playerId: P1 });
    expect(rejected(state)).toBe(false);
    expect(state.players[P1]!.hand).toContain(top);
    expect(state.pendingPower).toBeNull();
    expect(state.discard).not.toContain(top);
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
    const next3 = apply(state, { type: 'KEEP_DRAWN', playerId: P1 });
    expect(rejected(next3)).toBe(true);
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
