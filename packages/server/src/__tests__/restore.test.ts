import { describe, expect, it } from 'vitest';
import { HOUSE_RULES, validateForTable } from '@cambeo/shared';
import { RoomController, type SerializedRoom } from '../room.js';

const deps = {
  now: () => 1_000,
  randomId: () => 'p1',
  randomSeed: () => 'test-seed',
};

function storedRoom(ruleSet: unknown): SerializedRoom {
  return {
    roomCode: 'TEST',
    hostId: 'p1',
    ruleSet: ruleSet as SerializedRoom['ruleSet'],
    turnTimeoutMs: 45_000,
    seq: 3,
    players: [{ playerId: 'p1', name: 'Alex', lastSeenAt: 0 }],
    game: null,
    seed: null,
    turnDeadline: null,
  };
}

describe('restoring a persisted room', () => {
  it('fills in RuleSet fields written by an older build', () => {
    const stale: Record<string, unknown> = { ...HOUSE_RULES };
    delete stale.initialPeekDurationMs;
    delete stale.powerRevealDurationMs;

    const room = RoomController.deserialize(storedRoom(stale), deps);

    expect(room.ruleSet).toEqual(HOUSE_RULES);
    expect(validateForTable(room.ruleSet, 3).ok).toBe(true);
  });

  it('keeps a valid stored RuleSet as-is', () => {
    const custom = { ...HOUSE_RULES, jokers: false };
    const room = RoomController.deserialize(storedRoom(custom), deps);
    expect(room.ruleSet).toEqual(custom);
  });
});
