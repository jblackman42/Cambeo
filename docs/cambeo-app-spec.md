# Cambeo — Web App Spec

What the finished app needs to do. Companion to `cambeo-rules.md`, which defines the game itself.

---

## 1. Product Summary

A browser-based, real-time multiplayer implementation of Cambeo for small private groups. No accounts, no matchmaking. One person creates a room, configures the rules, and shares a link. Everything is playable on a phone in a browser.

**Primary constraint that shapes the whole build:** the rules are configurable. Card values, card powers, hand size, and the joker toggle are all set per room. Nothing about the ruleset may be hardcoded in the engine or the UI.

**Second constraint:** hidden information is the entire game. A client must never receive the identity of a card its player is not entitled to know.

Minimum 3 players per game.

---

## 2. Core Screens

### 2.1 Landing
- Create Room, or join by pasting a room link or entering a room code.
- Username prompt, persisted in localStorage.

### 2.2 Lobby
- Room code and one-tap copy of the share link.
- Player list with connection state and a host badge.
- Rules summary panel, readable by everyone.
- Settings button, host only.
- Start Game button, host only, disabled below 3 players.
- Late joiners land here. Joins after the game starts are rejected.

### 2.3 Settings (host only, lobby only)
Locked the moment the game starts. See section 3.

### 2.4 Table
- Your hand as a grid of card slots, four to six depending on config.
- Each opponent's hand rendered around the table with name, card count, and connection state.
- Deck and discard pile in the center, discard showing its top card face up.
- Turn indicator and a clear "it's your turn" state.
- Draw prompt, then the discard / replace / keep choice.
- Power prompt with targeting UI, generated from the power's target requirements.
- Call Cambeo button, enabled only on your turn before you draw.
- Flip input is arm-then-commit: first tap arms a card locally, second tap on that same card sends `FLIP_ATTEMPT`. A single tap never flips. See section 6.
- Give-a-card prompt after a successful flip on an opponent.
- Event log of public actions, scrollable, so players can reconstruct what just happened.

### 2.5 Scoring / Game Over
- All hands revealed with per-card values and per-player totals.
- Winner, and whether the caller was beaten.
- Rematch button that returns everyone to the lobby with the same ruleset preserved.

---

## 3. Settings and Rule Configuration

The host edits a `RuleSet` object. The UI is a form over that object; the engine reads it and nothing else.

### 3.1 Editable in v1

**Deck**
- Jokers: off, or heaven and hell on.

**Card values** — a numeric input per card key. Card keys are split where values differ by color:
`A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q_RED, Q_BLACK, K_RED, K_BLACK, HEAVEN, HELL`

Note that card keys are split by color for **value and power** purposes only. Flip matching is by rank, so `Q_RED` and `Q_BLACK` share the match key `Q`, `K_RED` and `K_BLACK` share `K`, and `HEAVEN` and `HELL` share the match key `JOKER`.

**Card powers** — a dropdown per card key, choosing one power or none:
- `PEEK_OWN` — look at one of your own cards
- `PEEK_OTHER` — look at one other player's card
- `BLIND_SWAP` — swap any two cards on the table without looking
- `LOOK_THEN_BLIND_SWAP` — look at one other player's card, then blind swap any two
- `LOOK_THEN_OPTIONAL_SWAP` — look at one of yours and one of theirs, then choose whether to swap
- `SHUFFLE_TARGET_HAND` — randomize the positions of one player's cards
- `NONE`

**Game**
- Starting hand size: 4 to 6.
- Cards revealed to owner at start: 0 to hand size, default 2.
- `initialPeekDurationMs`: how long the starting peek stays face up, default 8000. Tapping Got it hides them immediately.
- `powerRevealDurationMs`: how long a power peek stays face up, default 4000.
- `flipRevealDurationMs`: how long a missed flip shows the card to the whole table, default 2500.
- Loss threshold (card count above which a player loses), default 6.
- `heavenDiscardableAfterCambeo`: boolean, default `false`. When false, heaven cannot be discarded by any means during the final round after cambeo is called.
- `hellDiscardOnlyOntoHeaven`: boolean, default `true`. When true, hell may only reach the discard pile via a correct flip onto heaven.

### 3.2 Presets
Ship two, selectable in one tap:
- **House Rules** — the defaults in `cambeo-rules.md`.
- **Custom** — whatever the host has edited.

### 3.3 Config UX requirements
- Live deck summary: total cards, point range, count of cards with powers, lowest and highest possible hand. A config form without feedback is how you ship a broken deck.
- Shareable rulesets: serialize the `RuleSet` into the room link or a short code so "play with these rules" is one paste.
- Validation with a schema (zod or equivalent), and refuse to start on failure:
  - `handSize * playerCount + 1 <= deckSize`
  - every power id is known
  - every card key has a value
  - loss threshold is greater than or equal to hand size

---

## 4. Rules Engine

A pure TypeScript module. No network, no UI, no direct randomness.

```
reduce(state: GameState, action: Action, ruleSet: RuleSet, rng: Rng): GameState
```

- Deterministic given a seed, so any game can be replayed for debugging.
- Owns the full authoritative state including every face-down card identity.
- Emits an event list per action so the server can fan out redacted views and the client can animate.

**Actions:** `START_GAME`, `ACK_PEEK`, `DRAW_DECK`, `DRAW_DISCARD`, `DISCARD_DRAWN`, `REPLACE_CARD`, `KEEP_DRAWN`, `RESOLVE_POWER_TARGET`, `FLIP_ATTEMPT`, `GIVE_CARD`, `CALL_CAMBEO`, `PASS_TURN`.

`KEEP_DRAWN` adds the drawn card to the player's hand and ends the turn without putting anything on the discard pile. It is a normal third choice after drawing (alongside discard and replace), typically used to hold a late-game negative without giving up an existing card. It is also the only legal finish when heaven is drawn during the final round and cannot be discarded or replaced onto the pile.

**Phases:** `LOBBY`, `INITIAL_PEEK`, `TURN_DRAW`, `TURN_CHOICE`, `POWER_TARGETING`, `GIVE_CARD_PENDING`, `FINAL_ROUND`, `SCORING`, `OVER`.

Flipping is legal in every phase except `SCORING` and `OVER`, which is the main thing that makes this engine harder than it looks. Flips interrupt.

**Heaven / hell legality the engine must enforce** (driven by RuleSet flags, not hardcoded joker ids in call sites beyond reading config):

- `DISCARD_DRAWN` is illegal when the drawn card is hell (with `hellDiscardOnlyOntoHeaven`). The only legal follow-ups are `REPLACE_CARD`, or `KEEP_DRAWN` if replace is also blocked for other reasons.
- `DISCARD_DRAWN` is illegal when the drawn card is heaven and cambeo has been called / phase is `FINAL_ROUND` (with `heavenDiscardableAfterCambeo` false).
- `REPLACE_CARD` that would put heaven on the discard during the final round is illegal under the same flag. The player must `KEEP_DRAWN` instead.
- `FLIP_ATTEMPT` of hell onto a discarded heaven is legal and resolves as a normal correct flip (shared `JOKER` match key), with the usual give-card consequences.
- Hell reaching the discard pile by any other route is a bug. The engine asserts an invariant: hell appears on the discard pile only immediately after a successful flip onto heaven.

**Test cases that must pass before any UI work:**
- Flip lands while another player is mid power-targeting.
- Flip matches on rank across colors: black Q flips onto a discarded red Q.
- Cambeo called during the final round is rejected.
- A card belonging to the cambeo caller cannot be flipped, swapped, or targeted.
- The cambeo caller's own flip attempts are rejected.
- Correct flip on another player's card when the flipper has exactly one card left.
- Correct flip on another player's card when the flipper has zero cards: target draws a blind card from the deck.
- Wrong flip pushes a player over the loss threshold.
- Two flip attempts on the same discard, second one rejected even if also correct.
- A player reaches zero cards, keeps taking turns, and can still call cambeo.
- A power fires with no legal target for its next step (peek own at zero cards, spy when only the cambeo caller holds any). The engine resolves the step itself and never parks the turn on a prompt with no legal answer.
- Deck runs out mid-draw and the discard pile is reshuffled into it.
- Deck runs out with an empty or single-card discard pile.
- Tie between the caller and another player resolves in favor of the non-caller.
- Drawing hell from the deck offers replace and keep; `DISCARD_DRAWN` is rejected.
- Drawing hell from the discard pile is impossible, since hell can only reach the discard pile via a flip onto heaven, and a flip removes it.
- Flipping hell onto a discarded heaven succeeds.
- Flipping hell onto any non-joker top discard fails and takes the wrong-flip penalty.
- Heaven is discardable before cambeo is called.
- Heaven is not discardable after cambeo is called, by discard or by replacement.
- A 10 or J swap moves heaven during the final round and is legal.
- A 10 or J swap moves hell and is legal.
- Engine invariant: hell never appears on the discard pile except immediately after a successful flip onto heaven.

**Reveal test cases (see §5):**
- A reveal expires and no later view carries the identity.
- A snapshot requested after expiry does not contain the identity.
- A reconnect after a reveal expires does not reissue it.
- A reconnect *during* a reveal does not extend or reissue it.
- Other players receive a lift notification with no `key` / `suit` / `value`.
- Initial peek, power reveal, and missed flip each use their own configured duration.
- A player holding a drawn card loses that identity once they discard, replace, or keep it.
- `FLIP_FAIL` carries no identity; the flipped card is revealed to every seat and expires.
- A second legitimate look at the same card starts its own timer; a replayed event does not.
- Engine invariant: no view holds an identity outside an unexpired `CARD_REVEALED` addressed to the viewer, its held drawn card, the discard top, or final scoring — checked across *every* event type, not just `CARD_REVEALED`.

---

## 5. Multiplayer and State

**Server-authoritative, one room object per game.** Suggested: Cloudflare Durable Objects or PartyKit. One object holds the state in memory, owns the websocket connections, and runs the engine. No database needed for v1; a room dies when the game ends.

**Redaction is per recipient.** The server computes a distinct view for every connected client on every state change:
- Hand slots: position and count only. Never identity, including your own cards.
- Discard pile top: public.
- Deck: count only.
- Drawn card: identity only for the player currently holding it, and only until they discard, replace, or keep it.

A reveal is a time-boxed server-issued event, not a property of game state. The engine keeps no per-player knowledge set. Knowledge lives in the player's head.

The server emits a `CARD_REVEALED` event to exactly one player:

`{ cardId, ownerId, slotIndex, revealedToPlayerId, kind, durationMs, revealId, expiresAt, key, suit, value }`

`kind` is `INITIAL_PEEK`, `POWER`, or `FLIP_FAIL`. `revealId` is stamped by the server and is unique
per emitted reveal; the client dedupes on it, so a replayed event can never extend a live reveal while
a genuinely new look at the same card still starts its own timer.

Everyone else receives the same event with `key` / `suit` / `value` omitted (a lift notification). The client renders the face until `expiresAt`, then deletes the identity from client state. The server never sends that identity to that player again — not on reconnect, not in a snapshot, not in a diff.

Duration is server-authoritative (`expiresAt`). Configurable on the `RuleSet`: `initialPeekDurationMs` (default 8000), `powerRevealDurationMs` (default 4000), and `flipRevealDurationMs` (default 2500). The client also self-expires on its own clock as a backstop. If a player disconnects mid-reveal, the reveal is lost; it is not reissued.

What counts as a reveal (all expire): initial peek, `PEEK_OWN`, `PEEK_OTHER`, the look step of `LOOK_THEN_BLIND_SWAP`, both cards of `LOOK_THEN_OPTIONAL_SWAP`, a **missed flip**, and any future power that shows a face.

A missed flip is the one reveal addressed to *every* seat rather than one: the card is exposed to the
whole table and then returns to its owner's hand, so it must expire like any other. `FLIP_FAIL`
therefore carries no `key` — the identity travels only in the accompanying `CARD_REVEALED`. A
successful flip is different: that card lands on the discard pile and is public from then on, so
`FLIP_SUCCESS` may name it.

What is not a reveal: the card you just drew while deciding, the discard top, and the final scoring reveal.

Engine invariant: no client view ever holds an identity outside an unexpired `CARD_REVEALED` addressed to it, its held drawn card, the discard top, or final scoring.

**Flip race resolution:** flips arrive as messages, are ordered by server arrival, and the first valid attempt against a given discard wins. All later attempts against that same discard are rejected. Start there. If latency turns out to be unfair, add a 250ms collection window resolved by client timestamp with a clock offset measured at join.

**Reconnect:** a client that drops rejoins by room code and player id, and receives a full redacted state snapshot. A player disconnected for more than a set timeout on their turn is auto-passed rather than stalling the room. Default timeout is 45s (`TURN_TIMEOUT_MS`). Auto-pass uses `PASS_TURN` (undrawn turn), `KEEP_DRAWN` (already drawn), or `ACK_PEEK` (initial peek). Power targeting and give-card prompts are not auto-resolved.

---

## 6. Client Requirements

Look and motion are specified in [`cambeo-design.md`](cambeo-design.md). That document wins over generic UI defaults.

- Mobile first. Portrait layout, tap targets sized for thumbs, no hover-dependent affordances.
- Every card shows its point value in the bottom right, per house rules, and that value comes from the room's config, not from a hardcoded map. The card art is a static asset; the value badge is a separate overlay layer rendered on top of it. See section 7.
- Card flips, draws, and swaps are animated enough to be legible. Players need to see what happened to whose cards, since the whole game is watching and remembering.
- Prompts are generated from power definitions, so a new power in the registry needs no new UI.
- Sound or haptic cue on a successful flip against you, since flips happen off-turn and are easy to miss.
- Event log so a player who looked away can catch up.
- After drawing, the prompt offers discard, replace, and keep. Keep adds the card to the hand without touching the discard pile.
- When a player draws hell, the prompt must offer replace and keep, with a short explanation of why discard is missing. Do not present a disabled discard button with no reason. If the hand is empty (nothing to replace), keep is the only option.
- Same for heaven during the final round: show only the legal options (`KEEP_DRAWN`, and replace only if that would not put heaven on the pile — under House Rules, replace is also illegal, so keep-only with explanation).
- Heaven sitting on top of the discard pile is a high-signal game state. Give it a visible treatment so nobody misses the flip window for hell.

### 6.1 Persistent action bar

A bar pinned above the player's hand, visible whenever any action is pending (and when a flip is armed), showing:

- The power or action name
- A step counter when there is more than one step
- A plain-language instruction for the current step
- A cancel button where the power or local mode permits backing out

During targeting, non-legal cards are dimmed and desaturated; legal targets stay bright with a gold pulse. The current step must be readable without reconstructing it from the table.

When a card is armed, the bar names the discard rank: "Tap again to flip. Discard shows a 7."

### 6.2 Flip input routing

Single-tap flipping is not used. A flip is two taps on the same card: arm (local, no network), then commit (`FLIP_ATTEMPT`). Tapping elsewhere, tapping a different card, cancel, or a 4-second timeout disarms with no penalty.

The armed state is never sent to the server or shown to other players.

While the local player has an open action of their own, taps are routed exclusively to targeting. Flip is unreachable.

| Local phase | Tap on your card | Tap on opponent card |
| --- | --- | --- |
| Idle, not your turn | Arm / commit flip | Arm / commit flip |
| Your turn, `TURN_DRAW` | No-op | No-op |
| `TURN_CHOICE` | Select replace slot | No-op |
| `POWER_TARGETING` | Select target, if legal for this step | Select target, if legal for this step |
| `GIVE_CARD_PENDING` | Select card to give | No-op |
| After you called cambeo | No-op | No-op |
| Opponent's card, they called cambeo | No-op, shake | No-op, shake |

Every no-op still gives feedback (shake or dim pulse).

The remaining protections are arm-then-commit, suppressed flips during your own pending action, and the armed-state bar naming the rank on the discard pile. There is no confirmation guard based on a remembered card identity.

### 6.3 Penalty explanation

A wrong flip is never silent. Show a message naming the flipped card, the discard pile's top card, and the consequence, held at least 2.5 seconds and dismissible early by tap. Mirror the same sentence into the event log.

Losing a flip race (`FLIP_ATTEMPT` rejected because the discard was already won) is not a mistake: return the card to rest with a plain fade and no error styling.

---

## 7. Card Art Assets

**Source:** [hayeah/playing-cards-assets](https://github.com/hayeah/playing-cards-assets), MIT licensed. The underlying artwork comes from the public-domain [vector-playing-cards](https://code.google.com/p/vector-playing-cards/) set. Vendor the `svg-cards/` directory into the repo and keep the upstream `LICENSE` file alongside it.

### 7.1 Naming and coverage

Files follow `{rank}_of_{suit}.svg`:

- Ranks: `ace`, `2` through `10`, `jack`, `queen`, `king`
- Suits: `spades`, `hearts`, `diamonds`, `clubs`
- Jokers: `black_joker.svg`, `red_joker.svg`

All 54 faces are present. Write a single `cardKeyToAsset()` mapping from the engine's card ids to these filenames and use it nowhere else, so the asset naming never leaks into game logic.

For heaven and hell, use `red_joker.svg` for **heaven** and `black_joker.svg` for **hell**, with the name rendered as a text overlay so the two are unmistakable at a glance.

### 7.2 Geometry

Every card uses `viewBox="0 0 167.0869141 242.6669922"`, an aspect ratio of roughly **0.688** (2:2.9). Lock that ratio in CSS with `aspect-ratio` and let the SVG scale to fit.

**Borders were stripped upstream.** The assets are face art on transparent background with no outline and no rounded corners. The app must render its own card frame: white fill, rounded corners, border, and shadow, with the art composited inside. This is convenient, since the frame is where the point-value badge and the reveal treatment live — a rim light shown only while a reveal of that card is unexpired, never a persistent "you know this one" marker.

**There is no card back in this repo.** One needs to be designed or sourced separately.

### 7.3 Payload size — this needs handling

The number and pip cards are small (2 to 25 KB each). The face cards are not:

| Card | Raw | After SVGO | Gzipped |
| --- | --- | --- | --- |
| `2_of_hearts` | 11 KB | — | — |
| `10_of_clubs` | 15 KB | — | — |
| `red_joker` | 11 KB | — | — |
| `jack_of_diamonds` | 404 KB | — | — |
| `king_of_clubs` | 1.1 MB | 743 KB | 337 KB |

The twelve face cards are detailed vector illustrations and stay heavy even after optimization. Shipping all of them as raw SVG is several megabytes on a phone.

**Required approach:**

1. Run SVGO over the whole set at build time and commit the optimized output. Roughly 33% off the face cards, near-lossless.
2. Rasterize the twelve face cards plus both jokers to **WebP** at build time, at 2x and 3x the maximum on-screen card size. A card is at most ~120 CSS px wide on a phone, so a 360px-wide WebP is a few KB against 337 KB gzipped for the vector. Serve WebP for face cards, SVG for pip cards, or WebP across the board for consistency.
3. Preload the full deck's assets during the lobby, not at first render of the table. The player is sitting still there anyway, and a card must never pop in blank mid-flip.
4. Serve everything from the static host with long-lived immutable cache headers, hashed filenames.

Do **not** inline the SVGs into the bundle. Do not load face cards lazily on first appearance; the flip mechanic is a speed race and a card that renders late is a card that loses a flip.

---

## 8. Build Order

0. Vendor and optimize the card assets, and build the asset pipeline in section 7. Do this first so the UI steps are never blocked on it.
1. Rules engine and `RuleSet` schema, headless, fully unit tested.
2. Presets and settings validation.
3. Local hot-seat UI in one tab, driving the engine directly. Most rule bugs surface here.
4. Room server, websockets, per-player redaction, reconnect.
5. Lobby, settings screen, share links.
6. Event log and animation polish.

---

## 9. Out of Scope for v1

- Spectator mode.
- Bots and AI opponents.
- Accounts, persistence, match history, ELO.
- Multi-round matches to a target score. Single game only, then start a new one.
- Native apps.
- Public matchmaking or a lobby browser.
- Voice or text chat. Assume the group is already on a call.

---

## 10. Resolved Rules Decisions

- Flip matching is by **rank only**. A black Q flips onto a red Q. Heaven and hell share the joker match key, so hell flips successfully onto heaven.
- Heaven and hell are shuffled into the deck and can be dealt and drawn like any other card.
- Heaven may be discarded normally until cambeo is called. After cambeo, heaven cannot be discarded by any means during the final round (config: `heavenDiscardableAfterCambeo`, House Rules default `false`). Swaps may still move heaven.
- Hell may never be discarded except by a correct flip onto heaven (config: `hellDiscardOnlyOntoHeaven`, House Rules default `true`). Drawing hell from the deck allows replace or `KEEP_DRAWN`, but not discard-for-power. Swaps may still move hell.
- After drawing, a player may discard, replace a card, or `KEEP_DRAWN` (add the card to hand, put nothing on discard).
- A player who draws heaven during the final round must `KEEP_DRAWN` if they cannot legally put heaven on the pile.
- When the deck runs out, the discard pile is shuffled and becomes the new deck.
- A correct flip on another player's card **requires** giving them a card. With zero cards in hand, the target draws a blind card from the deck instead.
- Reaching zero cards does not end or win the game. That player keeps playing and may call cambeo or keep drawing for negatives.
- A power step with no legal target is skipped by the engine as the step is reached, emitting `POWER_STEP_SKIPPED`. A power whose remaining steps are all impossible completes without effect. The actor is never asked to acknowledge a choice that does not exist.
- There are no eliminated players. The game ends after the final round following a cambeo call.
- Minimum 3 players.

---

## 11. Still Open

1. **"More than 6 cards and you lose"** versus "there are no eliminated players." Does a player who exceeds the threshold stop taking turns, or do they stay in play and simply lose at scoring? Play cannot continue meaningfully for a player who has already lost, so the engine needs one behavior or the other.
2. **Clock skew on `expiresAt`.** The server stamps absolute Unix ms and the client self-expires on its own clock. A client whose clock is behind gets a longer look. Measuring an offset at join would fix it; whether that is worth the complexity is unresolved.
3. **`LOOK_THEN_OPTIONAL_SWAP` after its reveals expire.** The confirm step is still answerable once the player has forgotten what they saw. That is arguably correct — the memory burden is the game — but it has not been ruled on.
4. **Backgrounded tabs.** A reveal keeps expiring while the tab is hidden, so a player who tabs away loses the look. Consistent with the disconnect rule, but it has not been decided deliberately.
