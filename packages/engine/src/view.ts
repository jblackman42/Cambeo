import {
  cardValue,
  type DrawnOptionsView,
  type GameEvent,
  type RedactedGameView,
  type SlotView,
  type RuleSet,
  type CardId,
} from '@cambeo/shared';
import type { GameState, PlayerId } from './state.js';
import { getCard } from './setup.js';
import { canPlaceOnDiscard } from './jokers.js';

function slotView(state: GameState, cardId: string, ruleSet: RuleSet): SlotView {
  if (state.phase === 'SCORING' || state.phase === 'OVER') {
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

/**
 * Which finishes are open to the player holding the drawn card. The client used to read the
 * drawn key to work this out; now that the key expires with the draw reveal, the engine has to
 * answer it. These are booleans about legality, never about identity: `canReplace` says a legal
 * slot exists, not which one.
 */
function drawnOptionsFor(
  state: GameState,
  playerId: PlayerId,
  ruleSet: RuleSet,
  drawnCardId: CardId,
): DrawnOptionsView {
  const drawn = getCard(state, drawnCardId);
  const hand = state.players[playerId]?.hand ?? [];
  return {
    canDiscard: canPlaceOnDiscard(state, ruleSet, drawn.key).ok,
    // Replacing puts the *old* card on the pile, so a hand of nothing but undiscardable cards
    // leaves no legal slot to swap into.
    canReplace: hand.some(
      (cardId) => canPlaceOnDiscard(state, ruleSet, getCard(state, cardId).key).ok,
    ),
    canKeep: true,
    fromDiscard: state.turn?.drawnFrom === 'DISCARD',
  };
}

/**
 * Strip face identities the viewer is not entitled to know.
 * Opaque card ids may remain (they already appear as hidden slots).
 */
export function redactEvents(
  state: GameState,
  viewerId: PlayerId,
  events: GameEvent[],
): GameEvent[] {
  return events.map((event) => redactEvent(viewerId, event));
}

function redactEvent(viewerId: PlayerId, event: GameEvent): GameEvent {
  switch (event.type) {
    case 'CARD_REVEALED': {
      if (event.revealedToPlayerId === viewerId) return event;
      return {
        type: 'CARD_REVEALED',
        cardId: event.cardId,
        ownerId: event.ownerId,
        slotIndex: event.slotIndex,
        revealedToPlayerId: event.revealedToPlayerId,
        kind: event.kind,
        durationMs: event.durationMs,
        ...(event.revealId !== undefined ? { revealId: event.revealId } : {}),
        ...(event.expiresAt !== undefined ? { expiresAt: event.expiresAt } : {}),
      };
    }
    case 'CARD_DRAWN': {
      if (event.playerId === viewerId) return event;
      return {
        type: 'CARD_DRAWN',
        playerId: event.playerId,
        from: event.from,
      };
    }
    default:
      return event;
  }
}

/** Identities a client is allowed to hold from this view (engine invariant). */
export function identitiesInView(view: RedactedGameView): Set<CardId> {
  const ids = new Set<CardId>();
  if (view.discardTop) ids.add(view.discardTop.id);
  if (view.phase === 'SCORING' || view.phase === 'OVER') {
    for (const player of Object.values(view.players)) {
      for (const slot of player.hand) {
        if (slot.known) ids.add(slot.id);
      }
    }
  }
  for (const event of view.lastEvents) {
    if (
      event.type === 'CARD_REVEALED' &&
      event.revealedToPlayerId === view.viewerId &&
      event.key !== undefined
    ) {
      ids.add(event.cardId);
    }
  }
  return ids;
}

export function assertViewIdentityInvariant(view: RedactedGameView): void {
  // The held card is a reveal like any other. If a face ever rides along on `drawnCard`, the
  // identity outlives its timer for the whole turn, which is the leak this model exists to close.
  if (view.drawnCard && 'key' in (view.drawnCard as object)) {
    throw new Error('INVARIANT: drawnCard carried a face key outside its draw reveal');
  }

  for (const player of Object.values(view.players)) {
    for (const slot of player.hand) {
      if (slot.known && view.phase !== 'SCORING' && view.phase !== 'OVER') {
        throw new Error(`INVARIANT: slot ${slot.id} is known outside scoring`);
      }
      if (!slot.known && 'key' in slot && (slot as { key?: string }).key) {
        throw new Error(`INVARIANT: hidden slot ${slot.id} leaked a key`);
      }
    }
  }

  // Any event carrying a face key is an identity channel. Only two are legitimate: a reveal
  // addressed to this viewer, and a card whose identity this view already makes public anyway
  // (the discard top, or every hand once scoring starts). Checking the whole event list rather
  // than CARD_REVEALED alone is what stops a new event type from quietly reopening the leak.
  const publiclyKnown = new Set<CardId>();
  if (view.discardTop) publiclyKnown.add(view.discardTop.id);
  if (view.phase === 'SCORING' || view.phase === 'OVER') {
    for (const player of Object.values(view.players)) {
      for (const slot of player.hand) publiclyKnown.add(slot.id);
    }
  }

  for (const event of view.lastEvents) {
    if (event.type === 'CARD_REVEALED') {
      if (event.key !== undefined && event.revealedToPlayerId !== view.viewerId) {
        throw new Error('INVARIANT: CARD_REVEALED identity leaked to another player');
      }
      continue;
    }
    const carried = event as { cardId?: CardId; key?: string };
    if (carried.key === undefined) continue;
    if (carried.cardId !== undefined && publiclyKnown.has(carried.cardId)) continue;
    throw new Error(
      `INVARIANT: ${event.type} carried a face key outside a reveal addressed to the viewer`,
    );
  }
}

export function viewFor(state: GameState, viewerId: PlayerId, ruleSet: RuleSet): RedactedGameView {
  const players: RedactedGameView['players'] = {};
  for (const playerId of state.seating) {
    const hand = state.players[playerId]!.hand.map((cardId) => slotView(state, cardId, ruleSet));
    players[playerId] = {
      id: playerId,
      hand,
      cardCount: hand.length,
    };
  }

  const discardTopId = state.discard.length > 0 ? state.discard[state.discard.length - 1]! : null;
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

  // The held card is projected without its face. Its identity travels only in the time-boxed
  // draw reveal, so the holder sees it briefly and then plays from memory like everyone else.
  let drawnCard: RedactedGameView['drawnCard'] = null;
  let drawnOptions: RedactedGameView['drawnOptions'] = null;
  if (state.drawnCard && state.turn?.playerId === viewerId) {
    drawnCard = { id: state.drawnCard };
    drawnOptions = drawnOptionsFor(state, viewerId, ruleSet, state.drawnCard);
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
    drawnOptions,
    pendingPower: state.pendingPower
      ? {
          playerId: state.pendingPower.playerId,
          powerId: state.pendingPower.powerId,
          stepIndex: state.pendingPower.stepIndex,
          selections: [...(state.pendingPower.selections ?? [])],
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
    ackedPeek: [...state.ackedPeek],
    lastEvents: redactEvents(state, viewerId, state.lastEvents),
  };
}
