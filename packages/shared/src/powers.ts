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

/** Card selections already committed for a given step effect, aligned by step index. */
export function cardTargetsForEffect(
  powerId: PowerId,
  selections: ReadonlyArray<{ kind: string; playerId?: string; slotIndex?: number }> | undefined,
  effect: PowerStepEffect,
): Array<{ playerId: string; slotIndex: number }> {
  const steps = POWER_DEFINITIONS[powerId]?.steps ?? [];
  const chosen = selections ?? [];
  const out: Array<{ playerId: string; slotIndex: number }> = [];
  for (let i = 0; i < chosen.length; i++) {
    const step = steps[i];
    const target = chosen[i];
    if (
      step?.effect === effect &&
      target?.kind === 'CARD' &&
      typeof target.playerId === 'string' &&
      typeof target.slotIndex === 'number'
    ) {
      out.push({ playerId: target.playerId, slotIndex: target.slotIndex });
    }
  }
  return out;
}

export function isLegalPowerCardOwner(
  stepKind: PowerTargetKind,
  actorId: string,
  ownerId: string,
  cambeoCallerId: string | null,
): boolean {
  if (cambeoCallerId === ownerId && ownerId !== actorId) return false;
  if (stepKind === 'OWN_CARD') return ownerId === actorId;
  if (stepKind === 'OTHER_CARD') return ownerId !== actorId;
  if (stepKind === 'ANY_CARD') return true;
  return false;
}

export function countLegalPowerCardTargets(args: {
  stepKind: Extract<PowerTargetKind, 'OWN_CARD' | 'OTHER_CARD' | 'ANY_CARD'>;
  actorId: string;
  cambeoCallerId: string | null;
  seating: readonly string[];
  cardCount: (playerId: string) => number;
  exclude?: ReadonlyArray<{ playerId: string; slotIndex: number }>;
}): number {
  const exclude = args.exclude ?? [];
  let count = 0;
  for (const playerId of args.seating) {
    if (!isLegalPowerCardOwner(args.stepKind, args.actorId, playerId, args.cambeoCallerId)) {
      continue;
    }
    const n = args.cardCount(playerId);
    for (let slotIndex = 0; slotIndex < n; slotIndex++) {
      if (exclude.some((e) => e.playerId === playerId && e.slotIndex === slotIndex)) continue;
      count += 1;
    }
  }
  return count;
}

/**
 * True when the current targeting step cannot be fulfilled (empty hands, cambeo
 * lock, or fewer than two swappable cards). The actor may SKIP in that case.
 */
export function powerStepLacksLegalTarget(args: {
  powerId: PowerId;
  stepIndex: number;
  selections: ReadonlyArray<{ kind: string; playerId?: string; slotIndex?: number }> | undefined;
  actorId: string;
  cambeoCallerId: string | null;
  seating: readonly string[];
  cardCount: (playerId: string) => number;
}): boolean {
  const steps = POWER_DEFINITIONS[args.powerId]?.steps ?? [];
  const step = steps[args.stepIndex];
  if (!step) return false;
  if (step.kind === 'CONFIRM') return false;
  if (step.kind === 'ANY_PLAYER') {
    return args.seating.every((id) => id === args.cambeoCallerId);
  }
  if (step.kind !== 'OWN_CARD' && step.kind !== 'OTHER_CARD' && step.kind !== 'ANY_CARD') {
    return false;
  }
  const exclude =
    step.effect === 'SELECT_FOR_SWAP'
      ? cardTargetsForEffect(args.powerId, args.selections, 'SELECT_FOR_SWAP')
      : [];
  const count = countLegalPowerCardTargets({
    stepKind: step.kind,
    actorId: args.actorId,
    cambeoCallerId: args.cambeoCallerId,
    seating: args.seating,
    cardCount: args.cardCount,
    exclude,
  });
  if (step.effect === 'SELECT_FOR_SWAP') {
    const remainingSwapSteps = steps
      .slice(args.stepIndex)
      .filter((s) => s.effect === 'SELECT_FOR_SWAP').length;
    return count < remainingSwapSteps;
  }
  return count < 1;
}
