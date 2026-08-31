import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { viewFor, knows } from '../index.js';
import { apply, P1, P2, P3, startStacked, startPlaying } from '../testkit.js';

describe('view', () => {
  it('a view never contains an identity the player does not know', () => {
    const state = startPlaying();
    const view = viewFor(state, P1, HOUSE_RULES);
    for (const playerId of view.seating) {
      for (const slot of view.players[playerId]!.hand) {
        if (slot.known) {
          expect(knows(state, P1, slot.id)).toBe(true);
        } else {
          expect('key' in slot && (slot as { key?: string }).key).toBeFalsy();
        }
      }
    }
  });

  it('a peeked opponent card shows only in the peekers view', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '8' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    const targetId = state.players[P2]!.hand[2]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 2 },
    });
    const v1 = viewFor(state, P1, HOUSE_RULES);
    const v3 = viewFor(state, P3, HOUSE_RULES);
    const slot1 = v1.players[P2]!.hand.find((s) => s.id === targetId)!;
    const slot3 = v3.players[P2]!.hand.find((s) => s.id === targetId)!;
    expect(slot1.known).toBe(true);
    expect(slot3.known).toBe(false);
  });

  it('deck is count-only and discard top is public', () => {
    const state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'K_RED' }, { key: 'Q_BLACK' }],
      discard: [{ key: 'K_BLACK' }],
    });
    const view = viewFor(state, P1, HOUSE_RULES);
    expect(view.deckCount).toBe(2);
    expect(view.discardTop?.key).toBe('K_BLACK');
    expect(view).not.toHaveProperty('deck');
  });

  it('SCORING/OVER reveals all hands', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }],
        p2: [{ key: '3' }, { key: '4' }],
        p3: [{ key: '5' }, { key: '6' }],
      },
      deck: [],
      discard: [{ key: '7' }],
    });
    state = { ...state, phase: 'OVER', cambeo: { callerId: P1 } };
    // Manually grant all knowledge as finishGame would
    const allIds = Object.values(state.players).flatMap((p) => p.hand);
    const knowledge = { ...state.knowledge };
    for (const pid of state.seating) {
      const map: Record<string, true> = {};
      for (const id of allIds) map[id] = true;
      knowledge[pid] = map;
    }
    state = { ...state, knowledge, phase: 'OVER' };
    const view = viewFor(state, P2, HOUSE_RULES);
    for (const pid of view.seating) {
      for (const slot of view.players[pid]!.hand) {
        expect(slot.known).toBe(true);
      }
    }
  });

  it('the view is a pure function of state plus player id', () => {
    const state = startPlaying(undefined, 'view-seed');
    const a = viewFor(state, P1, HOUSE_RULES);
    const b = viewFor(state, P1, HOUSE_RULES);
    expect(a).toEqual(b);
    const c = viewFor(state, P2, HOUSE_RULES);
    expect(c.viewerId).toBe(P2);
    expect(c).not.toEqual(a);
  });
});
