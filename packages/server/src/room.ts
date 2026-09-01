import type { Action, ClientMessage, PlayerId, RedactedGameView, RoomErrorCode, RoomView, RuleSet, ServerMessage } from '@cambeo/shared';
import { HOUSE_RULES, tryParseClientMessage, type GameEvent } from '@cambeo/shared';
import { createGame, createRng, reduce, viewFor, type GameState } from '@cambeo/engine';
import { disconnectAction, nextTimeoutTarget } from './timeout.js';

export interface RoomPlayer {
  playerId: PlayerId;
  name: string;
  lastSeenAt: number;
}

export interface SerializedRoom {
  roomCode: string;
  hostId: PlayerId | null;
  ruleSet: RuleSet;
  turnTimeoutMs: number;
  seq: number;
  players: RoomPlayer[];
  game: GameState | null;
  seed: string | null;
  turnDeadline: { playerId: PlayerId; at: number } | null;
}

export interface RoomDeps {
  now: () => number;
  randomId: () => string;
  randomSeed: () => string;
}

export interface Outbound {
  connId: string;
  message: ServerMessage;
}

export interface HandleResult {
  outbound: Outbound[];
  alarmAt: number | null;
  persist: boolean;
}

export class RoomController {
  readonly roomCode: string;
  ruleSet: RuleSet;
  readonly turnTimeoutMs: number;
  private readonly deps: RoomDeps;

  hostId: PlayerId | null = null;
  seq = 0;
  players: RoomPlayer[] = [];
  game: GameState | null = null;
  seed: string | null = null;
  turnDeadline: { playerId: PlayerId; at: number } | null = null;

  private readonly conns = new Map<string, { playerId: PlayerId | null }>();

  constructor(
    roomCode: string,
    deps: RoomDeps,
    opts?: { ruleSet?: RuleSet; turnTimeoutMs?: number },
  ) {
    this.roomCode = roomCode;
    this.deps = deps;
    this.ruleSet = opts?.ruleSet ?? HOUSE_RULES;
    this.turnTimeoutMs = opts?.turnTimeoutMs ?? 45_000;
  }

  static deserialize(data: SerializedRoom, deps: RoomDeps): RoomController {
    const room = new RoomController(data.roomCode, deps, {
      ruleSet: data.ruleSet,
      turnTimeoutMs: data.turnTimeoutMs,
    });
    room.hostId = data.hostId;
    room.seq = data.seq;
    room.players = data.players.map((p) => ({ ...p }));
    room.game = data.game;
    room.seed = data.seed;
    room.turnDeadline = data.turnDeadline;
    return room;
  }

  serialize(): SerializedRoom {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      ruleSet: this.ruleSet,
      turnTimeoutMs: this.turnTimeoutMs,
      seq: this.seq,
      players: this.players.map((p) => ({ ...p })),
      game: this.game,
      seed: this.seed,
      turnDeadline: this.turnDeadline,
    };
  }

  handleConnect(connId: string): HandleResult {
    this.conns.set(connId, { playerId: null });
    return this.result([], false);
  }

  handleDisconnect(connId: string): HandleResult {
    const binding = this.conns.get(connId);
    this.conns.delete(connId);
    if (!binding?.playerId) return this.result([], false);

    const still = this.connCount(binding.playerId);
    if (still > 0) return this.result([], false);

    this.bumpSeq();
    this.refreshDeadline();
    return this.result(this.fanoutRoom(), true);
  }

  handleMessage(connId: string, raw: string): HandleResult {
    if (!this.conns.has(connId)) {
      this.conns.set(connId, { playerId: null });
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return this.result([this.errorTo(connId, 'BAD_MESSAGE', 'Invalid JSON')], false);
    }

    const parsed = tryParseClientMessage(json);
    if (!parsed.ok) {
      return this.result([this.errorTo(connId, 'BAD_MESSAGE', parsed.error)], false);
    }

    return this.dispatch(connId, parsed.message);
  }

  handleAlarm(): HandleResult {
    const now = this.deps.now();
    if (!this.turnDeadline || now < this.turnDeadline.at) {
      return this.result([], true);
    }
    if (!this.game) {
      this.turnDeadline = null;
      return this.result([], true);
    }

    const playerId = this.turnDeadline.playerId;
    if (this.isConnected(playerId)) {
      this.refreshDeadline();
      return this.result([], true);
    }

    const action = disconnectAction(this.game, playerId);
    this.turnDeadline = null;
    if (!action) {
      this.refreshDeadline();
      return this.result([], true);
    }

    return this.applyEngineAction(action, null);
  }

  /** Test-only: inject a stacked engine state (seating must match joined player ids). */
  setGameForTest(game: GameState): void {
    this.game = game;
  }

  private dispatch(connId: string, msg: ClientMessage): HandleResult {
    switch (msg.type) {
      case 'join':
        return this.join(connId, msg.name, msg.playerId);
      case 'leave':
        return this.leave(connId);
      case 'start':
        return this.start(connId);
      case 'setRules':
        return this.setRules(connId, msg.ruleSet);
      case 'action':
        return this.clientAction(connId, msg.action);
      case 'heartbeat':
        return this.heartbeat(connId);
    }
  }

  private setRules(connId: string, ruleSet: RuleSet): HandleResult {
    const playerId = this.boundPlayer(connId);
    if (!playerId) {
      return this.result([this.errorTo(connId, 'NOT_JOINED', 'Not joined')], false);
    }
    if (playerId !== this.hostId) {
      return this.result(
        [this.errorTo(connId, 'NOT_HOST', 'Only the host can change rules')],
        false,
      );
    }
    if (this.game) {
      return this.result(
        [this.errorTo(connId, 'GAME_IN_PROGRESS', 'Rules are locked once the game starts')],
        false,
      );
    }
    if (this.players.length > ruleSet.maxPlayers) {
      return this.result(
        [
          this.errorTo(
            connId,
            'INVALID_RULES',
            `Already have ${this.players.length} players (max ${ruleSet.maxPlayers})`,
          ),
        ],
        false,
      );
    }

    this.ruleSet = ruleSet;
    this.bumpSeq();
    return this.result(this.fanoutRoom(), true);
  }

  private join(connId: string, name: string, requestedId?: PlayerId): HandleResult {
    const existing = requestedId ? this.players.find((p) => p.playerId === requestedId) : undefined;

    if (existing) {
      this.conns.set(connId, { playerId: existing.playerId });
      existing.name = name;
      existing.lastSeenAt = this.deps.now();
      this.bumpSeq();
      this.refreshDeadline();
      const outbound: Outbound[] = [
        this.welcome(connId, existing.playerId),
        { connId, message: { type: 'snapshot', room: this.roomView(existing.playerId, 'snapshot') } },
        ...this.fanoutRoom(),
      ];
      return this.result(outbound, true);
    }

    if (this.game) {
      return this.result(
        [
          this.errorTo(
            connId,
            requestedId ? 'UNKNOWN_PLAYER' : 'GAME_IN_PROGRESS',
            'Game already started',
          ),
        ],
        false,
      );
    }

    if (this.players.length >= this.ruleSet.maxPlayers) {
      return this.result([this.errorTo(connId, 'ROOM_FULL', 'Room is full')], false);
    }

    const playerId = this.deps.randomId();
    const player: RoomPlayer = {
      playerId,
      name,
      lastSeenAt: this.deps.now(),
    };
    this.players.push(player);
    if (!this.hostId) this.hostId = playerId;
    this.conns.set(connId, { playerId });
    this.bumpSeq();
    this.refreshDeadline();
    const outbound: Outbound[] = [
      this.welcome(connId, playerId),
      { connId, message: { type: 'snapshot', room: this.roomView(playerId, 'snapshot') } },
      ...this.fanoutRoom(),
    ];
    return this.result(outbound, true);
  }

  private leave(connId: string): HandleResult {
    const binding = this.conns.get(connId);
    if (!binding?.playerId) {
      return this.result([this.errorTo(connId, 'NOT_JOINED', 'Not joined')], false);
    }
    const playerId = binding.playerId;
    this.conns.set(connId, { playerId: null });

    if (!this.game) {
      this.players = this.players.filter((p) => p.playerId !== playerId);
      if (this.hostId === playerId) {
        this.hostId = this.players[0]?.playerId ?? null;
      }
    }

    this.bumpSeq();
    this.refreshDeadline();
    return this.result(this.fanoutRoom(), true);
  }

  private start(connId: string): HandleResult {
    const playerId = this.boundPlayer(connId);
    if (!playerId) {
      return this.result([this.errorTo(connId, 'NOT_JOINED', 'Not joined')], false);
    }
    if (playerId !== this.hostId) {
      return this.result([this.errorTo(connId, 'NOT_HOST', 'Only the host can start')], false);
    }
    if (this.game) {
      return this.result([this.errorTo(connId, 'GAME_IN_PROGRESS', 'Game already started')], false);
    }
    if (this.players.length < this.ruleSet.minPlayers) {
      return this.result(
        [this.errorTo(connId, 'NEED_PLAYERS', `Need at least ${this.ruleSet.minPlayers} players`)],
        false,
      );
    }

    const ids = this.players.map((p) => p.playerId);
    const seed = this.deps.randomSeed();
    let game = createGame(ids, seed, this.ruleSet);
    const rng = createRng(seed, game.rngState);
    game = reduce(game, { type: 'START_GAME', playerId }, this.ruleSet, rng);
    const rejected = game.lastEvents.find((e) => e.type === 'ACTION_REJECTED');
    if (rejected && rejected.type === 'ACTION_REJECTED') {
      return this.result(
        [
          {
            connId,
            message: {
              type: 'rejected',
              seq: this.seq,
              actionType: 'START_GAME',
              reason: rejected.reason,
            },
          },
        ],
        false,
      );
    }

    this.seed = seed;
    this.game = game;
    this.bumpSeq();
    this.refreshDeadline();
    return this.result(this.fanoutState(), true);
  }

  private clientAction(connId: string, action: Action): HandleResult {
    const playerId = this.boundPlayer(connId);
    if (!playerId) {
      return this.result([this.errorTo(connId, 'NOT_JOINED', 'Not joined')], false);
    }
    if (action.playerId !== playerId) {
      return this.result(
        [this.errorTo(connId, 'SPOOFED_PLAYER', 'playerId does not match this connection')],
        false,
      );
    }
    if (action.type === 'START_GAME') {
      return this.start(connId);
    }
    if (!this.game) {
      return this.result([this.errorTo(connId, 'BAD_MESSAGE', 'Game has not started')], false);
    }
    return this.applyEngineAction(action, connId);
  }

  private applyEngineAction(action: Action, fromConnId: string | null): HandleResult {
    if (!this.game) {
      return this.result([], false);
    }
    const rng = createRng(this.game.seed, this.game.rngState);
    const next = reduce(this.game, action, this.ruleSet, rng);
    const rejected = next.lastEvents.find((e) => e.type === 'ACTION_REJECTED');
    if (rejected && rejected.type === 'ACTION_REJECTED') {
      if (!fromConnId) {
        this.refreshDeadline();
        return this.result([], true);
      }
      return this.result(
        [
          {
            connId: fromConnId,
            message: {
              type: 'rejected',
              seq: this.seq,
              actionType: rejected.actionType,
              reason: rejected.reason,
            },
          },
        ],
        false,
      );
    }

    this.game = next;
    this.bumpSeq();
    this.refreshDeadline();
    return this.result(this.fanoutState(), true);
  }

  private heartbeat(connId: string): HandleResult {
    const playerId = this.boundPlayer(connId);
    if (playerId) {
      const p = this.players.find((pl) => pl.playerId === playerId);
      if (p) p.lastSeenAt = this.deps.now();
    }
    return this.result([{ connId, message: { type: 'pong' } }], false);
  }

  private refreshDeadline(): void {
    if (!this.game) {
      this.turnDeadline = null;
      return;
    }
    const target = nextTimeoutTarget(this.game, (id) => this.isConnected(id));
    if (!target) {
      this.turnDeadline = null;
      return;
    }
    if (this.turnDeadline?.playerId === target) return;
    this.turnDeadline = { playerId: target, at: this.deps.now() + this.turnTimeoutMs };
  }

  private isConnected(playerId: PlayerId): boolean {
    return this.connCount(playerId) > 0;
  }

  private connCount(playerId: PlayerId): number {
    let n = 0;
    for (const c of this.conns.values()) {
      if (c.playerId === playerId) n += 1;
    }
    return n;
  }

  private boundPlayer(connId: string): PlayerId | null {
    return this.conns.get(connId)?.playerId ?? null;
  }

  private bumpSeq(): void {
    this.seq += 1;
  }

  private roomView(viewerId: PlayerId, mode: 'live' | 'snapshot' = 'live'): RoomView {
    const you = this.players.find((p) => p.playerId === viewerId);
    const view = this.game ? this.playerView(viewerId, mode) : null;
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      seq: this.seq,
      turnTimeoutMs: this.turnTimeoutMs,
      you: { playerId: viewerId, name: you?.name ?? viewerId },
      players: this.players.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        connected: this.isConnected(p.playerId),
        isHost: p.playerId === this.hostId,
      })),
      ruleSet: this.ruleSet,
      game: view,
      lastEvents: view?.lastEvents ?? [],
    };
  }

  private playerView(viewerId: PlayerId, mode: 'live' | 'snapshot' | 'deliver'): RedactedGameView {
    const now = this.deps.now();
    const view = viewFor(this.game!, viewerId, this.ruleSet);
    if (mode === 'deliver') {
      return { ...view, lastEvents: stampRevealExpiry(view.lastEvents, now) };
    }
    if (mode === 'snapshot') {
      return {
        ...view,
        lastEvents: view.lastEvents.filter((event) => event.type !== 'CARD_REVEALED'),
      };
    }
    return { ...view, lastEvents: stripRevealIdentity(view.lastEvents) };
  }

  private welcome(connId: string, playerId: PlayerId): Outbound {
    return {
      connId,
      message: {
        type: 'welcome',
        playerId,
        roomCode: this.roomCode,
        hostId: this.hostId,
        seq: this.seq,
      },
    };
  }

  private fanoutRoom(): Outbound[] {
    const outbound: Outbound[] = [];
    for (const [connId, binding] of this.conns) {
      if (!binding.playerId) continue;
      outbound.push({
        connId,
        message: { type: 'room', room: this.roomView(binding.playerId) },
      });
    }
    return outbound;
  }

  private fanoutState(): Outbound[] {
    if (!this.game) return this.fanoutRoom();
    const outbound: Outbound[] = [];
    for (const [connId, binding] of this.conns) {
      if (!binding.playerId) continue;
      const view = this.playerView(binding.playerId, 'deliver');
      outbound.push({
        connId,
        message: {
          type: 'state',
          seq: this.seq,
          view,
          lastEvents: view.lastEvents,
        },
      });
      outbound.push({
        connId,
        message: { type: 'room', room: this.roomView(binding.playerId) },
      });
    }
    return outbound;
  }

  private errorTo(connId: string, code: RoomErrorCode, message: string): Outbound {
    return { connId, message: { type: 'error', code, message } };
  }

  private result(outbound: Outbound[], persist: boolean): HandleResult {
    return { outbound, alarmAt: this.turnDeadline?.at ?? null, persist };
  }
}

function stampRevealExpiry(events: GameEvent[], now: number): GameEvent[] {
  return events.map((event) =>
    event.type === 'CARD_REVEALED' ? { ...event, expiresAt: now + event.durationMs } : event,
  );
}

function stripRevealIdentity(events: GameEvent[]): GameEvent[] {
  return events.map((event) => {
    if (event.type !== 'CARD_REVEALED') return event;
    return {
      type: 'CARD_REVEALED',
      cardId: event.cardId,
      ownerId: event.ownerId,
      slotIndex: event.slotIndex,
      revealedToPlayerId: event.revealedToPlayerId,
      kind: event.kind,
      durationMs: event.durationMs,
      ...(event.expiresAt !== undefined ? { expiresAt: event.expiresAt } : {}),
    };
  });
}
