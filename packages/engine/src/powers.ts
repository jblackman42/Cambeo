import { POWER_DEFINITIONS, type RuleSet } from '@cambeo/shared';
import type { Action } from './actions.js';
import type { GameEvent } from './events.js';
import type { GameState, PowerTarget } from './state.js';
import type { Rng } from './rng.js';
import { grantKnowledge, clearKnowledgeForCards } from './knowledge.js';
import { getCard, isCambeoCallerProtected, reject, withRng } from './setup.js';
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

  // Handle SKIP for optional steps
  if (action.target.kind === 'SKIP') {
    if (!step.optional) {
      return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Step is not optional');
    }
    events.push({ type: 'POWER_DECLINED_SWAP', playerId: action.playerId });
    return completePower(next, events, ruleSet, rng);
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
    // Shuffle destroys slot knowledge of those cards for everyone
    next = clearKnowledgeForCards(next, shuffled);
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

  const stepKind = step.kind as 'OWN_CARD' | 'OTHER_CARD' | 'ANY_CARD';
  const err = validateCardTarget(state, action.playerId, action.target, stepKind);
  if (err) {
    return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', err);
  }

  // Prevent selecting the same card twice in a swap
  if (step.effect === 'SELECT_FOR_SWAP') {
    const priorSwap = selections.filter((s) => s.kind === 'CARD');
    for (const s of priorSwap) {
      if (
        s.kind === 'CARD' &&
        s.playerId === action.target.playerId &&
        s.slotIndex === action.target.slotIndex
      ) {
        return reject(state, action.playerId, 'RESOLVE_POWER_TARGET', 'Cannot select same card twice');
      }
    }
  }

  selections.push(action.target);
  const cardId = next.players[action.target.playerId]!.hand[action.target.slotIndex]!;
  const card = getCard(next, cardId);

  if (step.effect === 'REVEAL') {
    next = grantKnowledge(next, action.playerId, [cardId]);
    events.push({
      type: 'POWER_REVEAL',
      playerId: action.playerId,
      targetPlayerId: action.target.playerId,
      slotIndex: action.target.slotIndex,
      cardId,
      key: card.key,
      suit: card.suit,
    });
    if (pending.powerId === 'LOOK_THEN_OPTIONAL_SWAP') {
      revealedForOptionalSwap.push({
        playerId: action.target.playerId,
        slotIndex: action.target.slotIndex,
      });
    }
  }

  const nextStepIndex = pending.stepIndex + 1;

  // If we just finished selecting the second swap target, execute the swap
  if (step.effect === 'SELECT_FOR_SWAP') {
    const swapSelections = selections.filter((s) => s.kind === 'CARD') as Array<
      Extract<PowerTarget, { kind: 'CARD' }>
    >;
    // Count only SELECT_FOR_SWAP steps completed — look at how many swap steps exist up to now
    const swapStepsSoFar = definition.steps
      .slice(0, nextStepIndex)
      .filter((s) => s.effect === 'SELECT_FOR_SWAP').length;

    if (swapStepsSoFar === 2 && swapSelections.length >= 2) {
      const a = swapSelections[swapSelections.length - 2]!;
      const b = swapSelections[swapSelections.length - 1]!;
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
