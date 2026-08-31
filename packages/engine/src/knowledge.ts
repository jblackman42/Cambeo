import type { CardId, GameState, PlayerId } from './state.js';

export function emptyKnowledge(playerIds: PlayerId[]): Record<PlayerId, Record<CardId, true>> {
  const knowledge: Record<PlayerId, Record<CardId, true>> = {};
  for (const id of playerIds) {
    knowledge[id] = {};
  }
  return knowledge;
}

export function knows(state: GameState, playerId: PlayerId, cardId: CardId): boolean {
  return state.knowledge[playerId]?.[cardId] === true;
}

export function grantKnowledge(
  state: GameState,
  playerId: PlayerId,
  cardIds: CardId[],
): GameState {
  const prior = state.knowledge[playerId] ?? {};
  const next: Record<CardId, true> = { ...prior };
  for (const id of cardIds) {
    next[id] = true;
  }
  return {
    ...state,
    knowledge: {
      ...state.knowledge,
      [playerId]: next,
    },
  };
}

export function grantKnowledgeToAll(state: GameState, cardIds: CardId[]): GameState {
  let next = state;
  for (const playerId of state.seating) {
    next = grantKnowledge(next, playerId, cardIds);
  }
  return next;
}

/** Remove knowledge of specific cards from one player. */
export function revokeKnowledge(
  state: GameState,
  playerId: PlayerId,
  cardIds: CardId[],
): GameState {
  const prior = state.knowledge[playerId] ?? {};
  const next: Record<CardId, true> = { ...prior };
  for (const id of cardIds) {
    delete next[id];
  }
  return {
    ...state,
    knowledge: {
      ...state.knowledge,
      [playerId]: next,
    },
  };
}

/** Clear knowledge of these cards for every player. Used on reshuffle / discard. */
export function clearKnowledgeForCards(state: GameState, cardIds: CardId[]): GameState {
  const clearSet = new Set(cardIds);
  const knowledge: Record<PlayerId, Record<CardId, true>> = {};
  for (const playerId of state.seating) {
    const prior = state.knowledge[playerId] ?? {};
    const next: Record<CardId, true> = {};
    for (const [id, v] of Object.entries(prior)) {
      if (!clearSet.has(id)) {
        next[id] = v;
      }
    }
    knowledge[playerId] = next;
  }
  return { ...state, knowledge };
}
