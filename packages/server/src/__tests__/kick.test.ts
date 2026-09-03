import { describe, expect, it } from 'vitest';
import { createHarness } from './harness.js';

describe('kick', () => {
  it('host removes a player and the room fans out without them', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    const blair = h.playerIdOf('c2');

    h.send('c1', { type: 'kick', playerId: blair });

    expect(h.room.players.map((p) => p.playerId)).toEqual([h.playerIdOf('c1')]);
    expect(h.lastOf('c2', 'error')?.code).toBe('KICKED');
    expect(h.lastOf('c1', 'room')?.room.players).toHaveLength(1);
  });

  it('stops sending room updates to the kicked connection', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    const blair = h.playerIdOf('c2');
    h.send('c1', { type: 'kick', playerId: blair });
    const seen = h.messages('c2').length;

    h.join('c3', 'Casey');

    expect(h.messages('c2')).toHaveLength(seen);
  });

  it('rejects a kick from a non-host', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');

    h.send('c2', { type: 'kick', playerId: h.playerIdOf('c3') });

    expect(h.lastOf('c2', 'error')?.code).toBe('NOT_HOST');
    expect(h.room.players).toHaveLength(3);
  });

  it('rejects kicking yourself', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');

    h.send('c1', { type: 'kick', playerId: h.playerIdOf('c1') });

    expect(h.lastOf('c1', 'error')?.code).toBe('BAD_MESSAGE');
    expect(h.room.players).toHaveLength(2);
  });

  it('rejects an unknown player', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');

    h.send('c1', { type: 'kick', playerId: 'nobody' });

    expect(h.lastOf('c1', 'error')?.code).toBe('UNKNOWN_PLAYER');
    expect(h.room.players).toHaveLength(2);
  });

  it('rejects a kick once the game has started, keeping seating intact', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    const seating = h.room.game?.seating;

    h.send('c1', { type: 'kick', playerId: h.playerIdOf('c2') });

    expect(h.lastOf('c1', 'error')?.code).toBe('GAME_IN_PROGRESS');
    expect(h.room.players).toHaveLength(3);
    expect(h.room.game?.seating).toEqual(seating);
  });

  it('hands the host role on when the host leaves, and the new host can kick', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'leave' });

    expect(h.room.hostId).toBe(h.playerIdOf('c2'));

    h.send('c2', { type: 'kick', playerId: h.playerIdOf('c3') });

    expect(h.room.players.map((p) => p.playerId)).toEqual([h.playerIdOf('c2')]);
  });
});
