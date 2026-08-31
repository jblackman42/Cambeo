import {
  HOUSE_RULES,
  type CardKey,
  type RuleSet,
  type Suit,
} from '@cambeo/shared';
import {
  createGame,
  createRng,
  reduce,
  type Action,
  type GameState,
  type PlayerId,
  type CardId,
  type Rng,
} from './index.js';

export const P1 = 'p1';
export const P2 = 'p2';
export const P3 = 'p3';
export const DEFAULT_PLAYERS = [P1, P2, P3];

export function apply(
  state: GameState,
  action: Action,
  ruleSet: RuleSet = HOUSE_RULES,
  rng?: Rng,
): GameState {
  const r = rng ?? createRng(state.seed, state.rngState);
  return reduce(state, action, ruleSet, r);
}

export function applyAll(
  state: GameState,
  actions: Action[],
  ruleSet: RuleSet = HOUSE_RULES,
): GameState {
  let s = state;
  for (const action of actions) {
    s = apply(s, action, ruleSet);
  }
  return s;
}

export function rejected(state: GameState): boolean {
  return state.lastEvents.some((e) => e.type === 'ACTION_REJECTED');
}

export function hasEvent(state: GameState, type: string): boolean {
  return state.lastEvents.some((e) => e.type === type);
}

/** Start a game and ack all peeks so play begins on P1's turn. */
export function startPlaying(
  players: PlayerId[] = DEFAULT_PLAYERS,
  seed = 'test-seed',
  ruleSet: RuleSet = HOUSE_RULES,
): GameState {
  let state = createGame(players, seed, ruleSet);
  state = apply(state, { type: 'START_GAME', playerId: players[0]! }, ruleSet);
  for (const p of players) {
    state = apply(state, { type: 'ACK_PEEK', playerId: p }, ruleSet);
  }
  return state;
}

export interface StackedCard {
  key: CardKey;
  suit?: Suit;
}

/**
 * Build a deterministic game by replacing the dealt deck/hands with a stacked
 * arrangement. Call after START_GAME (or use startStacked).
 *
 * `hands[playerId]` — cards in hand order.
 * `deck` — draw order (index 0 = next draw).
 * `discard` — bottom-to-top (last = top).
 */
export function stackState(
  state: GameState,
  opts: {
    hands: Record<PlayerId, StackedCard[]>;
    deck?: StackedCard[];
    discard?: StackedCard[];
    phase?: GameState['phase'];
    turnPlayerId?: PlayerId;
    knowledge?: Record<PlayerId, CardId[]>;
    clearKnowledge?: boolean;
  },
): GameState {
  const cards: GameState['cards'] = {};
  const players: GameState['players'] = {};
  let seq = 0;

  const make = (c: StackedCard): CardId => {
    const id = `s${seq++}`;
    const suit =
      c.suit ??
      (c.key === 'HEAVEN' || c.key === 'HELL'
        ? 'joker'
        : c.key.endsWith('_RED')
          ? 'hearts'
          : c.key.endsWith('_BLACK')
            ? 'spades'
            : 'clubs');
    cards[id] = { id, key: c.key, suit };
    return id;
  };

  for (const playerId of state.seating) {
    const handSpec = opts.hands[playerId] ?? [];
    players[playerId] = {
      id: playerId,
      hand: handSpec.map(make),
    };
  }

  const deck = (opts.deck ?? []).map(make);
  const discard = (opts.discard ?? []).map(make);

  const knowledge = opts.clearKnowledge
    ? Object.fromEntries(state.seating.map((id) => [id, {} as Record<CardId, true>]))
    : { ...state.knowledge };

  // Ensure knowledge maps exist for all players
  for (const pid of state.seating) {
    knowledge[pid] = { ...(knowledge[pid] ?? {}) };
  }

  if (opts.knowledge) {
    for (const [pid, cardIds] of Object.entries(opts.knowledge)) {
      const map = { ...(knowledge[pid] ?? {}) };
      for (const id of cardIds) {
        map[id] = true;
      }
      knowledge[pid] = map;
    }
  }

  // Discard top is public
  if (discard.length > 0) {
    const top = discard[discard.length - 1]!;
    for (const pid of state.seating) {
      knowledge[pid] = { ...knowledge[pid], [top]: true };
    }
  }

  return {
    ...state,
    cards: { ...state.cards, ...cards },
    players,
    deck,
    discard,
    discardEpoch: discard.length > 0 ? state.discardEpoch + 1 : state.discardEpoch,
    flipWonForEpoch: null,
    phase: opts.phase ?? state.phase,
    turn: opts.turnPlayerId
      ? { playerId: opts.turnPlayerId, hasDrawn: false, drawnFrom: null }
      : state.turn,
    drawnCard: null,
    pendingPower: null,
    pendingGive: null,
    knowledge,
  };
}

export function startStacked(
  opts: {
    hands: Record<PlayerId, StackedCard[]>;
    deck?: StackedCard[];
    discard?: StackedCard[];
    knowledge?: Record<PlayerId, 'initial' | CardId[]>;
    players?: PlayerId[];
    seed?: string;
    ruleSet?: RuleSet;
  },
): GameState {
  const players = opts.players ?? DEFAULT_PLAYERS;
  const ruleSet = opts.ruleSet ?? HOUSE_RULES;
  let state = startPlaying(players, opts.seed ?? 'stacked', ruleSet);
  state = stackState(state, {
    hands: opts.hands,
    deck: opts.deck,
    discard: opts.discard,
    clearKnowledge: true,
    phase: 'TURN_DRAW',
    turnPlayerId: players[0],
  });

  // Grant initial-style knowledge: first N cards per hand known to owner
  const knowledge = { ...state.knowledge };
  for (const pid of players) {
    const hand = state.players[pid]!.hand;
    const known: Record<CardId, true> = {};
    for (let i = 0; i < Math.min(ruleSet.initialRevealCount, hand.length); i++) {
      known[hand[i]!] = true;
    }
    // discard top
    if (state.discard.length > 0) {
      known[state.discard[state.discard.length - 1]!] = true;
    }
    knowledge[pid] = known;
  }
  return { ...state, knowledge };
}

export function findSlot(
  state: GameState,
  playerId: PlayerId,
  key: CardKey,
): number {
  const hand = state.players[playerId]!.hand;
  return hand.findIndex((id) => state.cards[id]?.key === key);
}

export function cardKeyAt(
  state: GameState,
  playerId: PlayerId,
  slotIndex: number,
): CardKey {
  const id = state.players[playerId]!.hand[slotIndex]!;
  return state.cards[id]!.key;
}

export function invertHouseRules(): RuleSet {
  return {
    ...HOUSE_RULES,
    values: {
      ...HOUSE_RULES.values,
      HEAVEN: 4,
      HELL: -15,
    },
    powers: {
      ...HOUSE_RULES.powers,
      A: 'PEEK_OWN',
      '6': 'NONE',
      '7': 'NONE',
    },
    handSize: 6,
    initialRevealCount: 2,
    lossThreshold: 8,
    minPlayers: 4,
  };
}
