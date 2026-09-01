import type { CardKey, GameEvent, PlayerId, Suit } from '@cambeo/shared';

export const REVEAL_WARNING_MS = 1500;

export type RevealKind = 'INITIAL_PEEK' | 'POWER';

export type ActiveReveal = {
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

function sameReveal(a: ActiveReveal, event: Extract<GameEvent, { type: 'CARD_REVEALED' }>): boolean {
  return (
    a.cardId === event.cardId &&
    a.revealedToPlayerId === event.revealedToPlayerId &&
    a.kind === event.kind
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
    if (next.some((row) => sameReveal(row, event))) continue;
    const expiresAt = event.expiresAt ?? now + event.durationMs;
    if (expiresAt <= now) continue;
    next.push({
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

export function identitiesHeld(
  reveals: ActiveReveal[],
  viewerId: PlayerId,
  now: number,
): Set<string> {
  const ids = new Set<string>();
  for (const row of reveals) {
    if (row.revealedToPlayerId === viewerId && row.expiresAt > now && row.key) {
      ids.add(row.cardId);
    }
  }
  return ids;
}

export function nextExpiryAt(reveals: ActiveReveal[]): number | null {
  if (reveals.length === 0) return null;
  return Math.min(...reveals.map((row) => row.expiresAt));
}
