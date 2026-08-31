import { describe, expect, it } from 'vitest';
import { HOUSE_RULES, type RuleSet } from '@cambeo/shared';
import { computeScores, createRng, finishGame } from '../index.js';
import { P1, P2, P3, startStacked } from '../testkit.js';


describe('scoring', () => {
  it('totals come from RuleSet.values', () => {
    const state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: 'K_RED' }], // 1 + (-2) = -1
        p2: [{ key: '10' }, { key: 'J' }], // 10 + 10 = 20
        p3: [{ key: 'Q_RED' }, { key: 'HEAVEN' }], // -1 + (-4) = -5
      },
      deck: [{ key: '2' }],
      discard: [{ key: '3' }],
    });
    const totals = computeScores(state, HOUSE_RULES);
    expect(totals[P1]).toBe(1 + -2);
    expect(totals[P2]).toBe(10 + 10);
    expect(totals[P3]).toBe(-1 + -4);
  });

  it('[spec] a tie with the caller resolves for the non-caller', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: '5' }],
        p2: [{ key: '5' }],
        p3: [{ key: '10' }],
      },
      deck: [],
      discard: [{ key: '4' }],
    });
    state = {
      ...state,
      cambeo: { callerId: P1 },
      phase: 'SCORING',
    };
    const rng = createRng(state.seed, state.rngState);
    state = finishGame(state, HOUSE_RULES, rng, []);
    expect(state.result!.callerBeaten).toBe(true);
    expect(state.result!.winnerIds).toContain(P2);
    expect(state.result!.winnerIds).not.toContain(P1);
  });

  it('a strictly lower non-caller wins', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: '10' }],
        p2: [{ key: 'A' }],
        p3: [{ key: '5' }],
      },
      deck: [],
      discard: [{ key: '4' }],
    });
    state = { ...state, cambeo: { callerId: P1 }, phase: 'SCORING' };
    const rng = createRng(state.seed, state.rngState);
    state = finishGame(state, HOUSE_RULES, rng, []);
    expect(state.result!.callerBeaten).toBe(true);
    expect(state.result!.winnerIds).toEqual([P2]);
  });

  it('ties among non-callers yield multiple winners', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: '10' }],
        p2: [{ key: 'A' }],
        p3: [{ key: 'A' }],
      },
      deck: [],
      discard: [{ key: '4' }],
    });
    state = { ...state, cambeo: { callerId: P1 }, phase: 'SCORING' };
    const rng = createRng(state.seed, state.rngState);
    state = finishGame(state, HOUSE_RULES, rng, []);
    expect(state.result!.winnerIds.sort()).toEqual([P2, P3].sort());
  });

  it('negative hands score correctly', () => {
    const state = startStacked({
      hands: {
        p1: [{ key: 'K_RED' }, { key: 'Q_RED' }, { key: 'HEAVEN' }],
        p2: [{ key: '2' }],
        p3: [{ key: '3' }],
      },
      deck: [],
      discard: [{ key: '4' }],
    });
    const totals = computeScores(state, HOUSE_RULES);
    expect(totals[P1]).toBe(-2 + -1 + -4);
  });

  it('custom values change totals', () => {
    const rules: RuleSet = {
      ...HOUSE_RULES,
      values: { ...HOUSE_RULES.values, A: 100 },
    };
    const state = startStacked({
      hands: {
        p1: [{ key: 'A' }],
        p2: [{ key: '2' }],
        p3: [{ key: '3' }],
      },
      deck: [],
      discard: [{ key: '4' }],
      ruleSet: rules,
    });
    expect(computeScores(state, rules)[P1]).toBe(100);
  });

  });
