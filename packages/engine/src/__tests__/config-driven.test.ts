import { describe, expect, it } from 'vitest';
import { createGame, computeScores } from '../index.js';
import {
  apply,
  invertHouseRules,
  P1,
  P2,
  P3,
  rejected,
  startPlaying,
  startStacked,
} from '../testkit.js';
import { HOUSE_RULES, type RuleSet } from '@cambeo/shared';

describe('config-driven', () => {
  it('inverted values score inverted', () => {
    const rules = invertHouseRules();
    const state = startStacked({
      hands: {
        p1: [{ key: 'HEAVEN' }],
        p2: [{ key: 'HELL' }],
        p3: [{ key: 'A' }],
        p4: [{ key: '2' }],
      },
      deck: [],
      discard: [{ key: '3' }],
      players: [P1, P2, P3, 'p4'],
      ruleSet: rules,
    });
    const totals = computeScores(state, rules);
    expect(totals[P1]).toBe(4);
    expect(totals[P2]).toBe(-15);
  });

  it('reassigned powers fire on the reassigned keys', () => {
    const rules = invertHouseRules();
    let state = startStacked({
      hands: {
        p1: [{ key: '2' }, { key: '3' }, { key: '4' }, { key: '5' }, { key: '7' }, { key: '8' }],
        p2: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }, { key: 'K_RED' }, { key: 'Q_BLACK' }],
        p3: [{ key: 'K_BLACK' }, { key: '2' }, { key: '3' }, { key: '4' }, { key: '5' }, { key: '7' }],
        p4: [{ key: '8' }, { key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }, { key: 'K_RED' }],
      },
      deck: [{ key: 'A' }],
      discard: [{ key: 'K_BLACK' }],
      players: [P1, P2, P3, 'p4'],
      ruleSet: rules,
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 }, rules);
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 }, rules);
    expect(state.pendingPower?.powerId).toBe('PEEK_OWN');
  });

  it('all-NONE powers never enter POWER_TARGETING', () => {
    const rules: RuleSet = {
      ...HOUSE_RULES,
      powers: Object.fromEntries(
        Object.keys(HOUSE_RULES.powers).map((k) => [k, 'NONE']),
      ) as RuleSet['powers'],
    };
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '6' }],
      discard: [{ key: 'K_BLACK' }],
      ruleSet: rules,
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 }, rules);
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 }, rules);
    expect(state.phase).toBe('TURN_DRAW');
    expect(state.pendingPower).toBeNull();
  });

  it('handSize 6 with lossThreshold 8 behaves accordingly', () => {
    const rules = invertHouseRules();
    const state = startPlaying([P1, P2, P3, 'p4'], 'cfg', rules);
    expect(state.players[P1]!.hand).toHaveLength(6);
    expect(rules.lossThreshold).toBe(8);
  });

  it('minPlayers 4 rejects a 3-player start', () => {
    const rules = invertHouseRules();
    let state = createGame([P1, P2, P3], 'seed', rules);
    state = apply(state, { type: 'START_GAME', playerId: P1 }, rules);
    expect(rejected(state)).toBe(true);
  });
});
