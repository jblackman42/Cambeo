import { z } from 'zod';
import { ActionSchema, type Action } from './action.js';
import type { GameEvent } from './events.js';
import { RuleSetSchema, type RuleSet } from './ruleset.js';
import type { PlayerId, RedactedGameView } from './view.js';

export const DEFAULT_TURN_TIMEOUT_MS = 45_000;

export type RoomErrorCode =
  | 'BAD_MESSAGE'
  | 'NOT_JOINED'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NOT_HOST'
  | 'NEED_PLAYERS'
  | 'UNKNOWN_PLAYER'
  | 'SPOOFED_PLAYER'
  | 'INVALID_RULES';

export interface RoomPlayerInfo {
  playerId: PlayerId;
  name: string;
  connected: boolean;
  isHost: boolean;
}

export interface RoomView {
  roomCode: string;
  hostId: PlayerId | null;
  seq: number;
  turnTimeoutMs: number;
  you: { playerId: PlayerId; name: string };
  players: RoomPlayerInfo[];
  ruleSet: RuleSet;
  game: RedactedGameView | null;
  lastEvents: GameEvent[];
}

export type ClientMessage =
  | { type: 'join'; name: string; playerId?: PlayerId }
  | { type: 'leave' }
  | { type: 'start' }
  | { type: 'setRules'; ruleSet: RuleSet }
  | { type: 'action'; action: Action }
  | { type: 'heartbeat' };

export const ClientMessageSchema: z.ZodType<ClientMessage> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    name: z.string().trim().min(1).max(20),
    playerId: z.string().min(1).optional(),
  }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('setRules'), ruleSet: RuleSetSchema }),
  z.object({ type: z.literal('action'), action: ActionSchema }),
  z.object({ type: z.literal('heartbeat') }),
]);

export type ServerMessage =
  | { type: 'welcome'; playerId: PlayerId; roomCode: string; hostId: PlayerId | null; seq: number }
  | { type: 'snapshot'; room: RoomView }
  | { type: 'room'; room: RoomView }
  | {
      type: 'state';
      seq: number;
      view: RedactedGameView;
      lastEvents: GameEvent[];
    }
  | { type: 'rejected'; seq: number; actionType: string; reason: string }
  | { type: 'error'; code: RoomErrorCode; message: string }
  | { type: 'pong' };

export function parseClientMessage(input: unknown): ClientMessage {
  return ClientMessageSchema.parse(input);
}

export function tryParseClientMessage(
  input: unknown,
): { ok: true; message: ClientMessage } | { ok: false; error: string } {
  const parsed = ClientMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid message' };
  }
  return { ok: true, message: parsed.data };
}
