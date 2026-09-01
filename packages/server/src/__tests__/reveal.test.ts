import { describe, expect, it } from 'vitest';
import { HOUSE_RULES, cloneRuleSet, CARD_KEYS } from '@cambeo/shared';
import { createHarness } from './harness.js';

function revealEvents(msg: { lastEvents?: { type: string }[] } | { view?: { lastEvents: { type: string }[] } } | undefined) {
  const events =
    msg && 'lastEvents' in msg && msg.lastEvents
      ? msg.lastEvents
      : msg && 'view' in msg && msg.view
        ? msg.view.lastEvents
        : [];
  return events.filter((e) => e.type === 'CARD_REVEALED') as Array<{
    type: 'CARD_REVEALED';
    cardId: string;
    revealedToPlayerId: string;
    kind: string;
    durationMs: number;
    revealId?: string;
    expiresAt?: number;
    key?: string;
  }>;
}

describe('time-boxed reveals', () => {
  it('delivers CARD_REVEALED identity once on state, with expiresAt', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });

    const s1 = h.lastOf('c1', 'state');
    const s2 = h.lastOf('c2', 'state');
    const own = revealEvents(s1).filter((e) => e.revealedToPlayerId === 'p1' && e.key);
    const otherLift = revealEvents(s2).filter((e) => e.revealedToPlayerId === 'p1');
    expect(own).toHaveLength(HOUSE_RULES.initialRevealCount);
    expect(own[0]?.durationMs).toBe(HOUSE_RULES.initialPeekDurationMs);
    expect(own[0]?.expiresAt).toBe(h.clock.t + HOUSE_RULES.initialPeekDurationMs);
    expect(otherLift.length).toBeGreaterThan(0);
    expect(otherLift.every((e) => e.key === undefined)).toBe(true);
    expect(s1?.view.players.p1?.hand.every((slot) => !slot.known)).toBe(true);
  });

  it('a snapshot after a reveal does not contain the identity', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    h.clock.t += HOUSE_RULES.initialPeekDurationMs + 1;

    h.disconnect('c1');
    h.join('c1b', 'Alex', 'p1');
    const snap = h.lastOf('c1b', 'snapshot');
    expect(revealEvents(snap?.room).some((e) => e.key)).toBe(false);
    expect(snap?.room.game?.players.p1?.hand.every((slot) => !slot.known)).toBe(true);
  });

  it('reconnect during a reveal does not reissue it', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    const first = revealEvents(h.lastOf('c1', 'state'));
    expect(first.some((e) => e.key)).toBe(true);

    h.disconnect('c1');
    h.join('c1b', 'Alex', 'p1');
    const snap = h.lastOf('c1b', 'snapshot');
    expect(revealEvents(snap?.room)).toHaveLength(0);
    expect(snap?.room.game?.players.p1?.hand.every((slot) => !slot.known)).toBe(true);
  });

  it('other players receive a lift notification with no identity on a power peek', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    const rules = cloneRuleSet(HOUSE_RULES);
    for (const key of CARD_KEYS) {
      rules.powers[key] = 'PEEK_OTHER';
    }
    h.send('c1', { type: 'setRules', ruleSet: rules });
    h.send('c1', { type: 'start' });
    h.send('c1', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p1' } });
    h.send('c2', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p2' } });
    h.send('c3', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p3' } });
    h.send('c1', { type: 'action', action: { type: 'DRAW_DECK', playerId: 'p1' } });
    h.send('c1', { type: 'action', action: { type: 'DISCARD_DRAWN', playerId: 'p1' } });
    h.send('c1', {
      type: 'action',
      action: {
        type: 'RESOLVE_POWER_TARGET',
        playerId: 'p1',
        target: { kind: 'CARD', playerId: 'p2', slotIndex: 0 },
      },
    });
    const actor = revealEvents(h.lastOf('c1', 'state'));
    const other = revealEvents(h.lastOf('c3', 'state'));
    expect(actor.some((e) => e.key && e.kind === 'POWER')).toBe(true);
    expect(other.some((e) => e.kind === 'POWER' && e.key === undefined)).toBe(true);
  });

  it('stamps a distinct revealId on every delivered reveal', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });

    const ids = revealEvents(h.lastOf('c1', 'state')).map((e) => e.revealId);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a failed flip reveals to every seat and never survives into a snapshot', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    h.send('c1', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p1' } });
    h.send('c2', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p2' } });
    h.send('c3', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p3' } });
    h.send('c1', { type: 'action', action: { type: 'DRAW_DECK', playerId: 'p1' } });
    h.send('c1', { type: 'action', action: { type: 'DISCARD_DRAWN', playerId: 'p1' } });
    // Slot 3 is never one of the two initially peeked slots, so this is a blind guess and the
    // engine's own match check decides. Either way no identity may outlive the reveal.
    h.send('c2', {
      type: 'action',
      action: {
        type: 'FLIP_ATTEMPT',
        playerId: 'p2',
        target: { playerId: 'p3', slotIndex: 3 },
      },
    });

    const state = h.lastOf('c2', 'state');
    expect(state?.lastEvents?.some((e) => e.type === 'FLIP_FAIL')).toBe(true);

    // One reveal per seat, each carrying the face and each on the flip duration.
    const flipReveals = revealEvents(state).filter((e) => e.kind === 'FLIP_FAIL');
    expect(flipReveals).toHaveLength(3);
    expect(flipReveals.every((e) => e.durationMs === HOUSE_RULES.flipRevealDurationMs)).toBe(true);
    expect(
      flipReveals.every((e) => e.expiresAt === h.clock.t + HOUSE_RULES.flipRevealDurationMs),
    ).toBe(true);
    // c2 is only entitled to the one addressed to p2.
    expect(flipReveals.filter((e) => e.key !== undefined)).toHaveLength(1);
    expect(flipReveals.find((e) => e.key !== undefined)?.revealedToPlayerId).toBe('p2');

    h.disconnect('c2');
    h.join('c2b', 'Blair', 'p2');
    const snap = h.lastOf('c2b', 'snapshot');
    expect(revealEvents(snap?.room).some((e) => e.key)).toBe(false);
    expect(snap?.room.game?.players.p3?.hand.every((slot) => !slot.known)).toBe(true);
  });
});
