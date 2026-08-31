export const POWER_IDS = [
  'PEEK_OWN',
  'PEEK_OTHER',
  'BLIND_SWAP',
  'LOOK_THEN_BLIND_SWAP',
  'LOOK_THEN_OPTIONAL_SWAP',
  'SHUFFLE_TARGET_HAND',
  'NONE',
] as const;

export type PowerId = (typeof POWER_IDS)[number];

export type PowerTargetKind =
  | 'OWN_CARD'
  | 'OTHER_CARD'
  | 'ANY_CARD'
  | 'ANY_PLAYER'
  | 'CONFIRM';

export type PowerStepEffect = 'REVEAL' | 'SELECT_FOR_SWAP' | 'SHUFFLE' | 'CONFIRM_SWAP';

export interface PowerStep {
  kind: PowerTargetKind;
  effect: PowerStepEffect;
  /** When true, the player may skip this step (e.g. optional swap). */
  optional?: boolean;
}

export interface PowerDefinition {
  id: PowerId;
  steps: readonly PowerStep[];
}

/**
 * Data-driven power registry. The engine walks steps; the UI can generate
 * prompts from the same definitions without per-power UI code.
 */
export const POWER_DEFINITIONS: Record<PowerId, PowerDefinition> = {
  NONE: { id: 'NONE', steps: [] },
  PEEK_OWN: {
    id: 'PEEK_OWN',
    steps: [{ kind: 'OWN_CARD', effect: 'REVEAL' }],
  },
  PEEK_OTHER: {
    id: 'PEEK_OTHER',
    steps: [{ kind: 'OTHER_CARD', effect: 'REVEAL' }],
  },
  BLIND_SWAP: {
    id: 'BLIND_SWAP',
    steps: [
      { kind: 'ANY_CARD', effect: 'SELECT_FOR_SWAP' },
      { kind: 'ANY_CARD', effect: 'SELECT_FOR_SWAP' },
    ],
  },
  LOOK_THEN_BLIND_SWAP: {
    id: 'LOOK_THEN_BLIND_SWAP',
    steps: [
      { kind: 'OTHER_CARD', effect: 'REVEAL' },
      { kind: 'ANY_CARD', effect: 'SELECT_FOR_SWAP' },
      { kind: 'ANY_CARD', effect: 'SELECT_FOR_SWAP' },
    ],
  },
  LOOK_THEN_OPTIONAL_SWAP: {
    id: 'LOOK_THEN_OPTIONAL_SWAP',
    steps: [
      { kind: 'OWN_CARD', effect: 'REVEAL' },
      { kind: 'OTHER_CARD', effect: 'REVEAL' },
      { kind: 'CONFIRM', effect: 'CONFIRM_SWAP', optional: true },
    ],
  },
  SHUFFLE_TARGET_HAND: {
    id: 'SHUFFLE_TARGET_HAND',
    steps: [{ kind: 'ANY_PLAYER', effect: 'SHUFFLE' }],
  },
};

export function isPowerId(value: string): value is PowerId {
  return (POWER_IDS as readonly string[]).includes(value);
}
