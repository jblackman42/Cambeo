import { describe, expect, it } from 'vitest';
import { HOUSE_RULES } from './presets.js';
import {
  cloneRuleSet,
  decodeRuleSetCode,
  encodeRuleSetCode,
  isHouseRules,
  ruleSetsEqual,
} from './ruleset-codec.js';
import { RuleSetSchema, summarizeDeck, validateForTable } from './ruleset.js';

describe('RuleSet schema', () => {
  it('House Rules include default reveal durations', () => {
    expect(HOUSE_RULES.initialPeekDurationMs).toBe(8000);
    expect(HOUSE_RULES.powerRevealDurationMs).toBe(4000);
  });

  it('rejects initialRevealCount above handSize', () => {
    const result = RuleSetSchema.safeParse({
      ...HOUSE_RULES,
      handSize: 4,
      initialRevealCount: 5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects lossThreshold below handSize', () => {
    const result = RuleSetSchema.safeParse({
      ...HOUSE_RULES,
      handSize: 5,
      lossThreshold: 4,
    });
    expect(result.success).toBe(false);
  });

  it('rejects handSize outside 4–6', () => {
    expect(RuleSetSchema.safeParse({ ...HOUSE_RULES, handSize: 3, lossThreshold: 6 }).success).toBe(
      false,
    );
    expect(RuleSetSchema.safeParse({ ...HOUSE_RULES, handSize: 7, lossThreshold: 7 }).success).toBe(
      false,
    );
  });
});

describe('validateForTable', () => {
  it('refuses a deck that cannot deal plus one leftover', () => {
    const cramped = {
      ...HOUSE_RULES,
      handSize: 6,
      lossThreshold: 6,
      jokers: false,
      maxPlayers: 10,
    };
    expect(validateForTable(cramped, 9).ok).toBe(false);
    expect(validateForTable(HOUSE_RULES, 3).ok).toBe(true);
  });
});

describe('summarizeDeck', () => {
  it('summarizes House Rules', () => {
    const summary = summarizeDeck(HOUSE_RULES);
    expect(summary.cardCount).toBe(54);
    expect(summary.minCardValue).toBe(-4);
    expect(summary.maxCardValue).toBe(15);
    expect(summary.poweredCardCount).toBe(24);
    expect(summary.minHand).toBe(-9);
    expect(summary.maxHand).toBe(45);
  });

  it('drops jokers from the count when they are off', () => {
    const summary = summarizeDeck({ ...HOUSE_RULES, jokers: false });
    expect(summary.cardCount).toBe(52);
    expect(summary.minCardValue).toBe(-2);
    expect(summary.maxCardValue).toBe(10);
  });
});

describe('ruleset codec', () => {
  it('encodes House Rules as c1 and round-trips', () => {
    expect(encodeRuleSetCode(HOUSE_RULES)).toBe('c1');
    expect(decodeRuleSetCode('c1')).toEqual(HOUSE_RULES);
    expect(decodeRuleSetCode('house')).toEqual(HOUSE_RULES);
    expect(isHouseRules(HOUSE_RULES)).toBe(true);
  });

  it('round-trips a custom patch', () => {
    const custom = cloneRuleSet(HOUSE_RULES);
    custom.jokers = false;
    custom.handSize = 5;
    custom.lossThreshold = 6;
    custom.initialRevealCount = 1;
    custom.values.Q_RED = 0;
    custom.powers['10'] = 'NONE';
    const code = encodeRuleSetCode(custom);
    expect(code.startsWith('c1.')).toBe(true);
    const decoded = decodeRuleSetCode(code);
    expect(decoded).not.toBeNull();
    expect(ruleSetsEqual(decoded!, custom)).toBe(true);
    expect(isHouseRules(decoded!)).toBe(false);
  });

  it('accepts a pasted full RuleSet JSON', () => {
    const custom = { ...HOUSE_RULES, handSize: 6, lossThreshold: 6 };
    const decoded = decodeRuleSetCode(JSON.stringify(custom));
    expect(decoded).not.toBeNull();
    expect(ruleSetsEqual(decoded!, custom)).toBe(true);
  });

  it('returns null for garbage', () => {
    expect(decodeRuleSetCode('not-a-code')).toBeNull();
    expect(decodeRuleSetCode('c1.%%%')).toBeNull();
  });
});
