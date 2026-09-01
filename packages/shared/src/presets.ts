import type { CardKey } from './cards.js';
import type { PowerId } from './powers.js';
import type { RuleSet } from './ruleset.js';

/** House Rules defaults from docs/cambeo-rules.md. Single source for preset values. */
const HOUSE_VALUES: Record<CardKey, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 10,
  Q_RED: -1,
  Q_BLACK: 10,
  K_RED: -2,
  K_BLACK: 10,
  HEAVEN: -4,
  HELL: 15,
};

const HOUSE_POWERS: Record<CardKey, PowerId> = {
  A: 'NONE',
  '2': 'NONE',
  '3': 'NONE',
  '4': 'NONE',
  '5': 'NONE',
  '6': 'PEEK_OWN',
  '7': 'PEEK_OWN',
  '8': 'PEEK_OTHER',
  '9': 'PEEK_OTHER',
  '10': 'BLIND_SWAP',
  J: 'LOOK_THEN_BLIND_SWAP',
  Q_RED: 'NONE',
  Q_BLACK: 'NONE',
  K_RED: 'NONE',
  K_BLACK: 'NONE',
  HEAVEN: 'NONE',
  HELL: 'NONE',
};

export const HOUSE_RULES: RuleSet = {
  version: 1,
  jokers: true,
  values: HOUSE_VALUES,
  powers: HOUSE_POWERS,
  handSize: 4,
  initialRevealCount: 2,
  initialPeekDurationMs: 8000,
  powerRevealDurationMs: 4000,
  flipRevealDurationMs: 2500,
  lossThreshold: 6,
  minPlayers: 3,
  maxPlayers: 8,
  heavenDiscardableAfterCambeo: false,
  hellDiscardOnlyOntoHeaven: true,
};
