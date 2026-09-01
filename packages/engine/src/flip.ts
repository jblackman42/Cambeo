import { matchKeyFor, type RuleSet } from '@cambeo/shared';
import type { Action } from './actions.js';
import type { GameEvent } from './events.js';
import type { GameState } from './state.js';
import type { Rng } from './rng.js';
import { getCard, isCambeoCallerProtected, reject, withRng } from './setup.js';
import { cardRevealedEvent } from './reveal.js';
import { addCardToHand, drawFromDeck, removeCardFromHand } from './turn.js';
import { specialCardHooks } from './extensions/heavenHell.js';
import {
  assertHellDiscardInvariant,
  canPlaceOnDiscard,
  hellFlipOntoDiscardLegal,
} from './jokers.js';

const FLIP_BLOCKED_PHASES = new Set(['SCORING', 'OVER', 'LOBBY', 'INITIAL_PEEK']);

function actorHasPendingAction(state: GameState, playerId: string): boolean {
  if (state.phase === 'GIVE_CARD_PENDING') {
    return state.pendingGive?.flipperId === playerId;
  }
  if (state.phase === 'POWER_TARGETING') {
    return state.pendingPower?.playerId === playerId;
  }
  if (state.turn?.playerId !== playerId) return false;
  if (state.phase === 'TURN_CHOICE') return true;
  if ((state.phase === 'TURN_DRAW' || state.phase === 'FINAL_ROUND') && !state.turn.hasDrawn) {
    return true;
  }
  return false;
}

export function flipAttempt(
  state: GameState,
  action: Extract<Action, { type: 'FLIP_ATTEMPT' }>,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (FLIP_BLOCKED_PHASES.has(state.phase)) {
    return reject(state, action.playerId, 'FLIP_ATTEMPT', `Flips not allowed in ${state.phase}`);
  }
  if (state.discard.length === 0) {
    return reject(state, action.playerId, 'FLIP_ATTEMPT', 'No discard to flip against');
  }

  if (state.cambeo && state.cambeo.callerId === action.playerId) {
    return reject(state, action.playerId, 'FLIP_ATTEMPT', 'Cambeo caller cannot flip');
  }

  if (isCambeoCallerProtected(state, action.target.playerId)) {
    return reject(state, action.playerId, 'FLIP_ATTEMPT', 'Cannot flip cambeo caller cards');
  }

  // Only one successful flip per discard. After success we lock the new epoch
  // until a turn-based discard opens a fresh window (flipWonForEpoch = null).
  if (state.flipWonForEpoch === state.discardEpoch) {
    return reject(state, action.playerId, 'FLIP_ATTEMPT', 'Flip already won for this discard');
  }

  // Flips are suppressed while you have a pending action of your own (draw,
  // choose, power targeting, or give-a-card). Other players may still flip.
  // This also covers "cannot flip on your own discard during your own turn."
  if (actorHasPendingAction(state, action.playerId)) {
    return reject(
      state,
      action.playerId,
      'FLIP_ATTEMPT',
      'Flips are suppressed while you have a pending action',
    );
  }

  const targetPlayer = state.players[action.target.playerId];
  if (!targetPlayer) {
    return reject(state, action.playerId, 'FLIP_ATTEMPT', 'Unknown target');
  }
  if (action.target.slotIndex < 0 || action.target.slotIndex >= targetPlayer.hand.length) {
    return reject(state, action.playerId, 'FLIP_ATTEMPT', 'Invalid slot');
  }

  const flippedCardId = targetPlayer.hand[action.target.slotIndex]!;
  const flippedCard = getCard(state, flippedCardId);
  const discardTopId = state.discard[state.discard.length - 1]!;
  const discardTop = getCard(state, discardTopId);

  specialCardHooks.onFlipAttempt(state, flippedCard.key, ruleSet, rng);

  const hellGate = hellFlipOntoDiscardLegal(state, ruleSet, flippedCard.key);
  if (!hellGate.ok) {
    return reject(state, action.playerId, 'FLIP_ATTEMPT', hellGate.reason);
  }

  const match = matchKeyFor(flippedCard.key) === matchKeyFor(discardTop.key);

  if (match) {
    // Successful flip places the card on discard — check place rules for heaven
    // (hell onto heaven is the exception allowed by canPlaceOnDiscard's flip path).
    if (flippedCard.key === 'HEAVEN') {
      const place = canPlaceOnDiscard(state, ruleSet, 'HEAVEN');
      if (!place.ok) {
        return reject(state, action.playerId, 'FLIP_ATTEMPT', place.reason);
      }
    }
    return resolveSuccessfulFlip(state, action, flippedCardId, ruleSet, rng);
  }
  return resolveFailedFlip(state, action, flippedCardId, ruleSet, rng);
}

function resolveSuccessfulFlip(
  state: GameState,
  action: Extract<Action, { type: 'FLIP_ATTEMPT' }>,
  flippedCardId: string,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  const events: GameEvent[] = [];
  const card = getCard(state, flippedCardId);
  events.push({
    type: 'FLIP_SUCCESS',
    playerId: action.playerId,
    targetPlayerId: action.target.playerId,
    slotIndex: action.target.slotIndex,
    cardId: flippedCardId,
    key: card.key,
  });

  const removed = removeCardFromHand(state, action.target.playerId, action.target.slotIndex);
  let next = removed.state;
  const newEpoch = state.discardEpoch + 1;
  // Lock this new discard so a second racing flip against the same match window fails.
  // Turn discards (discardDrawn / replace) set flipWonForEpoch = null when they open a window.
  next = {
    ...next,
    discard: [...state.discard, flippedCardId],
    discardEpoch: newEpoch,
    flipWonForEpoch: newEpoch,
  };

  assertHellDiscardInvariant(next, ruleSet);

  const isOwnCard = action.target.playerId === action.playerId;
  if (isOwnCard) {
    return withRng(next, rng, events);
  }

  // Correct flip on someone else's card: must give them a card
  const flipper = next.players[action.playerId]!;
  if (flipper.hand.length === 0) {
    const drawn = drawFromDeck(next, rng);
    events.push(...drawn.events);
    if (drawn.ok && drawn.cardId) {
      const added = addCardToHand(drawn.state, action.target.playerId, drawn.cardId, ruleSet);
      next = added.state;
      if (added.thresholdEvent) events.push(added.thresholdEvent);
      // Blind draw: unknown to new owner
      events.push({
        type: 'BLIND_DRAW_FOR_TARGET',
        targetId: action.target.playerId,
        cardId: drawn.cardId,
      });
      events.push({
        type: 'CARD_GIVEN',
        fromPlayerId: action.playerId,
        toPlayerId: action.target.playerId,
        cardId: drawn.cardId,
        blind: true,
      });
    } else {
      events.push({
        type: 'PENALTY_SKIPPED',
        playerId: action.target.playerId,
        reason: drawn.reason ?? 'No card available for blind draw',
      });
      next = drawn.state;
    }
    return withRng(next, rng, events);
  }

  events.push({
    type: 'GIVE_REQUIRED',
    flipperId: action.playerId,
    targetId: action.target.playerId,
  });
  events.push({
    type: 'PHASE_CHANGED',
    from: state.phase,
    to: 'GIVE_CARD_PENDING',
  });
  next = {
    ...next,
    phase: 'GIVE_CARD_PENDING',
    phaseBeforeGive: state.phase === 'GIVE_CARD_PENDING' ? state.phaseBeforeGive : state.phase,
    pendingGive: {
      flipperId: action.playerId,
      targetId: action.target.playerId,
      removedCardId: flippedCardId,
    },
  };
  return withRng(next, rng, events);
}

function resolveFailedFlip(
  state: GameState,
  action: Extract<Action, { type: 'FLIP_ATTEMPT' }>,
  flippedCardId: string,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  // A wrong flip turns the card face up for the whole table, then it goes back into the hand.
  // That is a reveal like any other, so it is time-boxed rather than carried on FLIP_FAIL: the
  // card stays in play, and a permanent identity on a public event is exactly the leak the
  // reveal model exists to prevent.
  const events: GameEvent[] = [
    {
      type: 'FLIP_FAIL',
      playerId: action.playerId,
      targetPlayerId: action.target.playerId,
      slotIndex: action.target.slotIndex,
      cardId: flippedCardId,
    },
    ...state.seating.map((viewerId) =>
      cardRevealedEvent(state, ruleSet, {
        revealedToPlayerId: viewerId,
        ownerId: action.target.playerId,
        slotIndex: action.target.slotIndex,
        cardId: flippedCardId,
        kind: 'FLIP_FAIL',
      }),
    ),
  ];

  let next = state;

  const drawn = drawFromDeck(next, rng);
  events.push(...drawn.events);
  if (drawn.ok && drawn.cardId) {
    const added = addCardToHand(drawn.state, action.playerId, drawn.cardId, ruleSet);
    next = added.state;
    events.push({ type: 'PENALTY_DRAWN', playerId: action.playerId, cardId: drawn.cardId });
    if (added.thresholdEvent) events.push(added.thresholdEvent);
  } else {
    events.push({
      type: 'PENALTY_SKIPPED',
      playerId: action.playerId,
      reason: drawn.reason ?? 'No card available',
    });
    next = drawn.state;
  }

  return withRng(next, rng, events);
}

export function giveCard(
  state: GameState,
  action: Extract<Action, { type: 'GIVE_CARD' }>,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase !== 'GIVE_CARD_PENDING' || !state.pendingGive) {
    return reject(state, action.playerId, 'GIVE_CARD', 'No give pending');
  }
  if (state.pendingGive.flipperId !== action.playerId) {
    return reject(state, action.playerId, 'GIVE_CARD', 'Not the flipper');
  }

  const flipper = state.players[action.playerId]!;
  if (action.slotIndex < 0 || action.slotIndex >= flipper.hand.length) {
    return reject(state, action.playerId, 'GIVE_CARD', 'Invalid slot');
  }

  const removed = removeCardFromHand(state, action.playerId, action.slotIndex);
  let next = removed.state;
  const cardId = removed.cardId;
  const targetId = state.pendingGive.targetId;

  const added = addCardToHand(next, targetId, cardId, ruleSet);
  next = added.state;

  // Blind give: target does not learn the card identity
  const events: GameEvent[] = [
    {
      type: 'CARD_GIVEN',
      fromPlayerId: action.playerId,
      toPlayerId: targetId,
      cardId,
      blind: true,
    },
    {
      type: 'PHASE_CHANGED',
      from: 'GIVE_CARD_PENDING',
      to: state.phaseBeforeGive ?? 'TURN_DRAW',
    },
  ];
  if (added.thresholdEvent) events.push(added.thresholdEvent);

  const restorePhase = state.phaseBeforeGive ?? 'TURN_DRAW';
  next = {
    ...next,
    phase: restorePhase,
    phaseBeforeGive: null,
    pendingGive: null,
  };

  return withRng(next, rng, events);
}
