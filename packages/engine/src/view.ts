import { cardValue, type RedactedGameView, type SlotView, type RuleSet } from '@cambeo/shared';
import type { GameState, PlayerId } from './state.js';
import { getCard } from './setup.js';
import { knows } from './knowledge.js';

function slotView(state: GameState, viewerId: PlayerId, cardId: string, ruleSet: RuleSet): SlotView {
  if (knows(state, viewerId, cardId) || state.phase === 'SCORING' || state.phase === 'OVER') {
    const card = getCard(state, cardId);
    return {
      id: cardId,
      known: true,
      key: card.key,
      suit: card.suit,
      value: cardValue(ruleSet, card.key),
    };
  }
  return { id: cardId, known: false };
}

export function viewFor(
  state: GameState,
  viewerId: PlayerId,
  ruleSet: RuleSet,
): RedactedGameView {
  const players: RedactedGameView['players'] = {};
  for (const playerId of state.seating) {
    const hand = state.players[playerId]!.hand.map((cardId) =>
      slotView(state, viewerId, cardId, ruleSet),
    );
    players[playerId] = {
      id: playerId,
      hand,
      cardCount: hand.length,
    };
  }

  const discardTopId =
    state.discard.length > 0 ? state.discard[state.discard.length - 1]! : null;
  const discardTop = discardTopId
    ? (() => {
        const card = getCard(state, discardTopId);
        return {
          id: discardTopId,
          key: card.key,
          suit: card.suit,
          value: cardValue(ruleSet, card.key),
        };
      })()
    : null;

  let drawnCard: RedactedGameView['drawnCard'] = null;
  if (state.drawnCard && state.turn?.playerId === viewerId) {
    const card = getCard(state, state.drawnCard);
    drawnCard = {
      id: state.drawnCard,
      key: card.key,
      suit: card.suit,
      value: cardValue(ruleSet, card.key),
    };
  }

  return {
    viewerId,
    phase: state.phase,
    seating: [...state.seating],
    players,
    deckCount: state.deck.length,
    discardTop,
    discardCount: state.discard.length,
    turn: state.turn
      ? {
          playerId: state.turn.playerId,
          hasDrawn: state.turn.hasDrawn,
          drawnFrom: state.turn.drawnFrom,
        }
      : null,
    drawnCard,
    pendingPower: state.pendingPower
      ? {
          playerId: state.pendingPower.playerId,
          powerId: state.pendingPower.powerId,
          stepIndex: state.pendingPower.stepIndex,
        }
      : null,
    pendingGive: state.pendingGive
      ? {
          flipperId: state.pendingGive.flipperId,
          targetId: state.pendingGive.targetId,
        }
      : null,
    cambeoCallerId: state.cambeo?.callerId ?? null,
    finalRoundRemaining: [...state.finalRoundRemaining],
    overThreshold: [...state.overThreshold],
    result: state.result,
    ruleSet,
  };
}
