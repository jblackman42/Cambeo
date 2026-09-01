import { describe, expect, it } from 'vitest';
import {
  dismissInitialPeeks,
  expireReveals,
  identitiesHeld,
  ingestReveals,
  type ActiveReveal,
} from './reveals';
import type { GameEvent } from '@cambeo/shared';

const peek = (overrides: Partial<GameEvent & { type: 'CARD_REVEALED' }> = {}): GameEvent => ({
  type: 'CARD_REVEALED',
  cardId: 'c1',
  ownerId: 'p1',
  slotIndex: 0,
  revealedToPlayerId: 'p1',
  kind: 'INITIAL_PEEK',
  durationMs: 8000,
  expiresAt: 10_000,
  key: 'A',
  suit: 'clubs',
  value: 1,
  ...overrides,
});

describe('ingestReveals', () => {
  it('stores identity until expiresAt then drops it', () => {
    const held = ingestReveals([], [peek()], 1000);
    expect(identitiesHeld(held, 'p1', 1000).has('c1')).toBe(true);
    const expired = expireReveals(held, 10_001);
    expect(identitiesHeld(expired, 'p1', 10_001).has('c1')).toBe(false);
    expect(expired).toHaveLength(0);
  });

  it('does not extend or reissue an existing reveal', () => {
    const first = ingestReveals([], [peek({ expiresAt: 5000 })], 0);
    const again = ingestReveals(first, [peek({ expiresAt: 20_000 })], 1000);
    expect(again).toHaveLength(1);
    expect(again[0]?.expiresAt).toBe(5000);
  });

  it('Got it dismisses the viewer’s initial peeks immediately', () => {
    const held = ingestReveals([], [peek(), peek({ cardId: 'c2', slotIndex: 1 })], 0);
    const gone = dismissInitialPeeks(held, 'p1');
    expect(gone).toHaveLength(0);
  });

  it('lift-only events have no identity to hold', () => {
    const event = peek();
    if (event.type !== 'CARD_REVEALED') return;
    delete event.key;
    delete event.suit;
    delete event.value;
    const held = ingestReveals([], [event], 0);
    expect(identitiesHeld(held, 'p1', 0).size).toBe(0);
    expect(held[0]?.key).toBeUndefined();
  });
});

describe('ActiveReveal', () => {
  it('is the client’s only memory of a face', () => {
    const row: ActiveReveal = {
      cardId: 'c9',
      ownerId: 'p2',
      slotIndex: 1,
      revealedToPlayerId: 'p1',
      kind: 'POWER',
      durationMs: 4000,
      expiresAt: 4000,
      key: '7',
      suit: 'hearts',
      value: 7,
    };
    expect(identitiesHeld([row], 'p1', 0).has('c9')).toBe(true);
    expect(identitiesHeld([row], 'p2', 0).size).toBe(0);
  });
});
