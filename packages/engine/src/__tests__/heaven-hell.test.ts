import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { assertHellDiscardInvariant } from '../index.js';
import {
  apply,
  findSlot,
  hasEvent,
  P1,
  P2,
  P3,
  rejected,
  startStacked,
} from '../testkit.js';

describe('heaven and hell', () => {
  it('drawing hell from the deck offers replace only; DISCARD_DRAWN is rejected', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'HELL' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    expect(state.cards[state.drawnCard!]!.key).toBe('HELL');
    const discardAttempt = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(rejected(discardAttempt)).toBe(true);
    state = apply(state, { type: 'REPLACE_CARD', playerId: P1, slotIndex: 0 });
    expect(rejected(state)).toBe(false);
    expect(state.players[P1]!.hand.some((id) => state.cards[id]!.key === 'HELL')).toBe(true);
  });

  it('drawing hell from the discard pile is impossible via discard-to-pile', () => {
    // Hell cannot be discarded onto the pile, so it never becomes a normal discard-top
    // for DRAW_DISCARD except after a flip onto heaven (tested separately).
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'HELL' }, { key: '2' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(rejected(state)).toBe(true);
    expect(state.discard.every((id) => state.cards[id]!.key !== 'HELL')).toBe(true);
  });

  it('flipping hell onto a discarded heaven succeeds', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'HELL' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '2' }],
      discard: [{ key: 'HEAVEN' }],
    });
    state = apply(state, {
      type: 'FLIP_ATTEMPT',
      playerId: P2,
      target: { playerId: P2, slotIndex: 0 },
    });
    expect(hasEvent(state, 'FLIP_SUCCESS')).toBe(true);
    expect(state.cards[state.discard[state.discard.length - 1]!]!.key).toBe('HELL');
    expect(state.cards[state.discard[state.discard.length - 2]!]!.key).toBe('HEAVEN');
    expect(() => assertHellDiscardInvariant(state, HOUSE_RULES)).not.toThrow();
  });

  it('flipping hell onto any non-joker top discard fails and takes the wrong-flip penalty', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'HELL' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'K_RED' }],
      discard: [{ key: '5' }],
    });
    const before = state.players[P2]!.hand.length;
    state = apply(state, {
      type: 'FLIP_ATTEMPT',
      playerId: P2,
      target: { playerId: P2, slotIndex: 0 },
    });
    expect(hasEvent(state, 'FLIP_FAIL')).toBe(true);
    expect(hasEvent(state, 'PENALTY_DRAWN')).toBe(true);
    expect(state.players[P2]!.hand.length).toBe(before + 1);
  });

  it('heaven is discardable before cambeo is called', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'HEAVEN' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(rejected(state)).toBe(false);
    expect(state.cards[state.discard[state.discard.length - 1]!]!.key).toBe('HEAVEN');
  });

  it('heaven is not discardable after cambeo is called, by discard or by replacement', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'HEAVEN' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'HEAVEN' }, { key: '5' }, { key: 'K_RED' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    expect(state.phase).toBe('FINAL_ROUND');
    expect(state.turn?.playerId).toBe(P2);

    // Draw heaven — cannot discard
    state = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    expect(state.cards[state.drawnCard!]!.key).toBe('HEAVEN');
    expect(rejected(apply(state, { type: 'DISCARD_DRAWN', playerId: P2 }))).toBe(true);

    // Cannot replace away the heaven already in hand onto discard
    // (replace out slot 0 HEAVEN)
    // First keep the drawn heaven, then try replace on next turn... 
    // During this turn: REPLACE of a non-heaven slot puts that card on discard — OK.
    // REPLACE of heaven slot puts heaven on discard — illegal.
    const heavenSlot = findSlot(state, P2, 'HEAVEN');
    expect(heavenSlot).toBe(0);
    expect(
      rejected(apply(state, { type: 'REPLACE_CARD', playerId: P2, slotIndex: heavenSlot })),
    ).toBe(true);

    // KEEP_DRAWN ends the turn holding heaven
    state = apply(state, { type: 'KEEP_DRAWN', playerId: P2 });
    expect(rejected(state)).toBe(false);
    expect(state.players[P2]!.hand.filter((id) => state.cards[id]!.key === 'HEAVEN').length).toBe(
      2,
    );
  });

  it('a 10 or J swap moves heaven during the final round and is legal', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: 'HEAVEN' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '10' }, { key: 'K_RED' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    // P2 draws 10, discards for blind swap, swaps P3 heaven with own card
    state = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P2 });
    expect(state.pendingPower?.powerId).toBe('BLIND_SWAP');
    const heavenBefore = state.players[P3]!.hand[0]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P2,
      target: { kind: 'CARD', playerId: P3, slotIndex: 0 },
    });
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P2,
      target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
    });
    expect(hasEvent(state, 'POWER_SWAP')).toBe(true);
    expect(state.players[P2]!.hand).toContain(heavenBefore);
    expect(state.phase).toBe('FINAL_ROUND');
  });

  it('a 10 or J swap moves hell and is legal', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'HELL' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '10' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    const hellId = state.players[P2]!.hand[0]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
    });
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P1, slotIndex: 0 },
    });
    expect(hasEvent(state, 'POWER_SWAP')).toBe(true);
    expect(state.players[P1]!.hand).toContain(hellId);
  });

  it('engine invariant: hell never appears on the discard pile except on heaven', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'HELL' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '2' }],
      discard: [{ key: 'HEAVEN' }],
    });
    state = apply(state, {
      type: 'FLIP_ATTEMPT',
      playerId: P2,
      target: { playerId: P2, slotIndex: 0 },
    });
    expect(() => assertHellDiscardInvariant(state, HOUSE_RULES)).not.toThrow();

    // Manually corrupt: hell alone on discard must throw
    const hellId = state.discard[state.discard.length - 1]!;
    const broken = { ...state, discard: [hellId] };
    expect(() => assertHellDiscardInvariant(broken, HOUSE_RULES)).toThrow(/INVARIANT/);
  });
});
