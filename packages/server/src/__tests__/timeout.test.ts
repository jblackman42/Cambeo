import { describe, expect, it } from 'vitest';
import { createHarness } from './harness.js';

describe('disconnect timeout', () => {
  it('disconnected INITIAL_PEEK player is auto ACK_PEEK', () => {
    const h = createHarness({ turnTimeoutMs: 50 });
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    expect(h.room.turnDeadline?.playerId).toBeUndefined();

    h.disconnect('c1');
    expect(h.room.turnDeadline?.playerId).toBe('p1');
    h.clock.t = (h.room.turnDeadline?.at ?? 0) + 1;
    h.alarm();
    expect(h.room.game?.ackedPeek).toContain('p1');
    expect(h.lastOf('c2', 'state')?.lastEvents.some((e) => e.type === 'PEEK_ACKED')).toBe(true);
  });

  it('disconnected turn player is PASS_TURN after turnTimeoutMs; reconnect cancels it', () => {
    const h = createHarness({ turnTimeoutMs: 50 });
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    h.send('c1', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p1' } });
    h.send('c2', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p2' } });
    h.send('c3', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p3' } });
    expect(h.room.game?.turn?.playerId).toBe('p1');

    h.disconnect('c1');
    expect(h.room.turnDeadline?.playerId).toBe('p1');
    const fireAt = h.room.turnDeadline!.at;

    h.join('c1b', 'Alex', 'p1');
    expect(h.room.turnDeadline).toBeNull();

    h.clock.t = fireAt + 1;
    h.alarm();
    expect(h.room.game?.turn?.playerId).toBe('p1');

    h.disconnect('c1b');
    expect(h.room.turnDeadline?.playerId).toBe('p1');
    h.clock.t = h.room.turnDeadline!.at + 1;
    h.alarm();
    expect(h.room.game?.lastEvents.some((e) => e.type === 'TURN_PASSED')).toBe(true);
    expect(h.room.game?.turn?.playerId).toBe('p2');
  });

  it('disconnected TURN_CHOICE player is KEEP_DRAWN', () => {
    const h = createHarness({ turnTimeoutMs: 50 });
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    h.send('c1', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p1' } });
    h.send('c2', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p2' } });
    h.send('c3', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p3' } });
    h.send('c1', { type: 'action', action: { type: 'DRAW_DECK', playerId: 'p1' } });
    expect(h.room.game?.phase).toBe('TURN_CHOICE');

    h.disconnect('c1');
    h.clock.t = h.room.turnDeadline!.at + 1;
    h.alarm();
    expect(h.room.game?.lastEvents.some((e) => e.type === 'CARD_KEPT')).toBe(true);
    expect(h.room.game?.turn?.playerId).toBe('p2');
  });
});
