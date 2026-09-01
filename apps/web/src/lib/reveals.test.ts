import { describe, expect, it } from 'vitest';
import {
  dismissInitialPeeks,
  expireReveals,
  ingestReveals,
  initialPeekEventsFor,
  nextExpiryAt,
  withoutForeignInitialPeeks,
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

describe('draw reveal', () => {
  it('the held card is forgotten on its own clock, like any other look', () => {
    const held = ingestReveals(
      [],
      [peek({ revealId: 'd1', cardId: 'drawn', kind: 'DRAW', durationMs: 5000, expiresAt: 5000 })],
      0,
    );
    expect(facesHeld(held, 'p1', 0)).toContain('drawn');
    expect(expireReveals(held, 5001)).toHaveLength(0);
  });
});

describe('hot-seat initial peeks', () => {
  // Hot-seat runs the engine locally, so these arrive raw: no server revealId, no server
  // expiresAt. The clock starts when the client ingests them, which is the whole point here.
  const local = (overrides: Partial<GameEvent & { type: 'CARD_REVEALED' }>) =>
    peek({ revealId: undefined, expiresAt: undefined, ...overrides });

  const batch = [
    local({ cardId: 'c1', revealedToPlayerId: 'p1', ownerId: 'p1' }),
    local({ cardId: 'c2', revealedToPlayerId: 'p1', ownerId: 'p1' }),
    local({ cardId: 'c5', revealedToPlayerId: 'p2', ownerId: 'p2' }),
    local({ cardId: 'c6', revealedToPlayerId: 'p2', ownerId: 'p2' }),
  ];

  it('splits the deal batch by seat so each seat can be armed on its own', () => {
    expect(initialPeekEventsFor(batch, 'p2')).toHaveLength(2);
    expect(initialPeekEventsFor(batch, 'p3')).toHaveLength(0);
  });

  it('holds back the other seats’ peeks without touching anything else', () => {
    const events = [
      ...batch,
      local({ cardId: 'c9', kind: 'POWER', revealedToPlayerId: 'p2' }),
      { type: 'TURN_STARTED', playerId: 'p1' } as GameEvent,
    ];
    const kept = withoutForeignInitialPeeks(events, 'p1');
    expect(
      kept.filter((e) => e.type === 'CARD_REVEALED' && e.kind === 'INITIAL_PEEK'),
    ).toHaveLength(2);
    // A power reveal addressed elsewhere still travels: the overlay shows it face-down.
    expect(kept.some((e) => e.type === 'CARD_REVEALED' && e.kind === 'POWER')).toBe(true);
    expect(kept.some((e) => e.type === 'TURN_STARTED')).toBe(true);
  });

  it('arming a seat later starts that seat’s clock from then, not from the deal', () => {
    const atDeal = ingestReveals([], withoutForeignInitialPeeks(batch, 'p1'), 0);
    expect(atDeal).toHaveLength(2);

    // Seat 2 picks up the device four seconds in; its peek must still run a full 8s.
    const armedLater = ingestReveals(atDeal, initialPeekEventsFor(batch, 'p2'), 4000);
    const seat2 = armedLater.filter((row) => row.revealedToPlayerId === 'p2');
    expect(seat2).toHaveLength(2);
    expect(seat2.every((row) => row.expiresAt === 12_000)).toBe(true);
    expect(facesHeld(armedLater, 'p2', 10_001)).toHaveLength(2);
  });
});
