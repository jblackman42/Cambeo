# @cambeo/server

Cloudflare Worker + one Durable Object per room. Calls `reduce` / `viewFor`; does not reimplement rules.

Protocol: [docs/protocol.md](../../docs/protocol.md).

## Local run

Requires Node 22+ and pnpm 9+.

```bash
# from repo root — terminal 1
pnpm install
pnpm dev:server          # wrangler → http://localhost:8787  (WS at ws://localhost:8787/room/:code)

# terminal 2
pnpm dev                 # Next.js → http://localhost:3000
```

Create a room in the browser, open a **second tab** (sessionStorage = new player) or another browser, join the code, start at 3 players.

`NEXT_PUBLIC_WS_URL` defaults to `ws://localhost:8787`. Point it at the worker if you change wrangler’s port.

Turn timeout: wrangler var `TURN_TIMEOUT_MS` (default 45000).

## Tests

```bash
pnpm --filter @cambeo/server test
```

Room logic is unit-tested as `RoomController` (no Miniflare). The Durable Object is a thin WebSocket + storage wrapper.
