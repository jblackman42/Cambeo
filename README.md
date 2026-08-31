# Cambeo

A browser-based, real-time multiplayer implementation of Cambeo (house-ruled Cambio / Cabo / Pablo / Cactus). Fewest points wins.

## Status

Rules engine and shared `RuleSet` schema are in place and tested. UI, room server, and card assets are not started yet.

## Docs

- [House rules](docs/cambeo-rules.md) — game behavior (source of truth)
- [App spec](docs/cambeo-app-spec.md) — product and technical requirements
- [CLAUDE.md](CLAUDE.md) — project conventions for agents and contributors

## Quick start

Requires Node 22+ and pnpm 9+.

```bash
pnpm install
pnpm test
pnpm check
```

## Packages

| Package | Role |
| --- | --- |
| `@cambeo/shared` | Card keys, powers, zod `RuleSet`, House Rules preset |
| `@cambeo/engine` | Deterministic authoritative rules engine |

## License

Private — not published.
