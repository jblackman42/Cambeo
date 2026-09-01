import { CARD_KEYS, type CardKey } from './cards.js';
import { HOUSE_RULES } from './presets.js';
import type { PowerId } from './powers.js';
import { parseRuleSet, type RuleSet } from './ruleset.js';

const CODE_PREFIX = 'c1';

interface RuleSetPatch {
  jokers?: boolean;
  values?: Partial<Record<CardKey, number>>;
  powers?: Partial<Record<CardKey, PowerId>>;
  handSize?: number;
  initialRevealCount?: number;
  initialPeekDurationMs?: number;
  powerRevealDurationMs?: number;
  lossThreshold?: number;
  minPlayers?: number;
  maxPlayers?: number;
  heavenDiscardableAfterCambeo?: boolean;
  hellDiscardOnlyOntoHeaven?: boolean;
}

const SCALAR_KEYS = [
  'jokers',
  'handSize',
  'initialRevealCount',
  'initialPeekDurationMs',
  'powerRevealDurationMs',
  'lossThreshold',
  'minPlayers',
  'maxPlayers',
  'heavenDiscardableAfterCambeo',
  'hellDiscardOnlyOntoHeaven',
] as const;

function utf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToUtf8(code: string): string | null {
  const padded = code.replaceAll('-', '+').replaceAll('_', '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  try {
    const bin = atob(padded + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function patchFrom(ruleSet: RuleSet): RuleSetPatch {
  const patch: RuleSetPatch = {};
  for (const key of SCALAR_KEYS) {
    if (ruleSet[key] !== HOUSE_RULES[key]) {
      (patch as Record<string, unknown>)[key] = ruleSet[key];
    }
  }

  const values: Partial<Record<CardKey, number>> = {};
  const powers: Partial<Record<CardKey, PowerId>> = {};
  for (const key of CARD_KEYS) {
    if (ruleSet.values[key] !== HOUSE_RULES.values[key]) {
      values[key] = ruleSet.values[key];
    }
    if (ruleSet.powers[key] !== HOUSE_RULES.powers[key]) {
      powers[key] = ruleSet.powers[key];
    }
  }
  if (Object.keys(values).length > 0) patch.values = values;
  if (Object.keys(powers).length > 0) patch.powers = powers;
  return patch;
}

function applyPatch(patch: RuleSetPatch): RuleSet {
  return parseRuleSet({
    ...HOUSE_RULES,
    ...Object.fromEntries(
      SCALAR_KEYS.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]),
    ),
    values: { ...HOUSE_RULES.values, ...patch.values },
    powers: { ...HOUSE_RULES.powers, ...patch.powers },
  });
}

function isPatchObject(value: unknown): value is RuleSetPatch {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Canonical short code. House Rules is `c1`; custom is `c1.` plus a URL-safe patch. */
export function encodeRuleSetCode(ruleSet: RuleSet): string {
  const patch = patchFrom(ruleSet);
  if (Object.keys(patch).length === 0) return CODE_PREFIX;
  return `${CODE_PREFIX}.${utf8ToBase64Url(JSON.stringify(patch))}`;
}

export function decodeRuleSetCode(input: string): RuleSet | null {
  const raw = input.trim();
  if (
    raw === '' ||
    raw.toLowerCase() === 'house' ||
    raw === CODE_PREFIX ||
    raw === `${CODE_PREFIX}.`
  ) {
    return HOUSE_RULES;
  }

  if (raw.startsWith(`${CODE_PREFIX}.`)) {
    const decoded = base64UrlToUtf8(raw.slice(CODE_PREFIX.length + 1));
    if (decoded === null) return null;
    try {
      const parsed: unknown = JSON.parse(decoded);
      if (!isPatchObject(parsed)) return null;
      return applyPatch(parsed);
    } catch {
      return null;
    }
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPatchObject(parsed)) return null;
    if ('version' in parsed && 'values' in parsed && 'powers' in parsed) {
      return parseRuleSet(parsed);
    }
    return applyPatch(parsed);
  } catch {
    return null;
  }
}

export function ruleSetsEqual(a: RuleSet, b: RuleSet): boolean {
  return encodeRuleSetCode(a) === encodeRuleSetCode(b);
}

export function cloneRuleSet(ruleSet: RuleSet): RuleSet {
  return parseRuleSet(JSON.parse(JSON.stringify(ruleSet)) as unknown);
}

export function isHouseRules(ruleSet: RuleSet): boolean {
  return ruleSetsEqual(ruleSet, HOUSE_RULES);
}
