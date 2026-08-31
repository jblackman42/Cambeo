# Cambeo

A browser-based, real-time multiplayer implementation of Cambeo (house-ruled Cambio / Cabo / Pablo / Cactus). Fewest points wins.

## Status

Rules engine, shared `RuleSet`, and a local hot-seat UI are in place. Room server, multiplayer websockets, and card assets are not started yet.

## Docs

- [House rules](docs/cambeo-rules.md) — game behavior (source of truth)
- [App spec](docs/cambeo-app-spec.md) — product and technical requirements
- [CLAUDE.md](CLAUDE.md) — project conventions for agents and contributors

## Quick start

Requires Node 22+ and pnpm 9+.

```bash
pnpm install
pnpm dev    # hot-seat UI → http://localhost:3000
pnpm test
pnpm check
```

## Packages

| Package | Role |
| --- | --- |
| `@cambeo/shared` | Card keys, powers, zod `RuleSet`, House Rules preset |
| `@cambeo/engine` | Deterministic authoritative rules engine |
| `@cambeo/web` | Next.js hot-seat UI driving the engine in-browser |

## Hot-seat play

1. Add at least 3 player names and start.
2. Pass the device; use the seat chips to switch whose view you see.
3. Peek and ack each player, then take turns: draw, discard/replace, powers, flips, Cambeo.
4. Tap any card to attempt a flip (unless a prompt asks you to select a target instead).

## License

Private — not published.
