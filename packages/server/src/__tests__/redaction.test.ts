import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { createHarness } from './harness.js';

describe('redaction', () => {
  it('viewer A’s message has no key on B’s unknown cards; A’s known slots do', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });

    const s1 = h.lastOf('c1', 'state');
    expect(s1).toBeDefined();
    const own = s1!.view.players.p1!.hand;
    const opp = s1!.view.players.p2!.hand;
    expect(own.every((s) => !s.known)).toBe(true);
    const peeks = s1!.lastEvents.filter(
      (e) => e.type === 'CARD_REVEALED' && e.revealedToPlayerId === 'p1' && e.key,
    );
    expect(peeks).toHaveLength(HOUSE_RULES.initialRevealCount);
    for (const slot of opp) {
      expect(slot.known).toBe(false);
      expect('key' in slot).toBe(false);
    }
  });

  it('drawn card identity only on the drawing player’s state message', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    h.send('c1', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p1' } });
    h.send('c2', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p2' } });
    h.send('c3', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p3' } });
    h.send('c1', { type: 'action', action: { type: 'DRAW_DECK', playerId: 'p1' } });

    const s1 = h.lastOf('c1', 'state');
    const s2 = h.lastOf('c2', 'state');
    // The holder sees the card only through a time-boxed draw reveal. The view itself is
    // identity-free, so the face cannot outlive the reveal by riding along on every later state.
    expect(s1?.view.drawnCard).not.toBeNull();
    expect(s1?.view.drawnCard && 'key' in s1.view.drawnCard).toBe(false);
    expect(s2?.view.drawnCard).toBeNull();

    const drawReveal = s1!.lastEvents.find((e) => e.type === 'CARD_REVEALED' && e.kind === 'DRAW');
    expect(drawReveal).toBeDefined();
    expect(drawReveal!.type === 'CARD_REVEALED' && drawReveal.revealedToPlayerId).toBe('p1');
    expect(drawReveal!.type === 'CARD_REVEALED' && drawReveal.key).toBeTruthy();
    expect(drawReveal!.type === 'CARD_REVEALED' && drawReveal.expiresAt).toBeTruthy();
    expect(drawReveal!.type === 'CARD_REVEALED' && drawReveal.durationMs).toBe(
      HOUSE_RULES.drawRevealDurationMs,
    );

    // The same event reaches the other seats stripped of its face.
    const foreign = s2!.lastEvents.find((e) => e.type === 'CARD_REVEALED' && e.kind === 'DRAW');
    expect(foreign).toBeDefined();
    expect(foreign!.type === 'CARD_REVEALED' && foreign.key).toBeUndefined();
  });
});
