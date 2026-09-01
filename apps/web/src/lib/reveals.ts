import type { CardKey, GameEvent, PlayerId, Suit } from '@cambeo/shared';

export const REVEAL_WARNING_MS = 1500;

export type RevealKind = 'INITIAL_PEEK' | 'POWER' | 'FLIP_FAIL';

export type ActiveReveal = {
  /** Server-stamped, unique per emitted reveal. Falls back to a local key in hot-seat. */
  revealId: string;
  cardId: string;
  ownerId: PlayerId;
  slotIndex: number;
  revealedToPlayerId: PlayerId;
  kind: RevealKind;
  durationMs: number;
  expiresAt: number;
  key?: CardKey;
  suit?: Suit;
  value?: number;
};

/**
 * Hot-seat runs the engine locally, so no server ever stamps a revealId. Deriving one from the
 * slot plus kind keeps the dedupe honest there: replaying the same lastEvents array is ignored,
 * which is the only replay that can happen without a socket.
 */
function revealIdFor(event: Extract<GameEvent, { type: 'CARD_REVEALED' }>): string {
  return (
    event.revealId ?? `local:${event.cardId}:${event.revealedToPlayerId}:${event.kind}`
  );
}

export function ingestReveals(
  current: ActiveReveal[],
  events: readonly GameEvent[],
  now: number,
): ActiveReveal[] {
  const next = expireReveals(current, now);
  for (const event of events) {
    if (event.type !== 'CARD_REVEALED') continue;
    const revealId = revealIdFor(event);
    // Dedupe on the id, not on the slot: a second legitimate look at the same card is a new
    // reveal and must restart its timer, while a replayed event must never extend a live one.
    if (next.some((row) => row.revealId === revealId)) continue;
    const expiresAt = event.expiresAt ?? now + event.durationMs;
    if (expiresAt <= now) continue;
    next.push({
      revealId,
      cardId: event.cardId,
      ownerId: event.ownerId,
      slotIndex: event.slotIndex,
      revealedToPlayerId: event.revealedToPlayerId,
      kind: event.kind,
      durationMs: event.durationMs,
      expiresAt,
      key: event.key,
      suit: event.suit,
      value: event.value,
    });
  }
  return next;
}

export function expireReveals(current: ActiveReveal[], now: number): ActiveReveal[] {
  return current.filter((row) => row.expiresAt > now);
}

export function dismissInitialPeeks(current: ActiveReveal[], viewerId: PlayerId): ActiveReveal[] {
  return current.filter(
    (row) => !(row.kind === 'INITIAL_PEEK' && row.revealedToPlayerId === viewerId),
  );
}

export function nextExpiryAt(reveals: ActiveReveal[]): number | null {
  if (reveals.length === 0) return null;
  return Math.min(...reveals.map((row) => row.expiresAt));
}
