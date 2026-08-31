import type { RuleSet } from '@cambeo/shared';
import type { Action } from './actions.js';
import type { GameEvent } from './events.js';
import type { CardId, GameState, PlayerId } from './state.js';
import type { Rng } from './rng.js';
import { grantKnowledge, clearKnowledgeForCards } from './knowledge.js';
import { getCard, powerForCard, reject, withRng } from './setup.js';
import { advanceAfterTurnAction } from './cambeo.js';
import { maybeFlagLossThreshold } from './scoring.js';
import { specialCardHooks } from './extensions/heavenHell.js';
import { assertHellDiscardInvariant, canPlaceOnDiscard } from './jokers.js';

/**
 * Draw from deck. If deck is empty, reshuffle discard (keeping top) into deck.
 * If reshuffle is impossible (empty or single-card discard), reject.
 */
export function ensureDeckHasCard(
  state: GameState,
  rng: Rng,
): { state: GameState; events: GameEvent[]; ok: boolean; reason?: string } {
  if (state.deck.length > 0) {
    return { state, events: [], ok: true };
  }

  // Need at least 2 cards in discard to reshuffle (keep top, shuffle the rest).
  if (state.discard.length <= 1) {
    return {
      state,
      events: [],
      ok: false,
      reason:
        state.discard.length === 0
          ? 'Deck empty and discard empty; cannot draw'
          : 'Deck empty and discard has only one card; cannot reshuffle',
    };
  }

  const top = state.discard[state.discard.length - 1]!;
  const rest = state.discard.slice(0, -1);
  const shuffled = rng.shuffle(rest);
  const events: GameEvent[] = [
    { type: 'DECK_RESHUFFLED', newDeckCount: shuffled.length, discardTopId: top },
    { type: 'KNOWLEDGE_CLEARED', cardIds: [...rest] },
  ];

  let next = clearKnowledgeForCards(state, rest);
  next = {
    ...next,
    deck: shuffled,
    discard: [top],
  };
  return { state: next, events, ok: true };
}

export function drawFromDeck(
  state: GameState,
  rng: Rng,
): { state: GameState; events: GameEvent[]; cardId: CardId | null; ok: boolean; reason?: string } {
  const ensured = ensureDeckHasCard(state, rng);
  if (!ensured.ok) {
    return {
      state: ensured.state,
      events: ensured.events,
      cardId: null,
      ok: false,
      reason: ensured.reason,
    };
  }
  let next = ensured.state;
  const events = [...ensured.events];
  const cardId = next.deck[0]!;
  next = { ...next, deck: next.deck.slice(1) };
  return { state: next, events, cardId, ok: true };
}

export function drawDeck(
  state: GameState,
  action: Extract<Action, { type: 'DRAW_DECK' }>,
  _ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase === 'GIVE_CARD_PENDING') {
    return reject(state, action.playerId, 'DRAW_DECK', 'Must give a card first');
  }
  if (state.phase !== 'TURN_DRAW' && state.phase !== 'FINAL_ROUND') {
    return reject(state, action.playerId, 'DRAW_DECK', 'Not in draw phase');
  }
  if (!state.turn || state.turn.playerId !== action.playerId) {
    return reject(state, action.playerId, 'DRAW_DECK', 'Not your turn');
  }
  if (state.turn.hasDrawn) {
    return reject(state, action.playerId, 'DRAW_DECK', 'Already drawn');
  }

  const drawn = drawFromDeck(state, rng);
  if (!drawn.ok || !drawn.cardId) {
    return reject(state, action.playerId, 'DRAW_DECK', drawn.reason ?? 'Cannot draw');
  }

  let next = drawn.state;
  const events: GameEvent[] = [
    ...drawn.events,
    { type: 'CARD_DRAWN', playerId: action.playerId, from: 'DECK', cardId: drawn.cardId },
    { type: 'PHASE_CHANGED', from: state.phase, to: 'TURN_CHOICE' },
  ];

  next = grantKnowledge(next, action.playerId, [drawn.cardId]);
  next = {
    ...next,
    drawnCard: drawn.cardId,
    turn: { ...next.turn!, hasDrawn: true, drawnFrom: 'DECK' },
    phase: 'TURN_CHOICE',
  };

  return withRng(next, rng, events);
}

export function drawDiscard(
  state: GameState,
  action: Extract<Action, { type: 'DRAW_DISCARD' }>,
  _ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase === 'GIVE_CARD_PENDING') {
    return reject(state, action.playerId, 'DRAW_DISCARD', 'Must give a card first');
  }
  if (state.phase !== 'TURN_DRAW' && state.phase !== 'FINAL_ROUND') {
    return reject(state, action.playerId, 'DRAW_DISCARD', 'Not in draw phase');
  }
  if (!state.turn || state.turn.playerId !== action.playerId) {
    return reject(state, action.playerId, 'DRAW_DISCARD', 'Not your turn');
  }
  if (state.turn.hasDrawn) {
    return reject(state, action.playerId, 'DRAW_DISCARD', 'Already drawn');
  }
  if (state.discard.length === 0) {
    return reject(state, action.playerId, 'DRAW_DISCARD', 'Discard pile empty');
  }

  const cardId = state.discard[state.discard.length - 1]!;
  const discard = state.discard.slice(0, -1);
  const events: GameEvent[] = [
    { type: 'CARD_DRAWN', playerId: action.playerId, from: 'DISCARD', cardId },
    { type: 'PHASE_CHANGED', from: state.phase, to: 'TURN_CHOICE' },
  ];

  let next = grantKnowledge(state, action.playerId, [cardId]);
  next = {
    ...next,
    discard,
    drawnCard: cardId,
    turn: { ...next.turn!, hasDrawn: true, drawnFrom: 'DISCARD' },
    phase: 'TURN_CHOICE',
  };

  return withRng(next, rng, events);
}

export function discardDrawn(
  state: GameState,
  action: Extract<Action, { type: 'DISCARD_DRAWN' }>,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase === 'GIVE_CARD_PENDING') {
    return reject(state, action.playerId, 'DISCARD_DRAWN', 'Must give a card first');
  }
  if (state.phase !== 'TURN_CHOICE') {
    return reject(state, action.playerId, 'DISCARD_DRAWN', 'Not in choice phase');
  }
  if (!state.turn || state.turn.playerId !== action.playerId) {
    return reject(state, action.playerId, 'DISCARD_DRAWN', 'Not your turn');
  }
  if (!state.drawnCard) {
    return reject(state, action.playerId, 'DISCARD_DRAWN', 'No drawn card');
  }

  const card = getCard(state, state.drawnCard);
  const place = canPlaceOnDiscard(state, ruleSet, card.key);
  if (!place.ok) {
    return reject(state, action.playerId, 'DISCARD_DRAWN', place.reason);
  }

  // A card drawn from the discard pile can never be used for its power.
  const fromDiscard = state.turn.drawnFrom === 'DISCARD';
  const cardId = state.drawnCard;
  const { powerId, definition } = powerForCard(state, ruleSet, cardId);
  const triggersPower = !fromDiscard && powerId !== 'NONE' && definition.steps.length > 0;

  specialCardHooks.onPowerResolve(state, card.key, ruleSet, rng);

  const discard = [...state.discard, cardId];
  const events: GameEvent[] = [
    {
      type: 'CARD_DISCARDED',
      playerId: action.playerId,
      cardId,
      triggeredPower: triggersPower ? powerId : null,
    },
  ];

  let next: GameState = {
    ...state,
    discard,
    drawnCard: null,
    discardEpoch: state.discardEpoch + 1,
    flipWonForEpoch: null,
  };

  assertHellDiscardInvariant(next, ruleSet);

  // Discard top is public.
  for (const pid of state.seating) {
    next = grantKnowledge(next, pid, [cardId]);
  }

  if (triggersPower) {
    events.push({
      type: 'POWER_STARTED',
      playerId: action.playerId,
      powerId,
      sourceCardId: cardId,
    });
    events.push({ type: 'PHASE_CHANGED', from: 'TURN_CHOICE', to: 'POWER_TARGETING' });
    next = {
      ...next,
      phase: 'POWER_TARGETING',
      pendingPower: {
        playerId: action.playerId,
        powerId,
        sourceCardId: cardId,
        stepIndex: 0,
        selections: [],
      },
    };
    return withRng(next, rng, events);
  }

  next = { ...next, phase: 'TURN_DRAW' };
  return advanceAfterTurnAction(withRng(next, rng, events), ruleSet, rng);
}

export function replaceCard(
  state: GameState,
  action: Extract<Action, { type: 'REPLACE_CARD' }>,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase === 'GIVE_CARD_PENDING') {
    return reject(state, action.playerId, 'REPLACE_CARD', 'Must give a card first');
  }
  if (state.phase !== 'TURN_CHOICE') {
    return reject(state, action.playerId, 'REPLACE_CARD', 'Not in choice phase');
  }
  if (!state.turn || state.turn.playerId !== action.playerId) {
    return reject(state, action.playerId, 'REPLACE_CARD', 'Not your turn');
  }
  if (!state.drawnCard) {
    return reject(state, action.playerId, 'REPLACE_CARD', 'No drawn card');
  }

  const player = state.players[action.playerId];
  if (!player) {
    return reject(state, action.playerId, 'REPLACE_CARD', 'Unknown player');
  }
  if (action.slotIndex < 0 || action.slotIndex >= player.hand.length) {
    return reject(state, action.playerId, 'REPLACE_CARD', 'Invalid slot');
  }

  const oldCardId = player.hand[action.slotIndex]!;
  const oldCard = getCard(state, oldCardId);
  const place = canPlaceOnDiscard(state, ruleSet, oldCard.key);
  if (!place.ok) {
    return reject(state, action.playerId, 'REPLACE_CARD', place.reason);
  }

  const newCardId = state.drawnCard;
  const newHand = [...player.hand];
  newHand[action.slotIndex] = newCardId;

  const discard = [...state.discard, oldCardId];
  const events: GameEvent[] = [
    {
      type: 'CARD_REPLACED',
      playerId: action.playerId,
      newCardId,
      oldCardId,
      slotIndex: action.slotIndex,
    },
  ];

  let next: GameState = {
    ...state,
    players: {
      ...state.players,
      [action.playerId]: { ...player, hand: newHand },
    },
    discard,
    drawnCard: null,
    discardEpoch: state.discardEpoch + 1,
    flipWonForEpoch: null,
  };

  assertHellDiscardInvariant(next, ruleSet);

  next = grantKnowledge(next, action.playerId, [newCardId]);
  for (const pid of state.seating) {
    next = grantKnowledge(next, pid, [oldCardId]);
  }

  next = { ...next, phase: 'TURN_DRAW' };
  return advanceAfterTurnAction(withRng(next, rng, events), ruleSet, rng);
}

/**
 * Keep the drawn card in hand and end the turn without touching the discard pile.
 * Used when heaven is drawn during the final round and cannot be discarded/replaced away.
 */
export function keepDrawn(
  state: GameState,
  action: Extract<Action, { type: 'KEEP_DRAWN' }>,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase === 'GIVE_CARD_PENDING') {
    return reject(state, action.playerId, 'KEEP_DRAWN', 'Must give a card first');
  }
  if (state.phase !== 'TURN_CHOICE') {
    return reject(state, action.playerId, 'KEEP_DRAWN', 'Not in choice phase');
  }
  if (!state.turn || state.turn.playerId !== action.playerId) {
    return reject(state, action.playerId, 'KEEP_DRAWN', 'Not your turn');
  }
  if (!state.drawnCard) {
    return reject(state, action.playerId, 'KEEP_DRAWN', 'No drawn card');
  }

  const cardId = state.drawnCard;
  const added = addCardToHand(
    { ...state, drawnCard: null },
    action.playerId,
    cardId,
    ruleSet,
  );
  const events: GameEvent[] = [
    { type: 'CARD_KEPT', playerId: action.playerId, cardId },
  ];
  if (added.thresholdEvent) events.push(added.thresholdEvent);

  let next: GameState = {
    ...added.state,
    phase: 'TURN_DRAW',
  };
  next = grantKnowledge(next, action.playerId, [cardId]);
  return advanceAfterTurnAction(withRng(next, rng, events), ruleSet, rng);
}

export function addCardToHand(
  state: GameState,
  playerId: PlayerId,
  cardId: CardId,
  ruleSet: RuleSet,
): { state: GameState; thresholdEvent: import('./events.js').GameEvent | null } {
  const player = state.players[playerId]!;
  const withCard: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, hand: [...player.hand, cardId] },
    },
  };
  const flagged = maybeFlagLossThreshold(withCard, playerId, ruleSet);
  return { state: flagged.state, thresholdEvent: flagged.event };
}

export function removeCardFromHand(
  state: GameState,
  playerId: PlayerId,
  slotIndex: number,
): { state: GameState; cardId: CardId } {
  const player = state.players[playerId]!;
  const cardId = player.hand[slotIndex]!;
  const hand = [...player.hand.slice(0, slotIndex), ...player.hand.slice(slotIndex + 1)];
  return {
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: { ...player, hand },
      },
    },
    cardId,
  };
}

/**
 * Blind swap: exchange two card slots. Knowledge of both card ids is cleared
 * for everyone (spec: peeked cards stay known until swapped or discarded).
 */
export function swapSlots(
  state: GameState,
  a: { playerId: PlayerId; slotIndex: number },
  b: { playerId: PlayerId; slotIndex: number },
): GameState {
  const playerA = state.players[a.playerId]!;
  const playerB = state.players[b.playerId]!;
  const cardA = playerA.hand[a.slotIndex]!;
  const cardB = playerB.hand[b.slotIndex]!;

  let next: GameState;

  if (a.playerId === b.playerId) {
    const hand = [...playerA.hand];
    hand[a.slotIndex] = cardB;
    hand[b.slotIndex] = cardA;
    next = {
      ...state,
      players: {
        ...state.players,
        [a.playerId]: { ...playerA, hand },
      },
    };
  } else {
    const handA = [...playerA.hand];
    const handB = [...playerB.hand];
    handA[a.slotIndex] = cardB;
    handB[b.slotIndex] = cardA;
    next = {
      ...state,
      players: {
        ...state.players,
        [a.playerId]: { ...playerA, hand: handA },
        [b.playerId]: { ...playerB, hand: handB },
      },
    };
  }

  return clearKnowledgeForCards(next, [cardA, cardB]);
}
