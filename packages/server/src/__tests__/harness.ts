import type { ClientMessage, ServerMessage } from '@cambeo/shared';
import { RoomController, type HandleResult } from '../room.js';

export function createHarness(opts?: { turnTimeoutMs?: number; seed?: string }) {
  const clock = { t: 1_000 };
  let n = 0;
  const room = new RoomController(
    'TEST',
    {
      now: () => clock.t,
      randomId: () => `p${++n}`,
      randomSeed: () => opts?.seed ?? 'test-seed',
    },
    { turnTimeoutMs: opts?.turnTimeoutMs ?? 45_000 },
  );

  const inbox = new Map<string, ServerMessage[]>();

  function apply(result: HandleResult): HandleResult {
    for (const o of result.outbound) {
      const list = inbox.get(o.connId) ?? [];
      list.push(o.message);
      inbox.set(o.connId, list);
    }
    return result;
  }

  function connect(id: string): void {
    if (!inbox.has(id)) inbox.set(id, []);
    apply(room.handleConnect(id));
  }

  function send(id: string, msg: ClientMessage): HandleResult {
    return apply(room.handleMessage(id, JSON.stringify(msg)));
  }

  function disconnect(id: string): HandleResult {
    return apply(room.handleDisconnect(id));
  }

  function alarm(): HandleResult {
    return apply(room.handleAlarm());
  }

  function messages(id: string): ServerMessage[] {
    return inbox.get(id) ?? [];
  }

  function lastOf<T extends ServerMessage['type']>(
    id: string,
    type: T,
  ): Extract<ServerMessage, { type: T }> | undefined {
    const found = [...messages(id)].reverse().find((m) => m.type === type);
    return found as Extract<ServerMessage, { type: T }> | undefined;
  }

  function join(connId: string, name: string, playerId?: string): HandleResult {
    connect(connId);
    return send(connId, playerId ? { type: 'join', name, playerId } : { type: 'join', name });
  }

  function playerIdOf(connId: string): string {
    const welcome = lastOf(connId, 'welcome');
    if (!welcome) throw new Error(`no welcome for ${connId}`);
    return welcome.playerId;
  }

  return {
    room,
    clock,
    connect,
    send,
    disconnect,
    alarm,
    apply,
    inbox,
    messages,
    lastOf,
    join,
    playerIdOf,
  };
}
