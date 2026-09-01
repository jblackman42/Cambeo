import {
  POWER_DEFINITIONS,
  cardTargetsForEffect,
  powerStepLacksLegalTarget,
  type PowerStep,
  type RuleSet,
} from '@cambeo/shared';
import type { Action } from './actions.js';
import type { GameEvent } from './events.js';
import type { GameState, PendingPower, PowerTarget } from './state.js';
import type { Rng } from './rng.js';
import { cardRevealedEvent } from './reveal.js';
import { isCambeoCallerProtected, reject, withRng } from './setup.js';
import { swapSlots } from './turn.js';
import { advanceAfterTurnAction } from './cambeo.js';

function validateCardTarget(
  state: GameState,
  actorId: string,
  target: Extract<PowerTarget, { kind: 'CARD' }>,
  stepKind: 'OWN_CARD' | 'OTHER_CARD' | 'ANY_CARD',
): string | null {
  if (!state.seating.includes(target.playerId)) return 'Unknown target player';
  if (isCambeoCallerProtected(state, target.playerId) && target.playerId !== actorId) {
    return 'Cannot target cambeo caller';
  }
  const hand = state.players[target.playerId]?.hand;
  if (!hand || target.slotIndex < 0 || target.slotIndex >= hand.length) {
    return 'Invalid slot';
  }
  if (stepKind === 'OWN_CARD' && target.playerId !== actorId) {
    return 'Must target own card';
  }
  if (stepKind === 'OTHER_CARD' && target.playerId === actorId) {
    return 'Must target another player card';
  }
  return null;
}

function stepLacksLegalTarget(state: GameState, pending: PendingPower, stepIndex: number): boolean {
  return powerStepLacksLegalTarget({
    powerId: pending.powerId,
    stepIndex,
    selections: pending.selections,
    actorId: pending.playerId,
    cambeoCallerId: state.cambeo?.callerId ?? null,
    seating: state.seating,
    cardCount: (id) => state.players[id]?.hand.length ?? 0,
  });
}

function sameCard(
  a: { playerId: string; slotIndex: number },
  b: { playerId: string; slotIndex: number },
): boolean {
  return a.playerId === b.playerId && a.slotIndex === b.slotIndex;
}

/**
 * Skip the current step and any following steps that also have no legal target.
 * A skipped look proceeds to swap; a skipped swap completes the power without swapping.
 */
function skipImpossibleSteps(
  state: GameState,
  events: GameEvent[],
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  const next = state;
  const pending = next.pendingPower;
  if (!pending) return completePower(next, events, ruleSet, rng);

  const definition = POWER_DEFINITIONS[pending.powerId];
  let stepIndex = pending.stepIndex;
  const selections = [...pending.selections];
  const revealedForOptionalSwap = pending.revealedForOptionalSwap
    ? [...pending.revealedForOptionalSwap]
    : [];

  while (stepIndex < definition.steps.length) {
    const hypothetical: PendingPower = {
      ...pending,
      stepIndex,
      selections,
      revealedForOptionalSwap,
    };
    if (!stepLacksLegalTarget(next, hypothetical, stepIndex)) {
      return withRng(
        {
          ...next,
          pendingPower: hypothetical,
        },
        rng,
        events,
      );
    }

    const step = definition.steps[stepIndex]!;
    events.push({
      type: 'POWER_STEP_SKIPPED',
      playerId: pending.playerId,
      powerId: pending.powerId,
      stepIndex,
      reason: 'No legal target',
    });

    if (shouldAbortPowerOnSkip(definition.steps, stepIndex, step)) {
      return completePower(
        {
          ...next,
          pendingPower: { ...hypothetical, stepIndex, selections, revealedForOptionalSwap },
        },
        events,
        ruleSet,
        rng,
      );
    }

    selections.push({ kind: 'SKIP' });
    stepIndex += 1;
  }

  return completePower(
    {
      ...next,
      pendingPower: {
        ...pending,
        stepIndex,
        selections,
        revealedForOptionalSwap,
      },
    },
    events,
    ruleSet,
    rng,
  );
}

function shouldAbortPowerOnSkip(
  steps: readonly PowerStep[],
  stepIndex: number,
  step: PowerStep,
): boolean {
  if (step.effect === 'SELECT_FOR_SWAP' || step.effect === 'SHUFFLE' || step.effect === 'CONFIRM_SWAP') {
    return true;
  }
  if (step.effect === 'REVEAL') {
    return steps.slice(stepIndex + 1).some((s) => s.effect === 'CONFIRM_SWAP');
  }
  return false;
}

export function resolvePowerTarget(
  state: GameState,
  action: Extract<Action, { type: 'RESOLVE_POWER_TARGET' }>,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase === 'GIVE_CARD_PENDING') {
    return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Must give a card first');
  }
  if (state.phase !== 'POWER_TARGETING' || !state.pendingPower) {
    return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'No power pending');
  }
  if (state.pendingPower.playerId !== action.playerId) {
    return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Not your power');
  }

  const pending = state.pendingPower;
  const definition = POWER_DEFINITIONS[pending.powerId];
  const step = definition.steps[pending.stepIndex];
  if (!step) {
    return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Power already complete');
  }

  const events: GameEvent[] = [
    { type: 'POWER_TARGET_ACCEPTED', playerId: action.playerId, target: action.target },
  ];
  let next = state;
  const selections = [...pending.selections];
  const revealedForOptionalSwap = pending.revealedForOptionalSwap
    ? [...pending.revealedForOptionalSwap]
    : [];

  if (action.target.kind === 'SKIP') {
    const canSkip = step.optional === true || stepLacksLegalTarget(state, pending, pending.stepIndex);
    if (!canSkip) {
      return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Step is not optional');
    }
    if (step.optional) {
      events.push({ type: 'POWER_DECLINED_SWAP', playerId: action.playerId });
      return completePower(next, events, ruleSet, rng);
    }
    return skipImpossibleSteps(next, events, ruleSet, rng);
  }

  if (step.kind === 'CONFIRM' || step.effect === 'CONFIRM_SWAP') {
    if (action.target.kind !== 'CONFIRM') {
      return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Expected confirm');
    }
    if (action.target.swap) {
      if (revealedForOptionalSwap.length !== 2) {
        return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Missing reveal targets');
      }
      const [a, b] = revealedForOptionalSwap;
      next = swapSlots(next, a!, b!);
      const cardA = next.players[a!.playerId]!.hand[a!.slotIndex]!;
      const cardB = next.players[b!.playerId]!.hand[b!.slotIndex]!;
      // After swap the cards moved; report original selections
      events.push({
        type: 'POWER_SWAP',
        playerId: action.playerId,
        a: { ...a!, cardId: cardB },
        b: { ...b!, cardId: cardA },
      });
    } else {
      events.push({ type: 'POWER_DECLINED_SWAP', playerId: action.playerId });
    }
    return completePower(next, events, ruleSet, rng);
  }

  if (step.kind === 'ANY_PLAYER' || step.effect === 'SHUFFLE') {
    if (action.target.kind !== 'PLAYER') {
      return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Expected player target');
    }
    if (!state.seating.includes(action.target.playerId)) {
      return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Unknown player');
    }
    if (isCambeoCallerProtected(state, action.target.playerId)) {
      return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Cannot target cambeo caller');
    }
    const targetPlayer = next.players[action.target.playerId]!;
    const shuffled = rng.shuffle([...targetPlayer.hand]);
    next = {
      ...next,
      players: {
        ...next.players,
        [action.target.playerId]: { ...targetPlayer, hand: shuffled },
      },
    };
    events.push({
      type: 'POWER_SHUFFLE',
      playerId: action.playerId,
      targetPlayerId: action.target.playerId,
      newOrder: shuffled,
    });
    selections.push(action.target);
    return completePower(next, events, ruleSet, rng);
  }

  // Card-targeting steps
  if (action.target.kind !== 'CARD') {
    return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Expected card target');
  }

  const cardTarget = action.target;
  const stepKind = step.kind as 'OWN_CARD' | 'OTHER_CARD' | 'ANY_CARD';
  const err = validateCardTarget(state, action.playerId, cardTarget, stepKind);
  if (err) {
    return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', err);
  }

  // Only swap picks collide with each other. A LOOK_THEN_BLIND_SWAP peek is
  // not a swap selection — that card may be one of the two swapped afterwards.
  if (step.effect === 'SELECT_FOR_SWAP') {
    const priorSwap = cardTargetsForEffect(pending.powerId, selections, 'SELECT_FOR_SWAP');
    if (priorSwap.some((s) => sameCard(s, cardTarget))) {
      return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Cannot select same card twice');
    }
  }

  selections.push(cardTarget);
  const cardId = next.players[cardTarget.playerId]!.hand[cardTarget.slotIndex]!;

  if (step.effect === 'REVEAL') {
    events.push(
      cardRevealedEvent(next, ruleSet, {
        revealedToPlayerId: action.playerId,
        ownerId: cardTarget.playerId,
        slotIndex: cardTarget.slotIndex,
        cardId,
        kind: 'POWER',
      }),
    );
    if (pending.powerId === 'LOOK_THEN_OPTIONAL_SWAP') {
      revealedForOptionalSwap.push({
        playerId: cardTarget.playerId,
        slotIndex: cardTarget.slotIndex,
      });
    }
  }

  const nextStepIndex = pending.stepIndex + 1;

  if (step.effect === 'SELECT_FOR_SWAP') {
    const swapSelections = cardTargetsForEffect(pending.powerId, selections, 'SELECT_FOR_SWAP');
    const swapStepsSoFar = definition.steps
      .slice(0, nextStepIndex)
      .filter((s) => s.effect === 'SELECT_FOR_SWAP').length;

    if (swapStepsSoFar === 2 && swapSelections.length === 2) {
      const a = swapSelections[0]!;
      const b = swapSelections[1]!;
      const cardABefore = next.players[a.playerId]!.hand[a.slotIndex]!;
      const cardBBefore = next.players[b.playerId]!.hand[b.slotIndex]!;
      next = swapSlots(next, a, b);
      events.push({
        type: 'POWER_SWAP',
        playerId: action.playerId,
        a: { playerId: a.playerId, slotIndex: a.slotIndex, cardId: cardABefore },
        b: { playerId: b.playerId, slotIndex: b.slotIndex, cardId: cardBBefore },
      });
    }
  }

  if (nextStepIndex >= definition.steps.length) {
    return completePower(
      {
        ...next,
        pendingPower: {
          ...pending,
          stepIndex: nextStepIndex,
          selections,
          revealedForOptionalSwap,
        },
      },
      events,
      ruleSet,
      rng,
    );
  }

  next = {
    ...next,
    pendingPower: {
      ...pending,
      stepIndex: nextStepIndex,
      selections,
      revealedForOptionalSwap,
    },
  };
  return withRng(next, rng, events);
}

function completePower(
  state: GameState,
  events: GameEvent[],
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  const powerId = state.pendingPower?.powerId;
  if (powerId) {
    events.push({
      type: 'POWER_COMPLETED',
      playerId: state.pendingPower!.playerId,
      powerId,
    });
  }
  events.push({ type: 'PHASE_CHANGED', from: 'POWER_TARGETING', to: 'TURN_DRAW' });
  const next: GameState = {
    ...state,
    pendingPower: null,
    phase: 'TURN_DRAW',
  };
  return advanceAfterTurnAction(withRng(next, rng, events), ruleSet, rng);
}
