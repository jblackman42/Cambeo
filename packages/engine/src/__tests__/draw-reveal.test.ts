import { describe, expect, it } from 'vitest';
import { HOUSE_RULES, type GameEvent } from '@cambeo/shared';
import { viewFor, assertViewIdentityInvariant } from '../index.js';
import { apply, P1, P2, startStacked, type StackedCard } from '../testkit.js';

function drawReveals(events: readonly GameEvent[]) {
  return events.filter(
    (e): e is Extract<GameEvent, { type: 'CARD_REVEALED' }> =>
      e.type === 'CARD_REVEALED' && e.kind === 'DRAW',
  );
}

function stacked(deck: StackedCard[]) {
  return startStacked({
    hands: {
      p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
      p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
    },
    deck,
    discard: [{ key: 'K_BLACK' }],
  });
}

describe('draw reveal', () => {
  it('a deck draw reveals the card to the drawer alone, on the configured clock', () => {
    let state = stacked([{ key: '9' }]);
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });

    const reveals = drawReveals(state.lastEvents);
    expect(reveals).toHaveLength(1);
    expect(reveals[0]!.revealedToPlayerId).toBe(P1);
    expect(reveals[0]!.cardId).toBe(state.drawnCard);
    expect(reveals[0]!.key).toBe('9');
    expect(reveals[0]!.durationMs).toBe(HOUSE_RULES.drawRevealDurationMs);
    // The card is in no one's hand, so it carries the not-in-a-hand sentinel.
    expect(reveals[0]!.slotIndex).toBe(-1);

    const opponent = viewFor(state, P2, HOUSE_RULES);
    expect(drawReveals(opponent.lastEvents)[0]!.key).toBeUndefined();
  });

  it('a discard draw is revealed the same way', () => {
    let state = stacked([{ key: '9' }]);
    state = apply(state, { type: 'DRAW_DISCARD', playerId: P1 });

    const reveals = drawReveals(state.lastEvents);
    expect(reveals).toHaveLength(1);
    expect(reveals[0]!.revealedToPlayerId).toBe(P1);
    expect(reveals[0]!.key).toBe('K_BLACK');
  });

  it('the held card is projected without its face, for the holder too', () => {
    let state = stacked([{ key: '9' }]);
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });

    const held = viewFor(state, P1, HOUSE_RULES);
    expect(held.drawnCard?.id).toBe(state.drawnCard);
    expect(held.drawnCard && 'key' in held.drawnCard).toBe(false);
    assertViewIdentityInvariant(held);
  });

  it('the invariant rejects a view that smuggles the face back onto drawnCard', () => {
    let state = stacked([{ key: '9' }]);
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const view = viewFor(state, P1, HOUSE_RULES);

    const leaky = {
      ...view,
      drawnCard: { id: view.drawnCard!.id, key: '9', suit: 'hearts', value: 9 },
    } as unknown as ReturnType<typeof viewFor>;
    expect(() => assertViewIdentityInvariant(leaky)).toThrow(/drawnCard/u);
  });

  it('drawnOptions answers what the expired face no longer can', () => {
    let state = stacked([{ key: '9' }]);
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const normal = viewFor(state, P1, HOUSE_RULES).drawnOptions;
    expect(normal).toEqual({
      canDiscard: true,
      canReplace: true,
      canKeep: true,
      fromDiscard: false,
    });

    // Hell cannot be discarded under House Rules, so the client must be told without being
    // told which card it is holding.
    let hellState = stacked([{ key: 'HELL' }]);
    hellState = apply(hellState, { type: 'DRAW_DECK', playerId: P1 });
    const hell = viewFor(hellState, P1, HOUSE_RULES).drawnOptions;
    expect(hell?.canDiscard).toBe(false);
    expect(hell?.canReplace).toBe(true);
    expect(hell?.canKeep).toBe(true);

    const fromPile = viewFor(
      apply(stacked([{ key: '9' }]), { type: 'DRAW_DISCARD', playerId: P1 }),
      P1,
      HOUSE_RULES,
    ).drawnOptions;
    expect(fromPile?.fromDiscard).toBe(true);
  });

  it('a hand of nothing but undiscardable cards leaves no replace target', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'HELL' }, { key: 'HELL' }, { key: 'HELL' }, { key: 'HELL' }],
        p2: [{ key: '5' }, { key: '6' }, { key: '7' }, { key: '8' }],
        p3: [{ key: '9' }, { key: '10' }, { key: 'J' }, { key: 'Q_RED' }],
      },
      deck: [{ key: 'HELL' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    const options = viewFor(state, P1, HOUSE_RULES).drawnOptions;
    expect(options?.canDiscard).toBe(false);
    expect(options?.canReplace).toBe(false);
    expect(options?.canKeep).toBe(true);
  });

  it('the identity is gone from the view once the card leaves the hand-held slot', () => {
    let state = stacked([{ key: '9' }]);
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'KEEP_DRAWN', playerId: P1 });

    const after = viewFor(state, P1, HOUSE_RULES);
    expect(after.drawnCard).toBeNull();
    expect(after.drawnOptions).toBeNull();
    expect(drawReveals(after.lastEvents)).toHaveLength(0);
    assertViewIdentityInvariant(after);
  });
});
