# Cambeo

A browser-based, real-time multiplayer implementation of Cambeo (house-ruled Cambio / Cabo / Pablo / Cactus). Fewest points wins.

## Status

Rules engine, shared `RuleSet`, hot-seat UI, and a Cloudflare Worker room server (websockets, redaction, reconnect) are in place. Polished lobby/settings and card assets are not started yet.

## Docs

- [House rules](docs/cambeo-rules.md) — game behavior (source of truth)
- [App spec](docs/cambeo-app-spec.md) — product and technical requirements
- [Wire protocol](docs/protocol.md) — client ↔ room server messages
- [CLAUDE.md](CLAUDE.md) — project conventions for agents and contributors
- [Server README](packages/server/README.md) — wrangler / Durable Objects

## Quick start

Requires Node 22+ and pnpm 9+.

```bash
pnpm install
pnpm dev          # Next.js UI → http://localhost:3000
pnpm test
pnpm check
```

### Multiplayer (two terminals)

```bash
pnpm dev:server   # wrangler → http://localhost:8787
pnpm dev          # UI → http://localhost:3000
```

Then **Create room** on the landing page. Two tabs in the same browser are two players (player id is per-tab `sessionStorage`). Refresh reconnects that tab.

Hot-seat is deprecated: `/hotseat` still works as an unlinked dev route for driving the engine without a server, but it is no longer linked from the UI.

If create-room fails, the worker is not running.

## Deploy

The two halves ship separately.

| Half | How |
| --- | --- |
| `apps/web` | Auto-deploys from `main` (Vercel Git integration, configured dashboard-side) |
| `packages/server` | `.github/workflows/deploy-worker.yml` on pushes to `main` touching `packages/**` |

The worker workflow needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. To deploy it by hand:

```bash
pnpm deploy:server
```

A change to `packages/shared/src/protocol.ts` touches both halves. The worker rejects any message it cannot parse with `BAD_MESSAGE`, so shipping the UI without the worker leaves the new control visibly dead — let the worker workflow finish before relying on it.

The web build needs `NEXT_PUBLIC_WS_URL` pointing at the deployed worker (it defaults to `ws://localhost:8787`).

## Packages

| Package | Role |
| --- | --- |
| `@cambeo/shared` | Card keys, powers, zod `RuleSet`, House Rules, wire protocol |
| `@cambeo/engine` | Deterministic authoritative rules engine |
| `@cambeo/server` | Cloudflare Worker + Durable Object rooms |
| `@cambeo/web` | Next.js UI (online rooms; deprecated hot-seat dev route) |

## License

Private — not published.
