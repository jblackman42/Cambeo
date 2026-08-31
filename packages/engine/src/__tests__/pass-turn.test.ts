import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { apply, hasEvent, P1, P2, P3, rejected, startPlaying, startStacked } from '../testkit.js';

describe('PASS_TURN', () => {
  it('on TURN_DRAW advances to the next player', () => {
    let state = startPlaying();
    expect(state.turn?.playerId).toBe(P1);
    state = apply(state, { type: 'PASS_TURN', playerId: P1 });
    expect(rejected(state)).toBe(false);
    expect(hasEvent(state, 'TURN_PASSED')).toBe(true);
    expect(state.turn?.playerId).toBe(P2);
    expect(state.phase).toBe('TURN_DRAW');
    expect(state.turn?.hasDrawn).toBe(false);
  });

  it('in FINAL_ROUND advances remaining / scores if last', () => {
    let state = startPlaying();
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    expect(state.phase).toBe('FINAL_ROUND');
    expect(state.turn?.playerId).toBe(P2);

    state = apply(state, { type: 'PASS_TURN', playerId: P2 });
    expect(rejected(state)).toBe(false);
    expect(state.turn?.playerId).toBe(P3);

    state = apply(state, { type: 'PASS_TURN', playerId: P3 });
    expect(rejected(state)).toBe(false);
    expect(state.phase).toBe('OVER');
    expect(state.result).not.toBeNull();
  });

  it('rejected when not your turn', () => {
    const state = startPlaying();
    const next = apply(state, { type: 'PASS_TURN', playerId: P2 });
    expect(rejected(next)).toBe(true);
    expect(next.turn?.playerId).toBe(P1);
  });

  it('rejected after draw', () => {
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
    expect(state.phase).toBe('TURN_CHOICE');
    const next = apply(state, { type: 'PASS_TURN', playerId: P1 });
    expect(rejected(next)).toBe(true);
    expect(next.phase).toBe('TURN_CHOICE');
  });

  it('rejected during POWER_TARGETING and GIVE_CARD_PENDING', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '6' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(state.phase).toBe('POWER_TARGETING');
    expect(rejected(apply(state, { type: 'PASS_TURN', playerId: P1 }))).toBe(true);

    state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '10' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p3: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      },
      deck: [{ key: '5' }],
      discard: [{ key: '10' }],
    });
    state = apply(state, {
      type: 'FLIP_ATTEMPT',
      playerId: P1,
      target: { playerId: P2, slotIndex: 0 },
    });
    expect(state.phase).toBe('GIVE_CARD_PENDING');
    expect(rejected(apply(state, { type: 'PASS_TURN', playerId: P1 }))).toBe(true);
  });
});

void HOUSE_RULES;
