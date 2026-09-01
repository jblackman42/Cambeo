import { describe, expect, it } from 'vitest';
import { HOUSE_RULES, tryParseClientMessage } from './index.js';

describe('protocol', () => {
  it('parses a join message', () => {
    const result = tryParseClientMessage({ type: 'join', name: 'Alex' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toEqual({ type: 'join', name: 'Alex' });
    }
  });

  it('rejects an empty name', () => {
    const result = tryParseClientMessage({ type: 'join', name: '' });
    expect(result.ok).toBe(false);
  });

  it('parses PASS_TURN in an action envelope', () => {
    const result = tryParseClientMessage({
      type: 'action',
      action: { type: 'PASS_TURN', playerId: 'p1' },
    });
    expect(result.ok).toBe(true);
  });

  it('parses a setRules envelope', () => {
    const result = tryParseClientMessage({ type: 'setRules', ruleSet: HOUSE_RULES });
    expect(result.ok).toBe(true);
  });

  it('rejects setRules with a broken RuleSet', () => {
    const result = tryParseClientMessage({
      type: 'setRules',
      ruleSet: { ...HOUSE_RULES, handSize: 3 },
    });
    expect(result.ok).toBe(false);
  });
});
