import { z } from 'zod';
import type { PlayerId } from './view.js';

export type PowerTarget =
  | { kind: 'CARD'; playerId: PlayerId; slotIndex: number }
  | { kind: 'PLAYER'; playerId: PlayerId }
  | { kind: 'CONFIRM'; swap: boolean }
  | { kind: 'SKIP' };

export const PowerTargetSchema: z.ZodType<PowerTarget> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('CARD'),
    playerId: z.string().min(1),
    slotIndex: z.number().int(),
  }),
  z.object({
    kind: z.literal('PLAYER'),
    playerId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('CONFIRM'),
    swap: z.boolean(),
  }),
  z.object({
    kind: z.literal('SKIP'),
  }),
]);

export type Action =
  | { type: 'START_GAME'; playerId: PlayerId }
  | { type: 'ACK_PEEK'; playerId: PlayerId }
  | { type: 'DRAW_DECK'; playerId: PlayerId }
  | { type: 'DRAW_DISCARD'; playerId: PlayerId }
  | { type: 'DISCARD_DRAWN'; playerId: PlayerId }
  | { type: 'REPLACE_CARD'; playerId: PlayerId; slotIndex: number }
  | { type: 'KEEP_DRAWN'; playerId: PlayerId }
  | { type: 'RESOLVE_POWER_TARGET'; playerId: PlayerId; target: PowerTarget }
  | {
      type: 'FLIP_ATTEMPT';
      playerId: PlayerId;
      target: { playerId: PlayerId; slotIndex: number };
    }
  | { type: 'GIVE_CARD'; playerId: PlayerId; slotIndex: number }
  | { type: 'CALL_CAMBEO'; playerId: PlayerId }
  | { type: 'PASS_TURN'; playerId: PlayerId };

export const ActionSchema: z.ZodType<Action> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('START_GAME'), playerId: z.string().min(1) }),
  z.object({ type: z.literal('ACK_PEEK'), playerId: z.string().min(1) }),
  z.object({ type: z.literal('DRAW_DECK'), playerId: z.string().min(1) }),
  z.object({ type: z.literal('DRAW_DISCARD'), playerId: z.string().min(1) }),
  z.object({ type: z.literal('DISCARD_DRAWN'), playerId: z.string().min(1) }),
  z.object({
    type: z.literal('REPLACE_CARD'),
    playerId: z.string().min(1),
    slotIndex: z.number().int(),
  }),
  z.object({ type: z.literal('KEEP_DRAWN'), playerId: z.string().min(1) }),
  z.object({
    type: z.literal('RESOLVE_POWER_TARGET'),
    playerId: z.string().min(1),
    target: PowerTargetSchema,
  }),
  z.object({
    type: z.literal('FLIP_ATTEMPT'),
    playerId: z.string().min(1),
    target: z.object({
      playerId: z.string().min(1),
      slotIndex: z.number().int(),
    }),
  }),
  z.object({
    type: z.literal('GIVE_CARD'),
    playerId: z.string().min(1),
    slotIndex: z.number().int(),
  }),
  z.object({ type: z.literal('CALL_CAMBEO'), playerId: z.string().min(1) }),
  z.object({ type: z.literal('PASS_TURN'), playerId: z.string().min(1) }),
]);
