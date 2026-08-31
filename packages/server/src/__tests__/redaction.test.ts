import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { createHarness } from './harness.js';

describe('redaction', () => {
  it("viewer A’s message has no key on B’s unknown cards; A’s known slots do", () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });

    const s1 = h.lastOf('c1', 'state');
    expect(s1).toBeDefined();
    const own = s1!.view.players.p1!.hand;
    const opp = s1!.view.players.p2!.hand;
    const knownOwn = own.filter((s) => s.known);
    expect(knownOwn.length).toBe(HOUSE_RULES.initialRevealCount);
    for (const slot of knownOwn) {
      expect(slot.known).toBe(true);
      if (slot.known) expect(slot.key).toBeTruthy();
    }
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
    expect(s1?.view.drawnCard).not.toBeNull();
    expect(s1?.view.drawnCard?.key).toBeTruthy();
    expect(s2?.view.drawnCard).toBeNull();
  });
});
