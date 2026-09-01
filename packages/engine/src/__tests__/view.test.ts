import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { viewFor, identitiesInView, assertViewIdentityInvariant, createGame } from '../index.js';
import { apply, P1, P2, P3, startStacked, startPlaying, DEFAULT_PLAYERS } from '../testkit.js';

describe('view', () => {
  it('a view never contains an identity the player does not know', () => {
    const state = startPlaying();
    const view = viewFor(state, P1, HOUSE_RULES);
    assertViewIdentityInvariant(view);
    for (const playerId of view.seating) {
      for (const slot of view.players[playerId]!.hand) {
        expect(slot.known).toBe(false);
        expect('key' in slot && (slot as { key?: string }).key).toBeFalsy();
      }
    }
  });

  it('a peeked opponent card is only in the peeker’s CARD_REVEALED event, never the slot', () => {
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
    expect(v1.players[P2]!.hand.find((s) => s.id === targetId)!.known).toBe(false);
    expect(v3.players[P2]!.hand.find((s) => s.id === targetId)!.known).toBe(false);
    const reveal1 = v1.lastEvents.find((e) => e.type === 'CARD_REVEALED');
    const reveal3 = v3.lastEvents.find((e) => e.type === 'CARD_REVEALED');
    expect(reveal1?.type).toBe('CARD_REVEALED');
    if (reveal1?.type === 'CARD_REVEALED') {
      expect(reveal1.key).toBe('7');
      expect(reveal1.revealedToPlayerId).toBe(P1);
      expect(reveal1.kind).toBe('POWER');
      expect(reveal1.durationMs).toBe(HOUSE_RULES.powerRevealDurationMs);
    }
    expect(reveal3?.type).toBe('CARD_REVEALED');
    if (reveal3?.type === 'CARD_REVEALED') {
      expect(reveal3.key).toBeUndefined();
      expect(reveal3.revealedToPlayerId).toBe(P1);
    }
    assertViewIdentityInvariant(v1);
    assertViewIdentityInvariant(v3);
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
    expect(identitiesInView(view).has(view.discardTop!.id)).toBe(true);
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
    const view = viewFor(state, P2, HOUSE_RULES);
    for (const pid of view.seating) {
      for (const slot of view.players[pid]!.hand) {
        expect(slot.known).toBe(true);
      }
    }
    assertViewIdentityInvariant(view);
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

  it('includes ackedPeek', () => {
    const state = startPlaying();
    const view = viewFor(state, P1, HOUSE_RULES);
    expect(view.ackedPeek).toEqual([P1, P2, P3]);
  });

  it('Jack look-and-swap peek does not leave the slot known after the look step', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'J' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(state.pendingPower?.powerId).toBe('LOOK_THEN_BLIND_SWAP');
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
    });
    const v1 = viewFor(state, P1, HOUSE_RULES);
    expect(v1.phase).toBe('POWER_TARGETING');
    expect(v1.pendingPower?.stepIndex).toBe(1);
    expect(v1.pendingPower?.selections).toEqual([{ kind: 'CARD', playerId: P2, slotIndex: 0 }]);
    expect(v1.players[P2]!.hand[0]!.known).toBe(false);
    const reveal = v1.lastEvents.find((e) => e.type === 'CARD_REVEALED');
    expect(reveal?.type).toBe('CARD_REVEALED');
    if (reveal?.type === 'CARD_REVEALED') expect(reveal.key).toBe('5');
  });

  it('engine invariant: identities are only unexpired reveals, drawn card, discard top, or scoring', () => {
    let state = createGame(DEFAULT_PLAYERS, 'inv-seed', HOUSE_RULES);
    state = apply(state, { type: 'START_GAME', playerId: P1 });
    for (const pid of DEFAULT_PLAYERS) {
      const view = viewFor(state, pid, HOUSE_RULES);
      assertViewIdentityInvariant(view);
      const ids = identitiesInView(view);
      const reveals = view.lastEvents.filter(
        (e) => e.type === 'CARD_REVEALED' && e.revealedToPlayerId === pid && e.key,
      );
      expect(ids.size).toBe(reveals.length);
    }

    state = apply(state, { type: 'ACK_PEEK', playerId: P1 });
    state = apply(state, { type: 'ACK_PEEK', playerId: P2 });
    state = apply(state, { type: 'ACK_PEEK', playerId: P3 });
    const afterAck = viewFor(state, P1, HOUSE_RULES);
    assertViewIdentityInvariant(afterAck);
    expect(afterAck.players[P1]!.hand.every((s) => !s.known)).toBe(true);
  });

  it('a later action’s view does not still carry the peeked identity in lastEvents', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '8' }, { key: 'A' }],
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
    expect(viewFor(state, P1, HOUSE_RULES).lastEvents.some((e) => e.type === 'CARD_REVEALED')).toBe(
      true,
    );
    state = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    const later = viewFor(state, P1, HOUSE_RULES);
    expect(later.lastEvents.some((e) => e.type === 'CARD_REVEALED')).toBe(false);
    expect(later.players[P2]!.hand.find((s) => s.id === targetId)!.known).toBe(false);
    assertViewIdentityInvariant(later);
  });

  it('holding a drawn card loses that identity once it is discarded or replaced', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '5' }, { key: '6' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const drawnId = state.drawnCard!;
    const drawnView = viewFor(state, P1, HOUSE_RULES);
    expect(drawnView.drawnCard?.id).toBe(drawnId);
    expect(identitiesInView(drawnView).has(drawnId)).toBe(true);

    const afterDiscard = viewFor(
      apply(state, { type: 'DISCARD_DRAWN', playerId: P1 }),
      P1,
      HOUSE_RULES,
    );
    expect(afterDiscard.drawnCard).toBeNull();
    expect(afterDiscard.discardTop?.id).toBe(drawnId);

    state = apply(state, { type: 'REPLACE_CARD', playerId: P1, slotIndex: 0 });
    const afterReplace = viewFor(state, P1, HOUSE_RULES);
    expect(afterReplace.drawnCard).toBeNull();
    expect(afterReplace.players[P1]!.hand.find((s) => s.id === drawnId)?.known).toBe(false);
    assertViewIdentityInvariant(afterReplace);
  });

  it('initial peek and power reveals use their separate configured durations', () => {
    const rules = {
      ...HOUSE_RULES,
      initialPeekDurationMs: 1111,
      powerRevealDurationMs: 2222,
    };
    let state = createGame(DEFAULT_PLAYERS, 'dur-seed', rules);
    state = apply(state, { type: 'START_GAME', playerId: P1 }, rules);
    const peek = viewFor(state, P1, rules).lastEvents.find((e) => e.type === 'CARD_REVEALED');
    expect(peek?.type).toBe('CARD_REVEALED');
    if (peek?.type === 'CARD_REVEALED') {
      expect(peek.kind).toBe('INITIAL_PEEK');
      expect(peek.durationMs).toBe(1111);
    }

    state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: '8' }],
      discard: [{ key: 'K_BLACK' }],
      ruleSet: rules,
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 }, rules);
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 }, rules);
    state = apply(
      state,
      {
        type: 'RESOLVE_POWER_TARGET',
        playerId: P1,
        target: { kind: 'CARD', playerId: P2, slotIndex: 2 },
      },
      rules,
    );
    const power = viewFor(state, P1, rules).lastEvents.find((e) => e.type === 'CARD_REVEALED');
    expect(power?.type).toBe('CARD_REVEALED');
    if (power?.type === 'CARD_REVEALED') {
      expect(power.kind).toBe('POWER');
      expect(power.durationMs).toBe(2222);
    }
  });
});
