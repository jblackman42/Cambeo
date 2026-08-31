# Cambeo — Design and Motion Spec

Companion to `cambeo-rules.md` and `cambeo-app-spec.md`. This document governs how the app looks and moves. Where it conflicts with a generic design default, this document wins.

---

## 1. Direction

**Restrained surface, dramatic motion.**

The table is near-black, quiet, and almost entirely free of decoration. There is no felt texture, no wood, no ornament. The playing cards are the only bright objects on screen, and because the card art is white on a near-black field, the deck carries all the visual weight without any help.

The drama lives entirely in motion. Cards fly, flip, land, and settle with real physical presence. Nothing important happens by simply appearing or disappearing.

That combination is deliberate and the two halves depend on each other. A busy background would make showy motion look chaotic. A quiet background makes the same motion look expensive.

### 1.1 The one rule that overrides "showy"

Flipping is a race. Two players tapping the same card 80ms apart is a normal occurrence, and the loser must be able to see that they lost immediately.

**Nothing on the race-critical path may be slowed down for effect.** Tap feedback, flip resolution, and turn handoff are fast and functional. Flourish is spent on rare, high-stakes, non-competitive moments where nobody is waiting to act.

| Frequency in a game | Motion budget |
| --- | --- |
| Every turn (draw, discard, replace) | 200–320ms, functional, no flourish |
| Flip attempt feedback | Under 120ms to first visible response |
| Several times per game (powers, peeks, give-a-card) | 320–500ms, expressive |
| Once or twice per game (cambeo call, hell onto heaven, final scoring) | Up to 1.5s, full flourish |
| Never | Anything that blocks input while it plays |

If an animation would delay a player's ability to act, it is wrong, no matter how good it looks.

---

## 2. Color

Dark, near-neutral, one accent. Design tokens, no raw hex outside the token file.

### 2.1 Surfaces

```
--bg            #09090B   table background, the deepest layer
--surface       #141417   panels, player pods, sheets
--surface-2     #1D1D21   raised elements, active player pod
--border        rgba(255,255,255,0.08)
--border-strong rgba(255,255,255,0.16)
```

The background is a flat near-black, not pure black, so that shadows and elevation still read. A very subtle radial vignette centered on the deck is permitted, at most 4% lightness variation, to focus attention on the middle of the table. Nothing stronger.

### 2.2 Text

```
--text          #FAFAFA
--text-muted    #A1A1AA
--text-subtle   #71717A
```

### 2.3 Accent and state

```
--accent        #E4B65C   warm gold. Turn indicator, primary actions, focus rings.
--accent-dim    #8A6D33
--positive      #4ADE80   correct flip
--negative      #F87171   wrong flip, penalty
--heaven        #A5D8FF   cool pale blue
--hell          #FF6B3D   ember orange
```

Gold is the only accent in normal play. Whose turn it is should be readable from across a room, and it is the single most important piece of state on screen.

**Never signal flip success or failure with color alone.** Correct and wrong flips must differ in motion, sound, and iconography as well. Some of your players will be on a phone in a dim room at speed, and roughly one in twelve men has some form of color vision deficiency.

### 2.4 Heaven and hell

These two cards carry a 19-point swing and must never be confused. Treat them as the only themed objects in the app.

- Heaven: cool pale blue rim light on the card frame, plus the word HEAVEN set in the frame.
- Hell: ember orange rim light, plus the word HELL.
- Both get a slow, subtle ambient animation when in your own hand and known to you: heaven a faint upward drift on the glow, hell a slow flicker. Under 10% opacity variation. This is peripheral awareness, not decoration.
- When heaven is on top of the discard pile, the pile itself gets the heaven rim light. That is the only window in which hell can be discarded and nobody should miss it.

### 2.5 Light mode

Not in v1. Build the tokens so it is possible later, ship dark only.

---

## 3. Typography and card faces

- One typeface. Roboto, weights 400 / 500 / 700.
- **Tabular numerals everywhere a number can change.** Point badges, card counts, scores. Proportional digits cause layout jitter on every update.
- Point value badge: bottom-right of the card frame, semibold, tabular, high contrast against the frame not the art.
- Negative values are the whole point of the game. Render them with a proper minus sign and give them the heaven blue tint so a hand's good cards are scannable at a glance.
- Card frame: white fill, 8px radius at full size scaling proportionally, 1px border at `rgba(0,0,0,0.12)`, and a soft drop shadow. The upstream art has no border, so the frame is entirely ours.

---

## 4. Table layout

Opponents are rendered as their **actual card grids**, arranged around a table, not as abstract chips. The spatial position of a specific card matters, because targeting a swap means pointing at a slot.

### 4.1 The insight that makes this work on a phone

Opponent cards are face down almost the entire game. A face-down card is a card back, which is legible at any size. Card art only needs to be readable during a reveal, and reveals do not have to happen in place.

**Reveals lift out of the layout.** When any card is revealed to you (a power, a flip resolution, final scoring), it animates up to a large centered size, holds, and returns to its slot. You never read a 30px-wide card face. This removes the size floor from the layout entirely.

The initial peek is the exception: those two cards flip face up **in place**. The player needs to associate the value with the slot position, and lifting breaks that association.

### 4.2 Sizing

Portrait, 390px reference width. Aspect ratio locked at 0.688.

| Position | Card width | Notes |
| --- | --- | --- |
| Your hand | 72–84px | Bottom of screen, thumb reachable |
| Opponent, 3–4 players | 44px | |
| Opponent, 5–6 players | 36px | |
| Opponent, 7–8 players | 30px | Floor. Do not go below. |
| Revealed / lifted | 180px | Centered overlay |

Hand size can be up to 6, so an 8-player table is 7 opponents times 6 cards at 30px. Arrange opponents around the top and sides in a horseshoe, with the deck and discard in the center and your own hand across the bottom. If the horseshoe cannot fit at the floor size, scroll the opponent band horizontally rather than shrinking further, and keep the current player's pod pinned into view.

### 4.3 Player pods

Each opponent is a pod: name, card count, connection dot, and their card grid. The active player's pod gets `--surface-2`, a gold border, and a subtle sustained glow. That glow is the turn indicator and it should be the brightest non-card thing on screen.

A player who has called cambeo gets a locked treatment: their pod dims slightly, their cards get a visible lock affordance, and tapping them does nothing with a short shake. Untouchable is a rule and it should feel like one.

### 4.4 Targeting treatment

During any targeting step (power, replace, give-a-card), every card that is **not** a legal target for the current step is dimmed to roughly 35% opacity and desaturated. Legal targets stay at full brightness with a gold pulse. The player should never have to reason about what is tappable; it should be the only thing they can see.

### 4.5 Persistent action bar

A bar pinned above the player's hand (and above the home indicator), visible whenever any action is pending, showing:

- The power or action name
- A step counter when there is more than one step
- A plain-language instruction for the current step
- A cancel button where the power or local mode permits backing out

When a card is armed for a flip, the same bar switches to the flip prompt and names the discard rank the player is matching against.

---

## 5. Motion system

### 5.1 Tokens

```css
--ease-out:     cubic-bezier(0.23, 1, 0.32, 1);   /* enter, respond */
--ease-in-out:  cubic-bezier(0.77, 0, 0.175, 1);  /* move across screen */
--ease-exit:    cubic-bezier(0.4, 0, 1, 1);       /* leaving, fast */

--dur-instant:  90ms
--dur-fast:     160ms
--dur-base:     240ms
--dur-slow:     400ms
--dur-flourish: 900ms
```

Never `ease-in` on anything entering. Never `transition: all`.

### 5.2 Springs

Use springs for anything that travels across the table, because cards have mass. Motion's `bounce` + `duration` API.

| Motion | bounce | duration |
| --- | --- | --- |
| Card travelling to a new slot | 0.2 | 0.4s |
| Card landing on the discard pile | 0.3 | 0.35s |
| Card lifting for reveal | 0.15 | 0.35s |
| Swap arc | 0.25 | 0.5s |
| Panels, sheets, prompts | 0 | 0.3s |

Bounce is for objects that were thrown. Interface chrome gets none.

### 5.3 Implementation constraints

- Animate `transform` and `opacity` only. No `top`, `left`, `width`, or `height` on anything that moves.
- Card movement between slots uses FLIP: measure both positions, animate the transform, never animate layout.
- Cards are position-independent components with a stable identity keyed by card slot id, so a card that moves between hands is the same DOM node travelling, not a delete and a create.
- Every card animation must be interruptible. Flips can land mid-power-resolution and the engine will not wait for your animation to finish.
- Prefer CSS transitions over keyframes for anything that can retrigger rapidly. Keyframes restart from zero on interruption; transitions retarget.

---

## 6. Action-by-action motion spec

### 6.1 Deal
Cards fly out from the deck one at a time, staggered 40ms, spring to their slots. Full round of dealing under 1.2s. This happens once per game so it can be the most theatrical moment in the app.

### 6.2 Initial peek
Your two known cards flip face up in place after the deal, hold for a configurable timer with a visible countdown ring, then flip back. Do not lift these; the player needs to associate the value with the slot position, and lifting breaks that association. This is the one reveal that stays in place.

### 6.3 Draw from deck
Card lifts off the deck, scales up, and settles into a held position above your hand. 240ms, `--ease-out`. It is face up to you only. The action prompt fades in underneath at 90ms delay.

### 6.4 Draw from discard
Same, but from the discard pile, and the pile's top card visibly changes to the one beneath. Show the newly exposed card, because it changes everyone's flip options.

### 6.5 Discard the drawn card
Card arcs to the discard pile and lands with a slight rotation offset, 2 to 5 degrees random, so the pile looks like a real pile. Spring, bounce 0.3.

### 6.6 Replace a card
The two cards cross. The drawn card travels down into the slot while the replaced card travels up and out to the discard pile. They pass each other. This is the single most common action in the game and the crossing motion is what makes it legible. 400ms, spring, bounce 0.2.

### 6.7 Powers

- **Peek own / peek other:** target slot pulses gold, then the card lifts to center at 180px, holds 2.5s with a countdown ring, and returns. Only the acting player sees the face; everyone else sees the lift with a card back and knows a peek happened.
- **Blind swap:** both targets pulse, then the two cards arc past each other in a wide curve and land in each other's slots, both face down. The arc must be visibly wide so the audience can track which two slots were involved. 500ms.
- **Look then blind swap:** reveal lift resolves first, then the swap arc. Two distinct beats, do not overlap them.
- **Shuffle target hand:** cards lift slightly, cross rapidly in an overlapping scramble, and land. Deliberately hard to track, which is the point.

### 6.8 Flip attempt

This is the race path. Speed over beauty. **Single-tap flipping is not used.** A flip is arm, then commit.

- **Arm.** First tap selects the card. It lifts, gains a rim highlight, and displays the rank it will be matched against (the current top of the discard pile). 160ms `--ease-out`. First visible response is this arm, and it must land under 120ms. The armed state is **local only** — never sent to the server or shown to other players. Arming produces zero network traffic.
- **Commit.** A second tap on that same card sends the flip attempt. Instant local depress `scale(0.96)` at `--dur-instant`, optimistic, before the server responds.
- **Disarm** with no penalty and no server call: tap a different card (which arms that one instead), tap the table background, tap cancel, or wait 4 seconds.
- **Correct flip:** card flips face up, gets a green rim flash (plus motion and sound — never color alone), and shoots to the discard pile. Total under 400ms. Positive sound, sharp haptic.
- **Wrong flip:** card shakes horizontally, red rim flash, and a penalty card flies from the deck into the offender's hand. Under 400ms. Dull sound, buzz haptic. A message names both cards and the consequence, held at least 2.5 seconds, dismissible early by tap.
- **Known mismatch:** if the player arms a card whose identity they already know, and it does not match the discard, the commit tap raises a confirmation instead of firing. Unknown cards commit on the second tap with no extra step.
- **Lost the race:** if the server rejects your attempt because someone beat you, the card returns to rest with a short fade, no error styling. You did not do anything wrong.
- Flips happening to you while it is not your turn need a peripheral cue: brief screen-edge glow in the relevant color plus haptic, because you will be looking somewhere else.

While the local player has an open action of their own (`TURN_DRAW`, `TURN_CHOICE`, `POWER_TARGETING`, `GIVE_CARD_PENDING`), taps are routed exclusively to targeting. Flip is unreachable, even if an opponent's flip changes the pile and would otherwise make a card match.

### 6.9 Give a card after a flip
The giver's hand lifts into a selectable state. Once chosen, the card travels across the table to the recipient's grid and lands face down. Long travel, 500ms, so everyone tracks where it went. The recipient does not see it.

If the giver has zero cards, a card flies from the deck to the recipient instead, with a distinct blind treatment so it is clear nobody chose it.

### 6.10 Hell onto heaven
The rarest legal move in the game and it deserves the biggest moment. Ember and pale-blue rim lights converge, both cards flare, and the pair leaves the pile together. Up to 1.2s. This may block briefly since it ends a flip window anyway.

### 6.11 Calling cambeo
Full-screen moment. The table dims, the caller's pod scales up with a gold ring, and the word CAMBEO renders large and fades. 1.2s, then the final round begins with a persistent "final round" banner and a turn counter. This happens once per game.

### 6.12 Scoring
Sequential reveal, not simultaneous. Each player's hand flips one card at a time with a 120ms stagger, their running total counting up with tabular digits as it goes, then their total locks in. Go around the table in turn order, ending with the cambeo caller. The suspense is the whole payoff of the round and simultaneous reveal throws it away.

---

## 7. Feedback beyond motion

- **Haptics** on every state change that affects you: your turn beginning, a successful flip, a penalty, a card given to you. `navigator.vibrate` where available, short patterns, distinct per event.
- **Sound**, on by default with a persistent mute toggle. Card slide, card land, flip success, flip fail, turn chime, cambeo. Short samples, no music. Preload with the assets.
- **Event log** entries animate in from the top with a 200ms slide and fade, so a player who missed something can find it.

---

## 8. Accessibility and input

- `prefers-reduced-motion: reduce` replaces all travel and flourish with 150ms cross-fades. Cards change state without moving. Keep the reveal lift as a scale-free fade. Do not ship a version that removes the information the motion was carrying.
- Minimum 44px touch target on every interactive element. At the 30px card floor, opponent cards need an invisible expanded hit area.
- Gate all hover styling behind `@media (hover: hover) and (pointer: fine)`.
- Focus rings in `--accent` on every interactive element, visible, never removed.
- Respect safe-area insets. The action bar sits above the home indicator.
- Never rely on color alone for flip outcome, turn state, or the heaven/hell distinction.

### 8.1 Flip input routing

| Local phase | Tap on your card | Tap on opponent card |
| --- | --- | --- |
| Idle, not your turn | Arm / commit flip | Arm / commit flip |
| Your turn, `TURN_DRAW` | No-op | No-op |
| `TURN_CHOICE` | Select replace slot | No-op |
| `POWER_TARGETING` | Select target, if legal for this step | Select target, if legal for this step |
| `GIVE_CARD_PENDING` | Select card to give | No-op |
| After you called cambeo | No-op | No-op |
| Opponent's card, they called cambeo | No-op, shake | No-op, shake |

Every no-op still gives feedback: a short shake or dim pulse. A tap that does nothing must never look like a tap that was dropped.

---

## 9. What not to do

- No felt texture, no wood grain, no table skeuomorphism.
- No particle systems, confetti, or screen shake outside of the scoring screen.
- No animation that blocks input on the flip path.
- No `transition: all`, no layout-property animation, no `scale(0)` entrances.
- No glassmorphism or heavy blur. It is expensive on phones and this app is animating a lot of nodes at once.
- No more than one accent color in normal play. Heaven and hell are exceptions and they are earned.
- Do not animate the turn indicator on a loop. It is on screen constantly and a looping animation on a persistent element becomes visual noise within two minutes.
