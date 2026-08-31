import { describe, expect, it } from 'vitest';
import {
  apply,
  hasEvent,
  P1,
  P2,
  P3,
  rejected,
  startStacked,
} from '../testkit.js';

describe('cambeo', () => {
  it('call before drawing ends the turn immediately', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'K_RED' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    expect(hasEvent(state, 'CAMBEO_CALLED')).toBe(true);
    expect(state.cambeo?.callerId).toBe(P1);
    expect(state.phase).toBe('FINAL_ROUND');
    expect(state.turn?.playerId).toBe(P2);
    expect(state.turn?.hasDrawn).toBe(false);
  });

  it('call after drawing is rejected', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'K_RED' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const next = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    expect(rejected(next)).toBe(true);
  });

  it('[spec] call during the final round is rejected', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'K_RED' }, { key: 'Q_BLACK' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    expect(state.phase).toBe('FINAL_ROUND');
    const next = apply(state, { type: 'CALL_CAMBEO', playerId: P2 });
    expect(rejected(next)).toBe(true);
  });

  it('[spec] the caller cards cannot be flipped, swapped or targeted', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '10' }, { key: '8' }],
      discard: [{ key: 'A' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    // Flip caller's card
    const flip = apply(state, {
      type: 'FLIP_ATTEMPT',
      playerId: P2,
      target: { playerId: P1, slotIndex: 0 },
    });
    expect(rejected(flip)).toBe(true);

    // P2 draws a 10 (blind swap) and tries to target caller
    state = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P2 });
    expect(state.pendingPower?.powerId).toBe('BLIND_SWAP');
    const swap = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P2,
      target: { kind: 'CARD', playerId: P1, slotIndex: 0 },
    });
    expect(rejected(swap)).toBe(true);
  });

  it('[spec] the caller own flips are rejected', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'A' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'K_RED' }],
      discard: [{ key: 'A' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    const next = apply(state, {
      type: 'FLIP_ATTEMPT',
      playerId: P1,
      target: { playerId: P2, slotIndex: 0 },
    });
    expect(rejected(next)).toBe(true);
  });

  it('every other player gets exactly one more turn then the game ends', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'K_RED' }, { key: 'Q_BLACK' }, { key: 'K_BLACK' }],
      discard: [{ key: '2' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    expect(state.turn?.playerId).toBe(P2);
    state = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P2 });
    expect(state.turn?.playerId).toBe(P3);
    state = apply(state, { type: 'DRAW_DECK', playerId: P3 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P3 });
    expect(state.phase).toBe('OVER');
    expect(state.result).not.toBeNull();
  });

  it('[spec] a player at zero cards keeps taking turns and can still call cambeo', () => {
    let state = startStacked({
      hands: {
        p1: [],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'K_RED' }],
      discard: [{ key: 'K_BLACK' }],
    });
    expect(state.players[P1]!.hand.length).toBe(0);
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    expect(hasEvent(state, 'CAMBEO_CALLED')).toBe(true);
    expect(state.cambeo?.callerId).toBe(P1);
  });
});
