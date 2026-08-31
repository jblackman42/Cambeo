import { describe, expect, it } from 'vitest';
import { HOUSE_RULES, validateForTable, deckSize } from '@cambeo/shared';
import { createGame, knows } from '../index.js';
import {
  apply,
  DEFAULT_PLAYERS,
  P1,
  P2,
  P3,
  rejected,
  startPlaying,
} from '../testkit.js';

describe('setup', () => {
  it('deals handSize cards per player from config', () => {
    const state = startPlaying();
    for (const p of DEFAULT_PLAYERS) {
      expect(state.players[p]!.hand).toHaveLength(HOUSE_RULES.handSize);
    }
  });

  it('reveals exactly initialRevealCount slots to the owner and no one else', () => {
    const state = startPlaying();
    for (const owner of DEFAULT_PLAYERS) {
      const hand = state.players[owner]!.hand;
      const revealed = hand.slice(0, HOUSE_RULES.initialRevealCount);
      const hidden = hand.slice(HOUSE_RULES.initialRevealCount);

      for (const cardId of revealed) {
        expect(knows(state, owner, cardId)).toBe(true);
      }
      for (const cardId of hidden) {
        expect(knows(state, owner, cardId)).toBe(false);
      }
      for (const other of DEFAULT_PLAYERS.filter((p) => p !== owner)) {
        for (const cardId of hand) {
          expect(knows(state, other, cardId)).toBe(false);
        }
      }
    }
  });

  it('rejects start below ruleSet.minPlayers', () => {
    let state = createGame([P1, P2], 'seed', HOUSE_RULES);
    state = apply(state, { type: 'START_GAME', playerId: P1 });
    expect(rejected(state)).toBe(true);
    expect(state.phase).toBe('LOBBY');
  });

  it('rejects when handSize * playerCount + 1 > deckSize', () => {
    const cramped = {
      ...HOUSE_RULES,
      handSize: 6,
      lossThreshold: 6,
      jokers: false,
      maxPlayers: 10,
      minPlayers: 3,
    };
    // 6 * 9 + 1 = 55 > 52
    expect(validateForTable(cramped, 9).ok).toBe(false);

    const players = Array.from({ length: 9 }, (_, i) => `p${i}`);
    let state = createGame(players, 'seed', cramped);
    state = apply(state, { type: 'START_GAME', playerId: players[0]! }, cramped);
    expect(rejected(state)).toBe(true);
  });

  it('same seed deals identically; different seed differs', () => {
    const a = startPlaying(DEFAULT_PLAYERS, 'same');
    const b = startPlaying(DEFAULT_PLAYERS, 'same');
    const c = startPlaying(DEFAULT_PLAYERS, 'other');
    expect(a.players[P1]!.hand.map((id) => a.cards[id]!.key)).toEqual(
      b.players[P1]!.hand.map((id) => b.cards[id]!.key),
    );
    expect(a.players[P1]!.hand.map((id) => a.cards[id]!.key)).not.toEqual(
      c.players[P1]!.hand.map((id) => c.cards[id]!.key),
    );
  });

  it('play does not begin until every player acks', () => {
    let state = createGame(DEFAULT_PLAYERS, 'seed', HOUSE_RULES);
    state = apply(state, { type: 'START_GAME', playerId: P1 });
    expect(state.phase).toBe('INITIAL_PEEK');
    state = apply(state, { type: 'ACK_PEEK', playerId: P1 });
    expect(state.phase).toBe('INITIAL_PEEK');
    state = apply(state, { type: 'ACK_PEEK', playerId: P2 });
    expect(state.phase).toBe('INITIAL_PEEK');
    state = apply(state, { type: 'ACK_PEEK', playerId: P3 });
    expect(state.phase).toBe('TURN_DRAW');
    expect(state.turn?.playerId).toBe(P1);
  });

  it('House Rules deck size is 54 with jokers', () => {
    expect(deckSize(HOUSE_RULES)).toBe(54);
  });
});
