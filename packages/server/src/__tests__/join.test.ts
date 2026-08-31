import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from '@cambeo/shared';
import { createHarness } from './harness.js';

describe('join limits', () => {
  it('accepts players up to RuleSet.maxPlayers and rejects the next', () => {
    const h = createHarness();
    for (let i = 1; i <= HOUSE_RULES.maxPlayers; i++) {
      const result = h.join(`c${i}`, `Player${i}`);
      expect(result.outbound.some((o) => o.message.type === 'error')).toBe(false);
      expect(h.lastOf(`c${i}`, 'welcome')?.playerId).toBe(`p${i}`);
    }
    h.join('c9', 'Overflow');
    const err = h.lastOf('c9', 'error');
    expect(err?.code).toBe('ROOM_FULL');
    expect(h.room.players).toHaveLength(HOUSE_RULES.maxPlayers);
  });

  it('rejects a new playerId after START_GAME', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    expect(h.room.game?.phase).toBe('INITIAL_PEEK');

    h.join('c4', 'Drew');
    expect(h.lastOf('c4', 'error')?.code).toBe('GAME_IN_PROGRESS');
  });
});
