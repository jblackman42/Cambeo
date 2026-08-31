import type { SerializedRoom } from './room.js';
import { RoomController } from './room.js';
import { newConnId, newPlayerId, newSeed } from './ids.js';

export interface Env {
  ROOM: DurableObjectNamespace;
  TURN_TIMEOUT_MS?: string;
}

export class RoomDurableObject {
  private controller: RoomController | null = null;
  private readonly sockets = new Map<string, WebSocket>();
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
    if (!match) {
      return new Response('Not found', { status: 404 });
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const code = match[1]!.toUpperCase();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const connId = newConnId();
    this.sockets.set(connId, server);

    await this.enqueue(async () => {
      const room = await this.ensure(code);
      await this.commit(room.handleConnect(connId));
    });

    server.addEventListener('message', (event) => {
      const data = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
      void this.enqueue(async () => {
        const room = await this.ensure(code);
        await this.commit(room.handleMessage(connId, data));
      });
    });

    server.addEventListener('close', () => {
      this.sockets.delete(connId);
      void this.enqueue(async () => {
        const room = await this.ensure(code);
        await this.commit(room.handleDisconnect(connId));
      });
    });

    server.addEventListener('error', () => {
      try {
        server.close();
      } catch {
        /* ignore */
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm(): Promise<void> {
    await this.enqueue(async () => {
      const room = await this.ensure('UNKNOWN');
      await this.commit(room.handleAlarm());
    });
  }

  private enqueue(fn: () => Promise<void>): Promise<void> {
    this.tail = this.tail.then(fn).catch((err: unknown) => {
      console.error('room do error', err);
    });
    return this.tail;
  }

  private async ensure(code: string): Promise<RoomController> {
    if (this.controller) return this.controller;
    const saved = await this.ctx.storage.get<SerializedRoom>('room');
    const timeout = Number(this.env.TURN_TIMEOUT_MS ?? '45000');
    const deps = {
      now: () => Date.now(),
      randomId: newPlayerId,
      randomSeed: newSeed,
    };
    this.controller = saved
      ? RoomController.deserialize(saved, deps)
      : new RoomController(code, deps, { turnTimeoutMs: Number.isFinite(timeout) ? timeout : 45_000 });
    return this.controller;
  }

  private async commit(result: ReturnType<RoomController['handleConnect']>): Promise<void> {
    for (const item of result.outbound) {
      const ws = this.sockets.get(item.connId);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(item.message));
      }
    }
    if (result.persist && this.controller) {
      await this.ctx.storage.put('room', this.controller.serialize());
    }
    if (result.alarmAt === null) {
      await this.ctx.storage.deleteAlarm();
    } else {
      await this.ctx.storage.setAlarm(result.alarmAt);
    }
  }
}
