import {
  deckComposition,
  type RuleSet,
  validateForTable,
  cardPower,
  POWER_DEFINITIONS,
} from '@cambeo/shared';
import type { Action } from './actions.js';
import type { GameEvent } from './events.js';
import type { GameState, Card, CardId, PlayerId } from './state.js';
import { createRng, type Rng } from './rng.js';
import { cardRevealedEvent } from './reveal.js';

export function createGame(
  playerIds: PlayerId[],
  seed: string,
  _ruleSet?: RuleSet,
): GameState {
  const rng = createRng(seed);
  return {
    seed,
    rngState: rng.getState(),
    phase: 'LOBBY',
    phaseBeforeGive: null,
    seating: [...playerIds],
    players: Object.fromEntries(playerIds.map((id) => [id, { id, hand: [] }])),
    cards: {},
    deck: [],
    discard: [],
    discardEpoch: 0,
    flipWonForEpoch: null,
    turn: null,
    drawnCard: null,
    pendingPower: null,
    pendingGive: null,
    cambeo: null,
    finalRoundRemaining: [],
    ackedPeek: [],
    overThreshold: [],
    result: null,
    lastEvents: [],
  };
}

function buildDeck(ruleSet: RuleSet, rng: Rng): { cards: Record<CardId, Card>; deck: CardId[] } {
  const composition = deckComposition(ruleSet.jokers);
  const cards: Record<CardId, Card> = {};
  const ids: CardId[] = [];
  let seq = 0;
  for (const slot of composition) {
    for (const suit of slot.suits) {
      const id = `c${seq++}`;
      cards[id] = { id, key: slot.key, suit };
      ids.push(id);
    }
  }
  return { cards, deck: rng.shuffle(ids) };
}

export function startGame(
  state: GameState,
  action: Extract<Action, { type: 'START_GAME' }>,
  ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase !== 'LOBBY') {
    return reject(state, action.playerId, 'START_GAME', 'Not in lobby');
  }

  const validation = validateForTable(ruleSet, state.seating.length);
  if (!validation.ok) {
    return reject(state, action.playerId, 'START_GAME', validation.errors.join('; '));
  }

  const { cards, deck: shuffled } = buildDeck(ruleSet, rng);
  const deck = [...shuffled];
  const players: GameState['players'] = {};
  const events: GameEvent[] = [
    { type: 'GAME_STARTED', seating: [...state.seating] },
    { type: 'PHASE_CHANGED', from: 'LOBBY', to: 'INITIAL_PEEK' },
  ];

  const dealtState: GameState = {
    ...state,
    cards,
  };

  for (const playerId of state.seating) {
    const hand: CardId[] = [];
    for (let i = 0; i < ruleSet.handSize; i++) {
      const cardId = deck.shift();
      if (!cardId) {
        return reject(state, action.playerId, 'START_GAME', 'Deck exhausted during deal');
      }
      hand.push(cardId);
    }
    players[playerId] = { id: playerId, hand };
    events.push({ type: 'DEALT', playerId, cardIds: [...hand] });

    const peekCount = Math.min(ruleSet.initialRevealCount, hand.length);
    for (let slotIndex = 0; slotIndex < peekCount; slotIndex++) {
      events.push(
        cardRevealedEvent(dealtState, ruleSet, {
          revealedToPlayerId: playerId,
          ownerId: playerId,
          slotIndex,
          cardId: hand[slotIndex]!,
          kind: 'INITIAL_PEEK',
        }),
      );
    }
  }

  return {
    ...dealtState,
    phase: 'INITIAL_PEEK',
    phaseBeforeGive: null,
    players,
    deck,
    discard: [],
    discardEpoch: 0,
    flipWonForEpoch: null,
    turn: null,
    drawnCard: null,
    pendingPower: null,
    pendingGive: null,
    cambeo: null,
    finalRoundRemaining: [],
    ackedPeek: [],
    overThreshold: [],
    result: null,
    rngState: rng.getState(),
    lastEvents: events,
  };
}

export function ackPeek(
  state: GameState,
  action: Extract<Action, { type: 'ACK_PEEK' }>,
  _ruleSet: RuleSet,
  rng: Rng,
): GameState {
  if (state.phase !== 'INITIAL_PEEK') {
    return reject(state, action.playerId, 'ACK_PEEK', 'Not in initial peek');
  }
  if (!state.seating.includes(action.playerId)) {
    return reject(state, action.playerId, 'ACK_PEEK', 'Unknown player');
  }
  if (state.ackedPeek.includes(action.playerId)) {
    return reject(state, action.playerId, 'ACK_PEEK', 'Already acked');
  }

  const ackedPeek = [...state.ackedPeek, action.playerId];
  const events: GameEvent[] = [{ type: 'PEEK_ACKED', playerId: action.playerId }];

  if (ackedPeek.length < state.seating.length) {
    return {
      ...state,
      ackedPeek,
      rngState: rng.getState(),
      lastEvents: events,
    };
  }

  const firstPlayer = state.seating[0]!;
  events.push({ type: 'PHASE_CHANGED', from: 'INITIAL_PEEK', to: 'TURN_DRAW' });
  events.push({ type: 'TURN_STARTED', playerId: firstPlayer });

  return {
    ...state,
    ackedPeek,
    phase: 'TURN_DRAW',
    turn: { playerId: firstPlayer, hasDrawn: false, drawnFrom: null },
    rngState: rng.getState(),
    lastEvents: events,
  };
}

export function reject(
  state: GameState,
  playerId: PlayerId,
  actionType: string,
  reason: string,
): GameState {
  return {
    ...state,
    lastEvents: [{ type: 'ACTION_REJECTED', playerId, actionType, reason }],
  };
}

/** Sync rng cursor onto state after mutation. */
export function withRng(state: GameState, rng: Rng, events: GameEvent[]): GameState {
  return { ...state, rngState: rng.getState(), lastEvents: events };
}

export function getCard(state: GameState, cardId: CardId): Card {
  const card = state.cards[cardId];
  if (!card) throw new Error(`Unknown card ${cardId}`);
  return card;
}

export function isCambeoCallerProtected(state: GameState, playerId: PlayerId): boolean {
  return state.cambeo !== null && state.cambeo.callerId === playerId;
}

export function powerForCard(state: GameState, ruleSet: RuleSet, cardId: CardId) {
  const card = getCard(state, cardId);
  const powerId = cardPower(ruleSet, card.key);
  return { powerId, definition: POWER_DEFINITIONS[powerId] };
}
