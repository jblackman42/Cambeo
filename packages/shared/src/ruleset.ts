import { z } from 'zod';
import { CARD_KEYS, deckSizeFromComposition, type CardKey } from './cards.js';
import { POWER_IDS, type PowerId } from './powers.js';

const cardKeySchema = z.enum(CARD_KEYS);
const powerIdSchema = z.enum(POWER_IDS);

const valuesSchema = z.record(cardKeySchema, z.number());
const powersSchema = z.record(cardKeySchema, powerIdSchema);

export const RuleSetSchema = z
  .object({
    version: z.literal(1),
    jokers: z.boolean(),
    values: valuesSchema,
    powers: powersSchema,
    handSize: z.number().int().min(1).max(6),
    initialRevealCount: z.number().int().min(0),
    lossThreshold: z.number().int().min(1),
    minPlayers: z.number().int().min(2),
    maxPlayers: z.number().int().min(2),
    heavenDiscardableAfterCambeo: z.boolean(),
    hellDiscardOnlyOntoHeaven: z.boolean(),
  })
  .superRefine((data, ctx) => {
    for (const key of CARD_KEYS) {
      if (!(key in data.values)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing value for card key ${key}`,
          path: ['values', key],
        });
      }
      if (!(key in data.powers)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing power for card key ${key}`,
          path: ['powers', key],
        });
      }
    }

    if (data.initialRevealCount > data.handSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'initialRevealCount must be <= handSize',
        path: ['initialRevealCount'],
      });
    }

    if (data.lossThreshold < data.handSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lossThreshold must be >= handSize',
        path: ['lossThreshold'],
      });
    }

    if (data.maxPlayers < data.minPlayers) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maxPlayers must be >= minPlayers',
        path: ['maxPlayers'],
      });
    }
  });

export type RuleSet = z.infer<typeof RuleSetSchema>;

export function parseRuleSet(input: unknown): RuleSet {
  return RuleSetSchema.parse(input);
}

export function deckSize(ruleSet: RuleSet): number {
  return deckSizeFromComposition(ruleSet.jokers);
}

export interface TableValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validate a RuleSet against a specific player count before starting. */
export function validateForTable(ruleSet: RuleSet, playerCount: number): TableValidationResult {
  const errors: string[] = [];
  const parsed = RuleSetSchema.safeParse(ruleSet);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(issue.message);
    }
    return { ok: false, errors };
  }

  if (playerCount < ruleSet.minPlayers) {
    errors.push(`Need at least ${ruleSet.minPlayers} players (have ${playerCount})`);
  }
  if (playerCount > ruleSet.maxPlayers) {
    errors.push(`At most ${ruleSet.maxPlayers} players (have ${playerCount})`);
  }

  const size = deckSize(ruleSet);
  if (ruleSet.handSize * playerCount + 1 > size) {
    errors.push(
      `Deck too small: handSize (${ruleSet.handSize}) * players (${playerCount}) + 1 > deckSize (${size})`,
    );
  }

  for (const key of CARD_KEYS) {
    const power = ruleSet.powers[key as CardKey];
    if (power !== undefined && !(POWER_IDS as readonly string[]).includes(power)) {
      errors.push(`Unknown power id for ${key}: ${power}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function cardValue(ruleSet: RuleSet, key: CardKey): number {
  const value = ruleSet.values[key];
  if (value === undefined) {
    throw new Error(`Missing value for card key ${key}`);
  }
  return value;
}

export function cardPower(ruleSet: RuleSet, key: CardKey): PowerId {
  const power = ruleSet.powers[key];
  if (power === undefined) {
    throw new Error(`Missing power for card key ${key}`);
  }
  return power;
}
