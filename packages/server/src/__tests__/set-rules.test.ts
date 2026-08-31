import { describe, expect, it } from 'vitest';
import { HOUSE_RULES, cloneRuleSet } from '@cambeo/shared';
import { createHarness } from './harness.js';

describe('setRules', () => {
  it('puts House Rules on the lobby RoomView', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    const snap = h.lastOf('c1', 'snapshot');
    expect(snap?.room.ruleSet).toEqual(HOUSE_RULES);
  });

  it('host can change rules in the lobby and everyone sees them', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    const next = cloneRuleSet(HOUSE_RULES);
    next.jokers = false;
    next.handSize = 5;
    next.lossThreshold = 6;
    h.send('c1', { type: 'setRules', ruleSet: next });
    expect(h.room.ruleSet.jokers).toBe(false);
    expect(h.room.ruleSet.handSize).toBe(5);
    expect(h.lastOf('c1', 'room')?.room.ruleSet.handSize).toBe(5);
    expect(h.lastOf('c2', 'room')?.room.ruleSet.jokers).toBe(false);
  });

  it('rejects setRules from a non-host', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    const next = cloneRuleSet(HOUSE_RULES);
    next.handSize = 5;
    next.lossThreshold = 6;
    h.send('c2', { type: 'setRules', ruleSet: next });
    expect(h.lastOf('c2', 'error')?.code).toBe('NOT_HOST');
    expect(h.room.ruleSet).toEqual(HOUSE_RULES);
  });

  it('locks rules after start', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    h.send('c1', { type: 'start' });
    const next = cloneRuleSet(HOUSE_RULES);
    next.jokers = false;
    h.send('c1', { type: 'setRules', ruleSet: next });
    expect(h.lastOf('c1', 'error')?.code).toBe('GAME_IN_PROGRESS');
    expect(h.room.ruleSet.jokers).toBe(true);
  });

  it('rejects maxPlayers below the current roster', () => {
    const h = createHarness();
    h.join('c1', 'Alex');
    h.join('c2', 'Blair');
    h.join('c3', 'Casey');
    const next = cloneRuleSet(HOUSE_RULES);
    next.minPlayers = 2;
    next.maxPlayers = 2;
    h.send('c1', { type: 'setRules', ruleSet: next });
    expect(h.lastOf('c1', 'error')?.code).toBe('INVALID_RULES');
    expect(h.room.ruleSet.maxPlayers).toBe(HOUSE_RULES.maxPlayers);
  });
});
