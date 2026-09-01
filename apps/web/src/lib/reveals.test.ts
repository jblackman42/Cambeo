import { describe, expect, it } from 'vitest';
import {
  dismissInitialPeeks,
  expireReveals,
  ingestReveals,
  nextExpiryAt,
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
  revealId: 'r1',
  expiresAt: 10_000,
  key: 'A',
  suit: 'clubs',
  value: 1,
  ...overrides,
});

/** The client's whole memory of a face is the unexpired rows carrying a key. */
function facesHeld(reveals: ActiveReveal[], viewerId: string, now: number): string[] {
  return reveals
    .filter((row) => row.revealedToPlayerId === viewerId && row.expiresAt > now && row.key)
    .map((row) => row.cardId);
}

describe('ingestReveals', () => {
  it('stores identity until expiresAt then drops it', () => {
    const held = ingestReveals([], [peek()], 1000);
    expect(facesHeld(held, 'p1', 1000)).toContain('c1');
    const expired = expireReveals(held, 10_001);
    expect(facesHeld(expired, 'p1', 10_001)).toHaveLength(0);
    expect(expired).toHaveLength(0);
  });

  it('a replayed reveal does not extend or reissue the live one', () => {
    const first = ingestReveals([], [peek({ expiresAt: 5000 })], 0);
    const again = ingestReveals(first, [peek({ expiresAt: 20_000 })], 1000);
    expect(again).toHaveLength(1);
    expect(again[0]?.expiresAt).toBe(5000);
  });

  it('a genuinely new look at the same card starts its own timer', () => {
    const first = ingestReveals([], [peek({ revealId: 'r1', expiresAt: 5000 })], 0);
    const second = ingestReveals(
      first,
      [peek({ revealId: 'r2', kind: 'POWER', durationMs: 4000, expiresAt: 20_000 })],
      1000,
    );
    expect(second).toHaveLength(2);
    expect(nextExpiryAt(second)).toBe(5000);
    // The first look still expires on its own clock; the second outlives it.
    expect(expireReveals(second, 5001)).toHaveLength(1);
    expect(expireReveals(second, 5001)[0]?.expiresAt).toBe(20_000);
  });

  it('falls back to a local id when no server stamped one (hot-seat)', () => {
    const event = peek();
    if (event.type !== 'CARD_REVEALED') return;
    delete event.revealId;
    delete event.expiresAt;
    const held = ingestReveals([], [event], 0);
    expect(held).toHaveLength(1);
    expect(held[0]?.expiresAt).toBe(8000);
    // Replaying the same lastEvents array must not extend it.
    expect(ingestReveals(held, [event], 10)).toHaveLength(1);
  });

  it('Got it dismisses the viewer’s initial peeks immediately', () => {
    const held = ingestReveals(
      [],
      [peek(), peek({ revealId: 'r2', cardId: 'c2', slotIndex: 1 })],
      0,
    );
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
    expect(facesHeld(held, 'p1', 0)).toHaveLength(0);
    expect(held[0]?.key).toBeUndefined();
  });

  it('a failed flip is a reveal addressed to every seat', () => {
    const held = ingestReveals(
      [],
      [
        peek({ revealId: 'f1', kind: 'FLIP_FAIL', revealedToPlayerId: 'p1', durationMs: 2500 }),
        peek({ revealId: 'f2', kind: 'FLIP_FAIL', revealedToPlayerId: 'p2', durationMs: 2500 }),
      ],
      0,
    );
    expect(held).toHaveLength(2);
    expect(facesHeld(held, 'p1', 0)).toContain('c1');
    expect(facesHeld(held, 'p2', 0)).toContain('c1');
    // And it is forgotten on the same clock as any other reveal.
    expect(expireReveals(held, 10_001)).toHaveLength(0);
  });
});

describe('ActiveReveal', () => {
  it('is the client’s only memory of a face', () => {
    const row: ActiveReveal = {
      revealId: 'r9',
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
    expect(facesHeld([row], 'p1', 0)).toContain('c9');
    expect(facesHeld([row], 'p2', 0)).toHaveLength(0);
    expect(facesHeld([row], 'p1', 4001)).toHaveLength(0);
  });
});
