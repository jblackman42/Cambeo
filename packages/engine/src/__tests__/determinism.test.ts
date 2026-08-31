import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { createGame, createRng, reduce } from '../index.js';
import { apply, applyAll, DEFAULT_PLAYERS, P1, P2, P3, startPlaying } from '../testkit.js';
import type { Action } from '../index.js';

describe('determinism', () => {
  it('same seed plus same action list yields identical state', () => {
    const actions: Action[] = [
      { type: 'START_GAME', playerId: P1 },
      { type: 'ACK_PEEK', playerId: P1 },
      { type: 'ACK_PEEK', playerId: P2 },
      { type: 'ACK_PEEK', playerId: P3 },
      { type: 'DRAW_DECK', playerId: P1 },
      { type: 'DISCARD_DRAWN', playerId: P1 },
    ];

    const run = (seed: string) => {
      let state = createGame(DEFAULT_PLAYERS, seed, HOUSE_RULES);
      state = applyAll(state, actions);
      return state;
    };

    const a = run('det-seed');
    const b = run('det-seed');
    expect(a.players).toEqual(b.players);
    expect(a.deck).toEqual(b.deck);
    expect(a.discard).toEqual(b.discard);
    expect(a.rngState).toBe(b.rngState);
    expect(a.phase).toBe(b.phase);
  });

  it('rngState round-trips for resume', () => {
    let state = startPlaying(DEFAULT_PLAYERS, 'resume-seed');
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const cursor = state.rngState;

    const rng = createRng(state.seed, cursor);
    const resumed = reduce(
      { ...state, lastEvents: [] },
      { type: 'DISCARD_DRAWN', playerId: P1 },
      HOUSE_RULES,
      rng,
    );

    const rng2 = createRng(state.seed, cursor);
    const fresh = reduce(state, { type: 'DISCARD_DRAWN', playerId: P1 }, HOUSE_RULES, rng2);

    expect(resumed.deck).toEqual(fresh.deck);
    expect(resumed.discard).toEqual(fresh.discard);
    expect(resumed.phase).toBe(fresh.phase);
    expect(resumed.rngState).toBe(fresh.rngState);
  });
});
