'use client';

import { useEffect, useRef, useState } from 'react';
import type { ActiveReveal } from '@/lib/reveals';

/** How long a face lingers, fading, after its reveal expires. Matches `reveal-settle` in CSS. */
export const REVEAL_HIDE_MS = 220;

export type RevealPresence = { reveal: ActiveReveal; hiding: boolean } | null;

/**
 * Keeps a face mounted for one beat past its expiry so it can be seen leaving. Without this the
 * card simply blinks back to its back and the player is left unsure whether it was ever shown.
 */
export function useRevealPresence(reveal: ActiveReveal | undefined): RevealPresence {
  const [lingering, setLingering] = useState<ActiveReveal | null>(null);
  const shown = useRef<ActiveReveal | null>(null);

  useEffect(() => {
    if (reveal) {
      shown.current = reveal;
      setLingering(null);
      return undefined;
    }
    const last = shown.current;
    shown.current = null;
    if (!last) return undefined;
    setLingering(last);
    const t = window.setTimeout(() => setLingering(null), REVEAL_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [reveal]);

  if (reveal) return { reveal, hiding: false };
  if (lingering) return { reveal: lingering, hiding: true };
  return null;
}

export type RevealPresenceRow = { reveal: ActiveReveal; hiding: boolean };

/**
 * List form, for the lift overlay. The dependency is the joined reveal ids rather than the array
 * itself: callers rebuild the array every render, and an effect keyed on identity would clear its
 * own hide timer on the very next render and leave the face stranded on screen.
 */
export function useRevealsPresence(rows: readonly ActiveReveal[]): RevealPresenceRow[] {
  const key = rows.map((row) => row.revealId).join('|');
  const [lingering, setLingering] = useState<ActiveReveal[]>([]);
  const shown = useRef<readonly ActiveReveal[]>([]);
  const latest = useRef<readonly ActiveReveal[]>(rows);
  latest.current = rows;

  useEffect(() => {
    if (latest.current.length > 0) {
      shown.current = latest.current;
      setLingering([]);
      return undefined;
    }
    const last = shown.current;
    shown.current = [];
    if (last.length === 0) return undefined;
    setLingering([...last]);
    const t = window.setTimeout(() => setLingering([]), REVEAL_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [key]);

  if (rows.length > 0) return rows.map((reveal) => ({ reveal, hiding: false }));
  return lingering.map((reveal) => ({ reveal, hiding: true }));
}
