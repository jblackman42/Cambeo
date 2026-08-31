import { describe, expect, it } from 'vitest';
import { startStacked } from '@cambeo/engine/testkit';
import { createHarness } from './harness.js';

describe('flip order', () => {
  it('two clients FLIP_ATTEMPT the same epoch; first reduce wins; second is rejected only', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');

    const stacked = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: 'Q_BLACK' }, { key: '5' }, { key: '6' }, { key: '7' }],
        p3: [{ key: 'Q_RED' }, { key: '8' }, { key: '9' }, { key: '10' }],
      },
      deck: [{ key: 'K_RED' }],
      discard: [{ key: 'Q_RED' }],
    });
    h.room.setGameForTest(stacked);

    h.send('c2', {
      type: 'action',
      action: { type: 'FLIP_ATTEMPT', playerId: 'p2', target: { playerId: 'p2', slotIndex: 0 } },
    });
    const first = h.lastOf('c2', 'state');
    expect(first?.lastEvents.some((e) => e.type === 'FLIP_SUCCESS')).toBe(true);
    expect(h.room.game?.flipWonForEpoch).toBe(h.room.game?.discardEpoch);

    const seq = h.room.seq;
    h.send('c3', {
      type: 'action',
      action: { type: 'FLIP_ATTEMPT', playerId: 'p3', target: { playerId: 'p3', slotIndex: 0 } },
    });
    expect(h.lastOf('c3', 'rejected')?.reason).toMatch(/already won/i);
    expect(h.room.seq).toBe(seq);
    expect(h.lastOf('c1', 'state')?.seq).toBe(seq);
  });
});
