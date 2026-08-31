# Cambeo

Real-time multiplayer web version of a house-ruled card game (also known as Cambio, Cabo, Pablo, or Cactus). Goal: end with the fewest points in your hand.

## Source of truth

**[`docs/cambeo-rules.md`](docs/cambeo-rules.md) is the single source of truth for game behavior.**

If engine code and the rules doc disagree, the rules doc wins. Do not invent rules. Unresolved questions live in `docs/cambeo-app-spec.md` section 11 — leave extension points and skipped tests, do not guess.

[`docs/cambeo-app-spec.md`](docs/cambeo-app-spec.md) describes the app product, engine contract, and build order.

## Hard invariants

Violating either of these is a failed change:

1. **No hardcoded rules.** No card value, point total, power assignment, hand size, or player minimum may be hardcoded outside the `RuleSet`. Everything reads from config. If you find yourself typing `10` next to a letter `J`, stop.
2. **Redaction is first-class.** The engine must produce a redacted per-player view. `GameState.knowledge` (per-player set of known card ids) is the source of truth for “what does player X know?” — not something reconstructed later. Use `knows(state, playerId, cardId)` and `viewFor(state, playerId, ruleSet)`.

Also: `Math.random` is banned in `packages/engine` and `packages/shared` (ESLint). Use the seeded `Rng`.

## Workspace layout

```
packages/shared   RuleSet zod schema, card keys, power ids, House Rules preset, view wire types
packages/engine   Pure rules engine: reduce(state, action, ruleSet, rng) => state
apps/web          Next.js App Router hot-seat UI (drives engine directly)
packages/server   (not yet) Cloudflare Worker + Durable Object
docs/             Game rules + app spec
```

Stack: pnpm workspaces, Node 22 (see `.nvmrc`), TypeScript strict, vitest, ESLint, Prettier.

## Commands

```bash
pnpm install
pnpm dev           # hot-seat UI at http://localhost:3000
pnpm test          # vitest run
pnpm test:watch
pnpm typecheck
pnpm lint
pnpm format
pnpm check         # typecheck + lint + test
```

## Engine notes

- Signature: `reduce(state, action, ruleSet, rng) => state`
- Deterministic given a seed. `rngState` on `GameState` is a serializable cursor.
- Owns full authoritative state including every face-down card identity.
- Emits `lastEvents` per action for later fan-out / animation.
- Illegal actions do not throw; they return prior state with `ACTION_REJECTED`.
- Heaven/hell special rules and loss-threshold elimination: heaven/hell are implemented
  (see `jokers.ts` and RuleSet flags). Loss-threshold elimination remains unresolved
  (spec 11). See skipped tests in `open-questions.test.ts`.
