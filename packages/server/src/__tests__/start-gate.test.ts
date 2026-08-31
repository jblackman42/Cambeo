import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { createHarness } from './harness.js';

describe('start gate', () => {
  it('rejects start below RuleSet.minPlayers', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.send('c1', { type: 'start' });
    expect(h.lastOf('c1', 'error')?.code).toBe('NEED_PLAYERS');
    expect(h.room.game).toBeNull();
    expect(h.room.players).toHaveLength(2);
    expect(HOUSE_RULES.minPlayers).toBeGreaterThan(2);
  });

  it('rejects start from a non-host', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c2', { type: 'start' });
    expect(h.lastOf('c2', 'error')?.code).toBe('NOT_HOST');
    expect(h.room.game).toBeNull();
  });

  it('start with 3 players deals and fans out INITIAL_PEEK views', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    expect(h.room.game?.phase).toBe('INITIAL_PEEK');
    expect(h.room.game?.seating).toEqual(['p1', 'p2', 'p3']);

    const s1 = h.lastOf('c1', 'state');
    const s2 = h.lastOf('c2', 'state');
    expect(s1?.view.phase).toBe('INITIAL_PEEK');
    expect(s2?.view.phase).toBe('INITIAL_PEEK');
    expect(s1?.view.seating).toEqual(['p1', 'p2', 'p3']);
    expect(s1?.view.players.p1?.cardCount).toBe(HOUSE_RULES.handSize);
  });

  it('rejects action playerId spoofing without calling reduce', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    const seq = h.room.seq;
    h.send('c1', { type: 'action', action: { type: 'ACK_PEEK', playerId: 'p2' } });
    expect(h.lastOf('c1', 'error')?.code).toBe('SPOOFED_PLAYER');
    expect(h.room.seq).toBe(seq);
    expect(h.room.game?.ackedPeek).toEqual([]);
  });
});
