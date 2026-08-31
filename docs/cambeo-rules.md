# Cambeo — House Rules

A memory and manipulation card game. Also known as Cambio, Cabo, Pablo, or Cactus. These are the house rules this app implements as its defaults.

**Goal: end the game with the fewest points in your hand.**

Minimum 3 players.

---

## The Deck

A standard 52-card deck, plus two optional jokers.

Each card's point value is printed in the bottom right corner of the card. You never need to memorize the table below.

| Card | Points |
| --- | --- |
| Ace | 1 |
| 2 – 10 | Face value |
| Jack (red or black) | 10 |
| Queen ♥ ♦ (red) | -1 |
| Queen ♣ ♠ (black) | 10 |
| King ♥ ♦ (red) | -2 |
| King ♣ ♠ (black) | 10 |
| Joker (red) — **heaven** | -4 |
| Joker (black) — **hell** | +15 |

**The red joker is heaven. The black joker is hell.** Both are labeled by name on the card face so there is no chance of confusing a -4 with a +15.

The jokers are optional and are toggled on or off before the game starts. When enabled they are shuffled into the deck and are dealt and drawn like any other card.

> **TODO:** heaven and hell have additional special rules that are not yet documented here.

Every value in this table is editable in the game settings before a game begins.

---

## Setup

1. Each player is dealt **4 cards**, face down. The host can raise this to as many as **6** in settings.
2. Two of your cards are revealed to you, and only to you, at the start.
3. **Memorize them.** Once play begins you cannot look at your own cards again unless a power lets you.
4. The remaining deck sits face down in the middle, with a discard pile beside it.

---

## Taking a Turn

On your turn:

1. **Draw** one card, either from the top of the deck or from the top of the discard pile.
2. Then choose one:
   - **Discard it to use its power.** The card goes to the discard pile and its power resolves immediately.
   - **Replace one of your own cards with it.** Your old card goes face up on the discard pile. Nothing triggers.

**A card drawn from the discard pile can never be used for its power.** It can only be swapped into your hand.

If the deck runs out, the discard pile is shuffled and becomes the new deck.

---

## Card Powers

These are the defaults. All of them are editable before the game starts, and any card can be assigned any power or none.

| Card | Power |
| --- | --- |
| 6, 7 | **Peek** — look at one of your own cards |
| 8, 9 | **Spy** — look at one of another player's cards |
| 10 | **Blind swap** — swap any two cards on the table, without looking at either |
| J | **Look and swap** — look at any one other player's card, then swap any two cards on the table, without looking |

You do not need to remember which cards have powers. The game prompts you when a power triggers and walks you through targeting it.

---

## Flipping

Flipping is the fast, chaotic part of the game, and it runs continuously, not just on your turn.

**At any point you can tap any card on the table — your own or another player's — to flip it face up.**

A flip is correct if the flipped card **matches the rank** of the top card on the discard pile. **Rank only, color and suit are ignored.** A black Queen flips successfully onto a red Queen even though they are worth different points.

- **Correct flip on your own card:** the card is discarded and you now have one fewer card. This is good.
- **Correct flip on someone else's card:** their card is discarded, and you **must** give them a card from your own hand. You choose which. If you have zero cards, they instead draw a random card from the deck and do not get to see it.
- **Incorrect flip:** you draw a penalty card and add it to your hand.

Constraints:

- **Only one successful flip per discard.** First one to land it wins; everyone else is too late.
- **You cannot flip on your own discard during your own turn.**
- **If you ever have more than 6 cards, you lose.**

---

## Running Out of Cards

Reaching zero cards does **not** end the game and does not automatically win it, because negative totals are possible. A player at zero can either call cambeo, or keep taking turns and drawing in the hope of picking up a negative card.

There are no eliminated players. Everyone plays until the game ends.

---

## Calling Cambeo

When you think you have the fewest points, on your turn and **before you draw**, you may call **"Cambeo."** Your turn immediately ends.

- Every other player takes **one more turn** to try to get their hand below yours.
- After you call, **no one may touch your cards** — no swaps, no flips, no powers targeting you.
- After you call, **you may not flip** any cards either.

Once that final round is over the game ends. All hands are revealed and scored. Lowest total wins.

**Ties go against the caller.** If anyone ties or beats the caller's score, that player wins instead.

The game is over at that point. Start a new one to play again.

---

## Quick Reference

- Fewest points wins.
- Red Queen is -1, red King is -2, heaven (red joker) is -4. These are the cards you want.
- Hell (black joker) is +15. Get rid of it.
- Black face cards and 10s are 10 points each.
- Powers only fire on cards drawn from the deck, never from the discard pile.
- Flips match on rank only.
- Flip fast, but a bad flip costs you a card, and more than 6 cards means you lose.
- After someone calls cambeo, they are untouchable and everyone else gets exactly one turn.
