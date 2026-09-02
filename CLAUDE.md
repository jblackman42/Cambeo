# Cambeo

Real-time multiplayer web version of a house-ruled card game (also known as Cambio, Cabo, Pablo, or Cactus). Goal: end with the fewest points in your hand.

## Source of truth

**[`docs/cambeo-rules.md`](docs/cambeo-rules.md) is the single source of truth for game behavior.**

If engine code and the rules doc disagree, the rules doc wins. Do not invent rules. Unresolved questions live in `docs/cambeo-app-spec.md` section 11 — leave extension points and skipped tests, do not guess.

[`docs/cambeo-app-spec.md`](docs/cambeo-app-spec.md) describes the app product, engine contract, and build order.

## Hard invariants

Violating either of these is a failed change:

1. **No hardcoded rules.** No card value, point total, power assignment, hand size, or player minimum may be hardcoded outside the `RuleSet`. Everything reads from config. If you find yourself typing `10` next to a letter `J`, stop.
2. **Redaction is first-class.** The engine must produce a redacted per-player view. A client receives a card identity only inside an unexpired `CARD_REVEALED` event addressed to it, or in the final scoring reveal, or for a card it is currently holding after drawing. The engine keeps no per-player knowledge set. Use `viewFor(state, playerId, ruleSet)` and `assertViewIdentityInvariant(view)`.

Also: `Math.random` is banned in `packages/engine` and `packages/shared` (ESLint). Use the seeded `Rng`.

## Workspace layout

```
packages/shared   RuleSet zod schema, card keys, power ids, House Rules preset, view wire types, protocol
packages/engine   Pure rules engine: reduce(state, action, ruleSet, rng) => state
apps/web          Next.js App Router UI (online rooms; /hotseat is a deprecated, unlinked dev route)
packages/server   Cloudflare Worker + Durable Object (one DO per room)
docs/             Game rules + app spec + protocol
```

Stack: pnpm workspaces, Node 22 (see `.nvmrc`), TypeScript strict, vitest, ESLint, Prettier.

## Commands

```bash
pnpm install
pnpm dev           # Next.js UI at http://localhost:3000
pnpm dev:server    # wrangler room worker at http://localhost:8787
pnpm test          # vitest run
pnpm test:watch
pnpm typecheck
pnpm lint
pnpm format
pnpm check         # typecheck + lint + test
```

`pnpm --filter @cambeo/server dev` is the same as `pnpm dev:server`. Run it **and** `pnpm dev` for multiplayer.

## Engine notes

## Engine notes

- Signature: `reduce(state, action, ruleSet, rng) => state`
- Deterministic given a seed. `rngState` on `GameState` is a serializable cursor.
- Owns full authoritative state including every face-down card identity.
- Emits `lastEvents` per action for later fan-out / animation.
- Illegal actions do not throw; they return prior state with `ACTION_REJECTED`.
- `PASS_TURN` skips an undrawn turn (room-server disconnect timeout). No Pass button in the UI.
- Heaven/hell special rules and loss-threshold elimination: heaven/hell are implemented
  (see `jokers.ts` and RuleSet flags). Loss-threshold elimination remains unresolved
  (spec 11). See skipped tests in `open-questions.test.ts`.
