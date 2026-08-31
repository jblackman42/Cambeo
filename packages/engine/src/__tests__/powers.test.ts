import { describe, expect, it } from 'vitest';
import { HOUSE_RULES, type RuleSet } from '@cambeo/shared';
import { knows } from '../index.js';
import {
  apply,
  hasEvent,
  P1,
  P2,
  P3,
  rejected,
  startStacked,
} from '../testkit.js';

function powerSetup(deckCard: { key: '6' | '8' | '10' | 'J' | 'A' }) {
  return startStacked({
    hands: {
      p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
      p2: [{ key: '5' }, { key: 'K_RED' }, { key: 'Q_RED' }, { key: '7' }],
      p3: [{ key: '9' }, { key: 'K_BLACK' }, { key: 'Q_BLACK' }, { key: 'HEAVEN' }],
    },
    deck: [deckCard, { key: '2' }],
    discard: [{ key: 'K_BLACK' }],
  });
}

function drawAndDiscardForPower(deckCard: { key: '6' | '8' | '10' | 'J' }) {
  let state = powerSetup(deckCard);
  state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
  state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
  return state;
}

describe('powers', () => {
  it('PEEK_OWN grants knowledge to the actor only', () => {
    let state = drawAndDiscardForPower({ key: '6' });
    expect(state.pendingPower?.powerId).toBe('PEEK_OWN');
    const targetId = state.players[P1]!.hand[2]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P1, slotIndex: 2 },
    });
    expect(knows(state, P1, targetId)).toBe(true);
    expect(knows(state, P2, targetId)).toBe(false);
    expect(hasEvent(state, 'POWER_COMPLETED')).toBe(true);
  });

  it('PEEK_OTHER grants knowledge to the actor only', () => {
    let state = drawAndDiscardForPower({ key: '8' });
    const targetId = state.players[P2]!.hand[1]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 1 },
    });
    expect(knows(state, P1, targetId)).toBe(true);
    expect(knows(state, P3, targetId)).toBe(false);
  });

  it('BLIND_SWAP grants the swapper nothing', () => {
    let state = drawAndDiscardForPower({ key: '10' });
    const aId = state.players[P1]!.hand[0]!;
    const bId = state.players[P2]!.hand[0]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P1, slotIndex: 0 },
    });
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
    });
    expect(knows(state, P1, aId)).toBe(false);
    expect(knows(state, P1, bId)).toBe(false);
    expect(state.players[P1]!.hand[0]).toBe(bId);
    expect(state.players[P2]!.hand[0]).toBe(aId);
  });

  it('blind swap destroys both owners slot knowledge', () => {
    let state = drawAndDiscardForPower({ key: '10' });
    const aId = state.players[P1]!.hand[0]!;
    const bId = state.players[P2]!.hand[0]!;
    // P1 knows their first card from initial peek
    expect(knows(state, P1, aId)).toBe(true);
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P1, slotIndex: 0 },
    });
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
    });
    expect(knows(state, P1, aId)).toBe(false);
    expect(knows(state, P2, bId)).toBe(false);
  });

  it('LOOK_THEN_BLIND_SWAP reveals then swaps', () => {
    let state = drawAndDiscardForPower({ key: 'J' });
    const peekId = state.players[P2]!.hand[0]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
    });
    expect(knows(state, P1, peekId)).toBe(true);
    expect(state.phase).toBe('POWER_TARGETING');
    const aId = state.players[P1]!.hand[1]!;
    const bId = state.players[P3]!.hand[1]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P1, slotIndex: 1 },
    });
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P3, slotIndex: 1 },
    });
    expect(hasEvent(state, 'POWER_SWAP')).toBe(true);
    expect(state.players[P1]!.hand[1]).toBe(bId);
    expect(state.players[P3]!.hand[1]).toBe(aId);
    // Peek knowledge of peekId was cleared by the subsequent swap of different cards —
    // peekId itself wasn't swapped, but LOOK_THEN_BLIND_SWAP: reveal then swap any two.
    // Knowledge of peeked card persists until THAT card is swapped. peekId wasn't in the swap.
    // After blind swap of other cards, peekId knowledge: clearKnowledge only clears swapped cards.
    // So P1 should still know peekId... unless we cleared all. We only clear swapped.
    // But wait - initial reveal of peek granted knowledge, then swap cleared aId and bId only.
    expect(knows(state, P1, peekId)).toBe(true);
  });

  it('LOOK_THEN_BLIND_SWAP can swap the card that was looked at', () => {
    let state = drawAndDiscardForPower({ key: 'J' });
    const peekId = state.players[P2]!.hand[0]!;
    const ownId = state.players[P1]!.hand[1]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
    });
    expect(knows(state, P1, peekId)).toBe(true);
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
    });
    expect(rejected(state)).toBe(false);
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P1, slotIndex: 1 },
    });
    expect(hasEvent(state, 'POWER_SWAP')).toBe(true);
    expect(state.players[P1]!.hand[1]).toBe(peekId);
    expect(state.players[P2]!.hand[0]).toBe(ownId);
  });

  it('LOOK_THEN_BLIND_SWAP skip when cambeo lock and empty hands leave no look or swap', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'Q_RED' }],
        p2: [],
        p3: [{ key: 'Q_BLACK' }],
      },
      deck: [{ key: 'A' }, { key: 'J' }, { key: '2' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    state = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P2 });
    state = apply(state, { type: 'DRAW_DECK', playerId: P3 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P3 });
    expect(state.pendingPower?.powerId).toBe('LOOK_THEN_BLIND_SWAP');
    expect(state.phase).toBe('POWER_TARGETING');

    const skipped = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P3,
      target: { kind: 'SKIP' },
    });
    expect(rejected(skipped)).toBe(false);
    expect(hasEvent(skipped, 'POWER_STEP_SKIPPED')).toBe(true);
    expect(hasEvent(skipped, 'POWER_COMPLETED')).toBe(true);
    expect(hasEvent(skipped, 'POWER_SWAP')).toBe(false);
    expect(skipped.pendingPower).toBeNull();
    expect(skipped.phase).toBe('OVER');
  });

  it('LOOK_THEN_BLIND_SWAP skips a locked look then still swaps own cards', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'Q_RED' }, { key: 'A' }, { key: '2' }, { key: '3' }],
        p2: [],
        p3: [{ key: 'Q_BLACK' }, { key: '4' }, { key: '5' }, { key: '6' }],
      },
      deck: [{ key: 'A' }, { key: 'J' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    state = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P2 });
    state = apply(state, { type: 'DRAW_DECK', playerId: P3 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P3 });
    expect(state.pendingPower?.powerId).toBe('LOOK_THEN_BLIND_SWAP');
    expect(state.pendingPower?.stepIndex).toBe(0);

    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P3,
      target: { kind: 'SKIP' },
    });
    expect(rejected(state)).toBe(false);
    expect(state.pendingPower?.stepIndex).toBe(1);
    expect(hasEvent(state, 'POWER_COMPLETED')).toBe(false);

    const aId = state.players[P3]!.hand[0]!;
    const bId = state.players[P3]!.hand[1]!;
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P3,
      target: { kind: 'CARD', playerId: P3, slotIndex: 0 },
    });
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P3,
      target: { kind: 'CARD', playerId: P3, slotIndex: 1 },
    });
    expect(hasEvent(state, 'POWER_SWAP')).toBe(true);
    expect(state.players[P3]!.hand[0]).toBe(bId);
    expect(state.players[P3]!.hand[1]).toBe(aId);
  });

  it('BLIND_SWAP skip when fewer than two legal cards remain', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'Q_RED' }],
        p2: [{ key: 'A' }],
        p3: [],
      },
      deck: [{ key: '10' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    state = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P2 });
    expect(state.pendingPower?.powerId).toBe('BLIND_SWAP');
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P2,
      target: { kind: 'SKIP' },
    });
    expect(rejected(state)).toBe(false);
    expect(hasEvent(state, 'POWER_COMPLETED')).toBe(true);
    expect(hasEvent(state, 'POWER_SWAP')).toBe(false);
  });

  it('PEEK_OTHER skip when the only other cards belong to the cambeo caller', () => {
    let state = startStacked({
      hands: {
        p1: [{ key: 'Q_RED' }],
        p2: [{ key: 'A' }],
        p3: [],
      },
      deck: [{ key: '8' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'CALL_CAMBEO', playerId: P1 });
    state = apply(state, { type: 'DRAW_DECK', playerId: P2 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P2 });
    expect(state.pendingPower?.powerId).toBe('PEEK_OTHER');
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P2,
      target: { kind: 'SKIP' },
    });
    expect(rejected(state)).toBe(false);
    expect(hasEvent(state, 'POWER_COMPLETED')).toBe(true);
  });

  it('SKIP is rejected when legal targets still exist', () => {
    const state = drawAndDiscardForPower({ key: 'J' });
    const next = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'SKIP' },
    });
    expect(rejected(next)).toBe(true);
  });

  it('LOOK_THEN_OPTIONAL_SWAP can decline', () => {
    const rules: RuleSet = {
      ...HOUSE_RULES,
      powers: { ...HOUSE_RULES.powers, '6': 'LOOK_THEN_OPTIONAL_SWAP' },
    };
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '7' }, { key: '8' }, { key: '9' }],
        p3: [{ key: '10' }, { key: 'J' }, { key: 'Q_RED' }, { key: 'K_RED' }],
      },
      deck: [{ key: '6' }],
      discard: [{ key: 'K_BLACK' }],
      ruleSet: rules,
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 }, rules);
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 }, rules);
    state = apply(
      state,
      {
        type: 'RESOLVE_POWER_TARGET',
        playerId: P1,
        target: { kind: 'CARD', playerId: P1, slotIndex: 2 },
      },
      rules,
    );
    state = apply(
      state,
      {
        type: 'RESOLVE_POWER_TARGET',
        playerId: P1,
        target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
      },
      rules,
    );
    const handBefore = [...state.players[P1]!.hand];
    state = apply(
      state,
      {
        type: 'RESOLVE_POWER_TARGET',
        playerId: P1,
        target: { kind: 'CONFIRM', swap: false },
      },
      rules,
    );
    expect(hasEvent(state, 'POWER_DECLINED_SWAP')).toBe(true);
    expect(state.players[P1]!.hand).toEqual(handBefore);
  });

  it('SHUFFLE_TARGET_HAND permutes from the rng and destroys slot knowledge', () => {
    const rules: RuleSet = {
      ...HOUSE_RULES,
      powers: { ...HOUSE_RULES.powers, '6': 'SHUFFLE_TARGET_HAND' },
    };
    let state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: '7' }, { key: '8' }, { key: '9' }],
        p3: [{ key: '10' }, { key: 'J' }, { key: 'Q_RED' }, { key: 'K_RED' }],
      },
      deck: [{ key: '6' }],
      discard: [{ key: 'K_BLACK' }],
      ruleSet: rules,
      seed: 'shuffle-seed',
    });
    const before = [...state.players[P2]!.hand];
    const knownBefore = before[0]!;
    expect(knows(state, P2, knownBefore)).toBe(true);
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 }, rules);
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 }, rules);
    state = apply(
      state,
      {
        type: 'RESOLVE_POWER_TARGET',
        playerId: P1,
        target: { kind: 'PLAYER', playerId: P2 },
      },
      rules,
    );
    expect(hasEvent(state, 'POWER_SHUFFLE')).toBe(true);
    const after = state.players[P2]!.hand;
    expect(after).toHaveLength(before.length);
    expect([...after].sort()).toEqual([...before].sort());
    // Knowledge of those cards cleared
    for (const id of before) {
      expect(knows(state, P2, id)).toBe(false);
    }
  });

  it('powers are read from the RuleSet, not the rank', () => {
    const rules: RuleSet = {
      ...HOUSE_RULES,
      powers: { ...HOUSE_RULES.powers, A: 'PEEK_OWN', '6': 'NONE' },
    };
    let state = startStacked({
      hands: {
        p1: [{ key: '2' }, { key: '3' }, { key: '4' }, { key: '5' }],
        p2: [{ key: '7' }, { key: '8' }, { key: '9' }, { key: '10' }],
        p3: [{ key: 'J' }, { key: 'Q_RED' }, { key: 'K_RED' }, { key: 'Q_BLACK' }],
      },
      deck: [{ key: 'A' }],
      discard: [{ key: 'K_BLACK' }],
      ruleSet: rules,
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 }, rules);
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 }, rules);
    expect(state.pendingPower?.powerId).toBe('PEEK_OWN');
  });

  it('an out-of-spec target is rejected', () => {
    const state = drawAndDiscardForPower({ key: '6' });
    const next = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P2, slotIndex: 0 },
    });
    expect(rejected(next)).toBe(true);
  });

  it('targeting survives an interleaved flip', () => {
    let state = drawAndDiscardForPower({ key: '6' });
    expect(state.phase).toBe('POWER_TARGETING');
    // P2 flips successfully on someone else's matching card while P1 targets
    // Put a matching card: discard top is whatever was discarded (6). Give P3 a 6.
    // Actually discard top is the 6 just discarded. Need another 6 in a hand.
    state = startStacked({
      hands: {
        p1: [{ key: 'A' }, { key: '2' }, { key: '3' }, { key: '4' }],
        p2: [{ key: '5' }, { key: 'K_RED' }, { key: 'Q_RED' }, { key: '7' }],
        p3: [{ key: '6' }, { key: 'K_BLACK' }, { key: 'Q_BLACK' }, { key: 'HEAVEN' }],
      },
      deck: [{ key: '6' }, { key: '8' }],
      discard: [{ key: 'K_BLACK' }],
    });
    state = apply(state, { type: 'DRAW_DECK', playerId: P1 });
    state = apply(state, { type: 'DISCARD_DRAWN', playerId: P1 });
    expect(state.phase).toBe('POWER_TARGETING');
    // Flip P3's 6 onto discarded 6
    state = apply(state, {
      type: 'FLIP_ATTEMPT',
      playerId: P2,
      target: { playerId: P3, slotIndex: 0 },
    });
    expect(hasEvent(state, 'FLIP_SUCCESS')).toBe(true);
    expect(state.phase).toBe('GIVE_CARD_PENDING');
    // Give card to continue
    state = apply(state, { type: 'GIVE_CARD', playerId: P2, slotIndex: 0 });
    expect(state.phase).toBe('POWER_TARGETING');
    expect(state.pendingPower?.powerId).toBe('PEEK_OWN');
    state = apply(state, {
      type: 'RESOLVE_POWER_TARGET',
      playerId: P1,
      target: { kind: 'CARD', playerId: P1, slotIndex: 0 },
    });
    expect(hasEvent(state, 'POWER_COMPLETED')).toBe(true);
  });
});
