import { describe, expect, it } from 'vitest';
import { ActionSchema, tryParseClientMessage } from './index.js';

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

  it('rejects an unknown action type', () => {
    expect(ActionSchema.safeParse({ type: 'EXPLODE', playerId: 'p1' }).success).toBe(false);
  });
});
