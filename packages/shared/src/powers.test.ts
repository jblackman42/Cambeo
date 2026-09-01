import { describe, expect, it } from 'vitest';
import { cardTargetsForEffect, powerStepLacksLegalTarget } from './powers.js';

describe('cardTargetsForEffect', () => {
  it('does not throw when selections is missing (Jack peek step 2 on an older snapshot)', () => {
    expect(() => cardTargetsForEffect('LOOK_THEN_BLIND_SWAP', undefined, 'SELECT_FOR_SWAP')).not.toThrow();
    expect(cardTargetsForEffect('LOOK_THEN_BLIND_SWAP', undefined, 'SELECT_FOR_SWAP')).toEqual([]);
  });
});

describe('powerStepLacksLegalTarget', () => {
  it('does not throw after a look-and-swap peek when selections is omitted', () => {
    expect(() =>
      powerStepLacksLegalTarget({
        powerId: 'LOOK_THEN_BLIND_SWAP',
        stepIndex: 1,
        selections: undefined,
        actorId: 'p1',
        cambeoCallerId: null,
        seating: ['p1', 'p2', 'p3'],
        cardCount: () => 4,
      }),
    ).not.toThrow();
  });
});
