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
- Draw prompt, then the discard-or-replace choice.
- Power prompt with targeting UI, generated from the power's target requirements.
- Call Cambeo button, enabled only on your turn before you draw.
- Any card on the table is tappable at any time to attempt a flip.
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

Note that card keys are split by color for **value and power** purposes only. Flip matching is by rank, so `Q_RED` and `Q_BLACK` share the match key `Q`, and `K_RED` and `K_BLACK` share `K`.

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
- Loss threshold (card count above which a player loses), default 6.

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

**Actions:** `DRAW_DECK`, `DRAW_DISCARD`, `DISCARD_DRAWN`, `REPLACE_CARD`, `RESOLVE_POWER_TARGET`, `FLIP_ATTEMPT`, `GIVE_CARD`, `CALL_CAMBEO`.

**Phases:** `LOBBY`, `INITIAL_PEEK`, `TURN_DRAW`, `TURN_CHOICE`, `POWER_TARGETING`, `GIVE_CARD_PENDING`, `FINAL_ROUND`, `SCORING`, `OVER`.

Flipping is legal in every phase except `SCORING` and `OVER`, which is the main thing that makes this engine harder than it looks. Flips interrupt.

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
- Deck runs out mid-draw and the discard pile is reshuffled into it.
- Deck runs out with an empty or single-card discard pile.
- Tie between the caller and another player resolves in favor of the non-caller.

---

## 5. Multiplayer and State

**Server-authoritative, one room object per game.** Suggested: Cloudflare Durable Objects or PartyKit. One object holds the state in memory, owns the websocket connections, and runs the engine. No database needed for v1; a room dies when the game ends.

**Redaction is per recipient.** The server computes a distinct view for every connected client on every state change:
- Your own cards: identity only for slots you currently know.
- Opponents' cards: position and count, never identity, unless a power revealed one to you specifically.
- Discard pile top: public.
- Deck: count only.

The engine tracks a per-player "knowledge set" of card ids so that a peeked card stays known to that player until it is swapped or discarded, and so blind swaps correctly destroy knowledge. A card given blind after a flip is unknown to its new owner.

**Flip race resolution:** flips arrive as messages, are ordered by server arrival, and the first valid attempt against a given discard wins. All later attempts against that same discard are rejected. Start there. If latency turns out to be unfair, add a 250ms collection window resolved by client timestamp with a clock offset measured at join.

**Reconnect:** a client that drops rejoins by room code and player id, and receives a full redacted state snapshot. A player disconnected for more than a set timeout on their turn is auto-passed rather than stalling the room.

---

## 6. Client Requirements

- Mobile first. Portrait layout, tap targets sized for thumbs, no hover-dependent affordances.
- Every card shows its point value in the bottom right, per house rules, and that value comes from the room's config, not from a hardcoded map. The card art is a static asset; the value badge is a separate overlay layer rendered on top of it. See section 7.
- Card flips, draws, and swaps are animated enough to be legible. Players need to see what happened to whose cards, since the whole game is watching and remembering.
- Prompts are generated from power definitions, so a new power in the registry needs no new UI.
- Clear affordance distinguishing "tap to flip" from "tap to select as swap target" while a power is resolving.
- Sound or haptic cue on a successful flip against you, since flips happen off-turn and are easy to miss.
- Event log so a player who looked away can catch up.

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

**Borders were stripped upstream.** The assets are face art on transparent background with no outline and no rounded corners. The app must render its own card frame: white fill, rounded corners, border, and shadow, with the art composited inside. This is convenient, since the frame is where the point-value badge and the "known to you" highlight live.

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

- Flip matching is by **rank only**. A black Q flips onto a red Q.
- Heaven and hell are shuffled into the deck and can be dealt and drawn like any other card.
- When the deck runs out, the discard pile is shuffled and becomes the new deck.
- A correct flip on another player's card **requires** giving them a card. With zero cards in hand, the target draws a blind card from the deck instead.
- Reaching zero cards does not end or win the game. That player keeps playing and may call cambeo or keep drawing for negatives.
- There are no eliminated players. The game ends after the final round following a cambeo call.
- Minimum 3 players.

---

## 11. Still Open

1. **Heaven and hell special rules.** Not yet documented. These almost certainly touch the flip resolver, the power registry, and possibly scoring, so they need to be written before the engine is built.
2. **"More than 6 cards and you lose"** versus "there are no eliminated players." Does a player who exceeds the threshold stop taking turns, or do they stay in play and simply lose at scoring? Play cannot continue meaningfully for a player who has already lost, so the engine needs one behavior or the other.
