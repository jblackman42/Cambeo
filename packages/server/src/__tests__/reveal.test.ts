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
});
