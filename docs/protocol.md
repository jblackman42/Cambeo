# Cambeo room protocol

WebSocket JSON between `apps/web` and `packages/server` (one Durable Object per room).

**Authoritative state never leaves the server.** Each client receives `viewFor(state, playerId, ruleSet)` only.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/rooms` | `{ roomCode, wsPath }` — does not occupy a seat |
| `GET` | `/health` | liveness |
| WebSocket | `/room/:code` | join / play |

Room codes are 5 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.

## Client → server

| `type` | Fields | Notes |
| --- | --- | --- |
| `join` | `name`, `playerId?` | Omit `playerId` for a new seat. Send it to reconnect. |
| `leave` | | Lobby: drop from roster. In-game: disconnect only. |
| `start` | | Host only. Needs `RuleSet.minPlayers`. |
| `setRules` | `ruleSet` | Host only, lobby only. Locked after `start`. Invalid schema is `BAD_MESSAGE`. |
| `action` | `action` (engine `Action`) | `action.playerId` must match the socket. `START_GAME` is not accepted here; use `start`. |
| `heartbeat` | | Replies `pong`. |

## Server → client

| `type` | When |
| --- | --- |
| `welcome` | After `join` — includes assigned `playerId` |
| `snapshot` | Full `RoomView` (join / reconnect) |
| `room` | Roster / connection changes |
| `state` | After a successful `reduce` — **this recipient’s** redacted view + `lastEvents` |
| `rejected` | Illegal engine action — **sender only**; others keep the previous seq |
| `error` | Protocol / room errors (`ROOM_FULL`, `GAME_IN_PROGRESS`, `NOT_HOST`, `INVALID_RULES`, …) |
| `pong` | Heartbeat reply |

`RoomView.ruleSet` is the room’s current config (lobby and in-game). Every `state` / `snapshot.game` is redacted for that player. Hand slots never include face identity during play (`known: false`, no `key`). Drawn-card identity is only on the drawer’s view. Discard top is public. Final scoring reveals all hands.

A `CARD_REVEALED` identity is delivered **once**, on the `state` message after the reduce that created it, and only to the addressed player (with `expiresAt` stamped by the server). Other players get the same event with no `key`. Snapshots and reconnects never reissue a reveal, even if it has not yet expired.

## Flip race

Messages are applied one at a time in arrival order. The engine already rejects a second successful `FLIP_ATTEMPT` for the same `discardEpoch`. The server does not batch or reorder.

## Disconnect timeout

Default **45s** (`TURN_TIMEOUT_MS` in wrangler). Timer starts when the player who must act has zero sockets.

| Blocking state | Auto action |
| --- | --- |
| `INITIAL_PEEK` (not acked) | `ACK_PEEK` |
| `TURN_DRAW` / `FINAL_ROUND`, not drawn | `PASS_TURN` (engine: skip the turn, advance) |
| `TURN_CHOICE` | `KEEP_DRAWN` |
| `POWER_TARGETING` / `GIVE_CARD_PENDING` | **no auto-act** (would invent play) |

Reconnect before the deadline cancels it. `PASS_TURN` is engine-legal but has no UI button.

## Late join

Lobby joins are allowed until `START_GAME`. After that, only reconnect with an existing `playerId`.
