import { type RedactedGameView } from '@cambeo/shared';
import { describe, expect, it } from 'vitest';
import {
  ARM_TIMEOUT_MS,
  RACE_LOSS_REASON,
  actionHasArmState,
  commitFlipAction,
  isRaceLossReason,
  localPhaseFromView,
  powerActionCopy,
  powerStepNeedsSkip,
  routeCardTap,
  shouldDisarmArmed,
  type ArmedFlip,
  type CardTapInput,
  type LocalPhase,
} from './input-routing';
import { flipPenaltyMessage } from './format';

const VIEWER = 'p1';
const OPP = 'p2';

function tap(overrides: Partial<CardTapInput> = {}): CardTapInput {
  return {
    localPhase: 'idle',
    viewerId: VIEWER,
    ownerId: VIEWER,
    slotIndex: 0,
    cardId: 'c1',
    cambeoCallerId: null,
    armed: null,
    discardKey: '7',
    discardId: 'd1',
    ...overrides,
  };
}

function armed(overrides: Partial<ArmedFlip> = {}): ArmedFlip {
  return {
    ownerId: VIEWER,
    slotIndex: 0,
    cardId: 'c1',
    discardKey: '7',
    discardId: 'd1',
    ...overrides,
  };
}

function view(overrides: Partial<RedactedGameView> = {}): RedactedGameView {
  return {
    viewerId: VIEWER,
    phase: 'TURN_DRAW',
    seating: [VIEWER, OPP, 'p3'],
    players: {},
    deckCount: 10,
    discardTop: { id: 'd1', key: '7', suit: 'hearts', value: 7 },
    discardCount: 1,
    turn: { playerId: OPP, hasDrawn: false, drawnFrom: null },
    drawnCard: null,
    drawnOptions: null,
    pendingPower: null,
    pendingGive: null,
    cambeoCallerId: null,
    finalRoundRemaining: [],
    overThreshold: [],
    result: null,
    ruleSet: {} as RedactedGameView['ruleSet'],
    ackedPeek: [],
    lastEvents: [],
    ...overrides,
  };
}

describe('routeCardTap', () => {
  it('single tap on any card never produces a FLIP_ATTEMPT', () => {
    const result = routeCardTap(tap());
    expect(result.kind).toBe('arm');
    if (result.kind === 'arm') {
      expect(result.armed.cardId).toBe('c1');
    }
  });

  it('second tap on the same armed card produces exactly one FLIP_ATTEMPT', () => {
    const result = routeCardTap(tap({ armed: armed() }));
    expect(result.kind).toBe('commit');
    if (result.kind === 'commit') {
      expect(result.action).toEqual({
        type: 'FLIP_ATTEMPT',
        playerId: VIEWER,
        target: { playerId: VIEWER, slotIndex: 0 },
      });
      expect(actionHasArmState(result.action)).toBe(false);
    }
  });

  it('tap on a different card after arming re-arms and does not commit', () => {
    const result = routeCardTap(
      tap({
        armed: armed(),
        ownerId: OPP,
        slotIndex: 2,
        cardId: 'c9',
      }),
    );
    expect(result.kind).toBe('arm');
    if (result.kind === 'arm') {
      expect(result.armed.cardId).toBe('c9');
      expect(result.armed.ownerId).toBe(OPP);
    }
  });

  it.each([
    'TURN_DRAW',
    'TURN_CHOICE',
    'POWER_TARGETING',
    'GIVE_CARD_PENDING',
  ] as LocalPhase[])('emits no FLIP_ATTEMPT during %s', (localPhase) => {
    const first = routeCardTap(tap({ localPhase, powerMode: { allowOwn: true, allowOther: true } }));
    expect(first.kind).not.toBe('commit');
    expect(first.kind).not.toBe('arm');
    const second = routeCardTap(
      tap({
        localPhase,
        armed: armed(),
        powerMode: { allowOwn: true, allowOther: true },
      }),
    );
    expect(second.kind).not.toBe('commit');
  });

  it('targeting during POWER_TARGETING produces a target action and never a flip', () => {
    const result = routeCardTap(
      tap({
        localPhase: 'POWER_TARGETING',
        ownerId: OPP,
        powerMode: { allowOwn: false, allowOther: true },
      }),
    );
    expect(result.kind).toBe('target');
    if (result.kind === 'target') {
      expect(result.action.type).toBe('RESOLVE_POWER_TARGET');
      expect(result.action).not.toHaveProperty('armed');
    }
  });

  it('illegal power target is a shake, not a flip', () => {
    const result = routeCardTap(
      tap({
        localPhase: 'POWER_TARGETING',
        ownerId: VIEWER,
        powerMode: { allowOwn: false, allowOther: true },
      }),
    );
    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') expect(result.shake).toBe(true);
  });

  it('TURN_CHOICE on own card replaces; opponent card is a no-op', () => {
    const own = routeCardTap(tap({ localPhase: 'TURN_CHOICE' }));
    expect(own.kind).toBe('target');
    if (own.kind === 'target') {
      expect(own.action).toEqual({
        type: 'REPLACE_CARD',
        playerId: VIEWER,
        slotIndex: 0,
      });
    }
    const other = routeCardTap(tap({ localPhase: 'TURN_CHOICE', ownerId: OPP }));
    expect(other.kind).toBe('noop');
  });

  it('GIVE_CARD_PENDING selects a card to give from your hand only', () => {
    const own = routeCardTap(tap({ localPhase: 'GIVE_CARD_PENDING', slotIndex: 2 }));
    expect(own).toEqual({
      kind: 'target',
      action: { type: 'GIVE_CARD', playerId: VIEWER, slotIndex: 2 },
    });
    expect(routeCardTap(tap({ localPhase: 'GIVE_CARD_PENDING', ownerId: OPP })).kind).toBe('noop');
  });

  it('cambeo caller cards shake and do not arm', () => {
    const result = routeCardTap(tap({ ownerId: OPP, cambeoCallerId: OPP }));
    expect(result).toEqual({ kind: 'noop', shake: true, reason: 'cambeo-locked' });
  });

  it('after you called cambeo, taps are no-ops', () => {
    expect(routeCardTap(tap({ localPhase: 'CALLED_CAMBEO' })).kind).toBe('noop');
    expect(routeCardTap(tap({ localPhase: 'CALLED_CAMBEO', ownerId: OPP })).kind).toBe('noop');
  });
});

describe('shouldDisarmArmed', () => {
  const ctx = {
    discardId: 'd1',
    turnPlayerId: OPP,
    viewerId: VIEWER,
    cambeoCallerId: null as string | null,
    cardIdAtSlot: 'c1',
    localPhase: 'idle' as LocalPhase,
  };

  it('disarms when the discard top changes', () => {
    expect(shouldDisarmArmed(armed(), { ...ctx, discardId: 'd2' })).toBe('discard-changed');
  });

  it('disarms when the armed card is swapped away', () => {
    expect(shouldDisarmArmed(armed(), { ...ctx, cardIdAtSlot: 'c-other' })).toBe('card-moved');
  });

  it('disarms when it becomes the local player turn', () => {
    expect(
      shouldDisarmArmed(armed(), { ...ctx, turnPlayerId: VIEWER, localPhase: 'TURN_DRAW' }),
    ).toBe('became-our-turn');
  });

  it('disarms when the player calls cambeo', () => {
    expect(
      shouldDisarmArmed(armed(), {
        ...ctx,
        cambeoCallerId: VIEWER,
        localPhase: 'CALLED_CAMBEO',
      }),
    ).toBe('called-cambeo');
  });

  it('keeps the arm when nothing relevant changed', () => {
    expect(shouldDisarmArmed(armed(), ctx)).toBeNull();
  });
});

describe('localPhaseFromView', () => {
  it('is idle when it is not your turn', () => {
    expect(localPhaseFromView(view(), VIEWER)).toBe('idle');
  });

  it('is TURN_DRAW on your undrawn turn', () => {
    expect(
      localPhaseFromView(
        view({ turn: { playerId: VIEWER, hasDrawn: false, drawnFrom: null } }),
        VIEWER,
      ),
    ).toBe('TURN_DRAW');
  });

  it('is POWER_TARGETING only for the actor', () => {
    const v = view({
      phase: 'POWER_TARGETING',
      pendingPower: {
        playerId: VIEWER,
        powerId: 'LOOK_THEN_BLIND_SWAP',
        stepIndex: 0,
        selections: [],
      },
      turn: { playerId: VIEWER, hasDrawn: true, drawnFrom: 'DECK' },
    });
    expect(localPhaseFromView(v, VIEWER)).toBe('POWER_TARGETING');
    expect(localPhaseFromView(v, OPP)).toBe('idle');
  });
});

describe('commitFlipAction', () => {
  it('never includes arm state on the outbound action', () => {
    const action = commitFlipAction(VIEWER, armed());
    expect(action.type).toBe('FLIP_ATTEMPT');
    expect(actionHasArmState(action)).toBe(false);
    expect(JSON.stringify(action)).not.toMatch(/arm/i);
  });
});

describe('race loss and penalty copy', () => {
  it('identifies a lost race without treating it as an error reason', () => {
    expect(isRaceLossReason(RACE_LOSS_REASON)).toBe(true);
    expect(isRaceLossReason('Invalid slot')).toBe(false);
  });

  it('names both cards on a wrong flip', () => {
    expect(flipPenaltyMessage('Q_RED', '7')).toBe(
      'No match. You flipped a Queen onto a 7. You take a penalty card.',
    );
  });

  it('arm timeout is 4 seconds', () => {
    expect(ARM_TIMEOUT_MS).toBe(4000);
  });
});

describe('powerActionCopy', () => {
  it('presents Jack look-and-swap as two user-facing steps', () => {
    const look = powerActionCopy('LOOK_THEN_BLIND_SWAP', 0);
    expect(look.kicker).toBe('Look and Swap');
    expect(look.stepLabel).toBe('Step 1 of 2');
    expect(look.instruction).toMatch(/opponent/i);
    const swap = powerActionCopy('LOOK_THEN_BLIND_SWAP', 1);
    expect(swap.stepLabel).toBe('Step 2 of 2');
    expect(swap.instruction).toMatch(/including the one you looked at/i);
    expect(swap.instruction).toMatch(/Selected: 0 of 2/);
    const swap2 = powerActionCopy('LOOK_THEN_BLIND_SWAP', 2);
    expect(swap2.stepLabel).toBe('Step 2 of 2');
    expect(swap2.instruction).toMatch(/Selected: 1 of 2/);
  });
});

describe('powerStepNeedsSkip', () => {
  it('does not throw after a Jack peek when selections are missing from the view', () => {
    const v = view({
      phase: 'POWER_TARGETING',
      pendingPower: {
        playerId: VIEWER,
        powerId: 'LOOK_THEN_BLIND_SWAP',
        stepIndex: 1,
      },
      players: {
        [VIEWER]: { id: VIEWER, hand: [{ id: 'c1', known: false }], cardCount: 1 },
        [OPP]: { id: OPP, hand: [{ id: 'c2', known: false }], cardCount: 1 },
        p3: { id: 'p3', hand: [{ id: 'c3', known: false }], cardCount: 1 },
      },
    });
    expect(() => powerStepNeedsSkip(v, VIEWER)).not.toThrow();
    expect(() => powerActionCopy('LOOK_THEN_BLIND_SWAP', 1)).not.toThrow();
    expect(powerStepNeedsSkip(v, VIEWER)).toBe(false);
  });

  it('is true when Jack look has no opponent cards except the cambeo caller', () => {
    const v = view({
      phase: 'POWER_TARGETING',
      cambeoCallerId: OPP,
      pendingPower: {
        playerId: VIEWER,
        powerId: 'LOOK_THEN_BLIND_SWAP',
        stepIndex: 0,
        selections: [],
      },
      players: {
        [VIEWER]: { id: VIEWER, hand: [{ id: 'c1', known: false }], cardCount: 1 },
        [OPP]: { id: OPP, hand: [{ id: 'c2', known: false }], cardCount: 1 },
        p3: { id: 'p3', hand: [], cardCount: 0 },
      },
    });
    expect(powerStepNeedsSkip(v, VIEWER)).toBe(true);
  });

  it('is false when an opponent still has a card', () => {
    const v = view({
      phase: 'POWER_TARGETING',
      pendingPower: {
        playerId: VIEWER,
        powerId: 'LOOK_THEN_BLIND_SWAP',
        stepIndex: 0,
        selections: [],
      },
      players: {
        [VIEWER]: { id: VIEWER, hand: [{ id: 'c1', known: false }], cardCount: 1 },
        [OPP]: { id: OPP, hand: [{ id: 'c2', known: false }], cardCount: 1 },
        p3: { id: 'p3', hand: [], cardCount: 0 },
      },
    });
    expect(powerStepNeedsSkip(v, VIEWER)).toBe(false);
  });
});
