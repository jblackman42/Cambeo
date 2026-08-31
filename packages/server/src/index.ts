import { makeRoomCode } from './ids.js';
import { RoomDurableObject, type Env } from './room-do.js';

export { RoomDurableObject };

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return cors(Response.json({ ok: true }));
    }

    if (request.method === 'POST' && (url.pathname === '/rooms' || url.pathname === '/rooms/')) {
      const roomCode = makeRoomCode();
      return cors(Response.json({ roomCode, wsPath: `/room/${roomCode}` }));
    }

    const match = url.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
    if (match && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const id = env.ROOM.idFromName(match[1]!.toUpperCase());
      const stub = env.ROOM.get(id);
      return stub.fetch(request);
    }

    return cors(new Response('Not found', { status: 404 }));
  },
};
