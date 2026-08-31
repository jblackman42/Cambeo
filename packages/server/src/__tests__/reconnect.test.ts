import { describe, expect, it } from 'vitest';
import { createHarness } from './harness.js';

describe('reconnect', () => {
  it('second socket for the same playerId receives a snapshot matching the current redacted view', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    h.send('c1', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p1' } });

    const before = h.lastOf('c1', 'state');
    h.disconnect('c1');
    expect(h.lastOf('c2', 'room')?.room.players.find((p) => p.playerId === 'p1')?.connected).toBe(
      false,
    );

    h.join('c1b', 'Alex', 'p1');
    const welcome = h.lastOf('c1b', 'welcome');
    const snap = h.lastOf('c1b', 'snapshot');
    expect(welcome?.playerId).toBe('p1');
    expect(snap?.room.you.playerId).toBe('p1');
    expect(snap?.room.game?.phase).toBe(before?.view.phase);
    expect(snap?.room.game?.players.p1?.hand).toEqual(before?.view.players.p1?.hand);
    expect(snap?.room.players.find((p) => p.playerId === 'p1')?.connected).toBe(true);
  });
});
