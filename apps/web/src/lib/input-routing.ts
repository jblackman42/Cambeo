import {
  POWER_DEFINITIONS,
  powerStepLacksLegalTarget,
  type Action,
  type CardKey,
  type PlayerId,
  type PowerId,
  type RedactedGameView,
} from '@cambeo/shared';

export const ARM_TIMEOUT_MS = 4000;

export const RACE_LOSS_REASON = 'Flip already won for this discard';

export function isRaceLossReason(reason: string): boolean {
  return reason === RACE_LOSS_REASON;
}

export type LocalPhase =
  | 'idle'
  | 'TURN_DRAW'
  | 'TURN_CHOICE'
  | 'POWER_TARGETING'
  | 'GIVE_CARD_PENDING'
  | 'CALLED_CAMBEO'
  | 'INITIAL_PEEK'
  | 'blocked';

export type ArmedFlip = {
  ownerId: PlayerId;
  slotIndex: number;
  cardId: string;
  discardKey: CardKey;
  discardId: string;
};

export type PowerTargetingMode = {
  allowOwn: boolean;
  allowOther: boolean;
};

export type CardTapInput = {
  localPhase: LocalPhase;
  viewerId: PlayerId;
  ownerId: PlayerId;
  slotIndex: number;
  cardId: string;
  cambeoCallerId: PlayerId | null;
  armed: ArmedFlip | null;
  discardKey: CardKey | null;
  discardId: string | null;
  powerMode?: PowerTargetingMode;
};

export type FlipAttemptAction = Extract<Action, { type: 'FLIP_ATTEMPT' }>;
export type TargetAction = Extract<
  Action,
  { type: 'RESOLVE_POWER_TARGET' | 'REPLACE_CARD' | 'GIVE_CARD' }
>;

export type CardTapResult =
  | { kind: 'arm'; armed: ArmedFlip }
  | { kind: 'commit'; action: FlipAttemptAction }
  | { kind: 'disarm' }
  | { kind: 'target'; action: TargetAction }
  | { kind: 'noop'; shake: boolean; reason: string };

export function localPhaseFromView(view: RedactedGameView, viewerId: PlayerId): LocalPhase {
  if (view.phase === 'OVER' || view.phase === 'SCORING' || view.phase === 'LOBBY') {
    return 'blocked';
  }
  if (view.phase === 'INITIAL_PEEK') return 'INITIAL_PEEK';
  if (view.cambeoCallerId === viewerId) return 'CALLED_CAMBEO';
  if (view.phase === 'GIVE_CARD_PENDING' && view.pendingGive?.flipperId === viewerId) {
    return 'GIVE_CARD_PENDING';
  }
  if (view.phase === 'POWER_TARGETING' && view.pendingPower?.playerId === viewerId) {
    return 'POWER_TARGETING';
  }
  const isTurn = view.turn?.playerId === viewerId;
  if (isTurn && view.phase === 'TURN_CHOICE') return 'TURN_CHOICE';
  if (
    isTurn &&
    (view.phase === 'TURN_DRAW' || view.phase === 'FINAL_ROUND') &&
    !view.turn?.hasDrawn
  ) {
    return 'TURN_DRAW';
  }
  return 'idle';
}

export function isLegalCardTarget(
  localPhase: LocalPhase,
  viewerId: PlayerId,
  ownerId: PlayerId,
  cambeoCallerId: PlayerId | null,
  powerMode?: PowerTargetingMode,
): boolean {
  if (cambeoCallerId === ownerId && ownerId !== viewerId) return false;
  if (localPhase === 'TURN_CHOICE' || localPhase === 'GIVE_CARD_PENDING') {
    return ownerId === viewerId;
  }
  if (localPhase === 'POWER_TARGETING' && powerMode) {
    if (ownerId === viewerId) return powerMode.allowOwn;
    return powerMode.allowOther;
  }
  return false;
}

function flipAttempt(viewerId: PlayerId, ownerId: PlayerId, slotIndex: number): FlipAttemptAction {
  return {
    type: 'FLIP_ATTEMPT',
    playerId: viewerId,
    target: { playerId: ownerId, slotIndex },
  };
}

function makeArmed(input: CardTapInput): ArmedFlip | null {
  if (!input.discardKey || !input.discardId) return null;
  return {
    ownerId: input.ownerId,
    slotIndex: input.slotIndex,
    cardId: input.cardId,
    discardKey: input.discardKey,
    discardId: input.discardId,
  };
}

function isArmedTarget(armed: ArmedFlip, input: CardTapInput): boolean {
  return armed.ownerId === input.ownerId && armed.slotIndex === input.slotIndex;
}

export function routeCardTap(input: CardTapInput): CardTapResult {
  const lockedCaller = input.cambeoCallerId === input.ownerId && input.ownerId !== input.viewerId;
  if (lockedCaller) {
    return { kind: 'noop', shake: true, reason: 'cambeo-locked' };
  }

  if (input.localPhase === 'CALLED_CAMBEO') {
    return { kind: 'noop', shake: true, reason: 'caller-cannot-flip' };
  }

  if (input.localPhase === 'INITIAL_PEEK' || input.localPhase === 'blocked') {
    return { kind: 'noop', shake: true, reason: 'phase-blocked' };
  }

  if (input.localPhase === 'TURN_DRAW') {
    return { kind: 'noop', shake: true, reason: 'draw-pending' };
  }

  if (input.localPhase === 'TURN_CHOICE') {
    if (input.ownerId !== input.viewerId) {
      return { kind: 'noop', shake: true, reason: 'replace-own-only' };
    }
    return {
      kind: 'target',
      action: { type: 'REPLACE_CARD', playerId: input.viewerId, slotIndex: input.slotIndex },
    };
  }

  if (input.localPhase === 'GIVE_CARD_PENDING') {
    if (input.ownerId !== input.viewerId) {
      return { kind: 'noop', shake: true, reason: 'give-own-only' };
    }
    return {
      kind: 'target',
      action: { type: 'GIVE_CARD', playerId: input.viewerId, slotIndex: input.slotIndex },
    };
  }

  if (input.localPhase === 'POWER_TARGETING') {
    const legal = isLegalCardTarget(
      input.localPhase,
      input.viewerId,
      input.ownerId,
      input.cambeoCallerId,
      input.powerMode,
    );
    if (!legal) {
      return { kind: 'noop', shake: true, reason: 'illegal-target' };
    }
    return {
      kind: 'target',
      action: {
        type: 'RESOLVE_POWER_TARGET',
        playerId: input.viewerId,
        target: { kind: 'CARD', playerId: input.ownerId, slotIndex: input.slotIndex },
      },
    };
  }

  // Idle: arm / commit. Flip is unreachable in every branch above.
  if (!input.discardKey || !input.discardId) {
    return { kind: 'noop', shake: true, reason: 'no-discard' };
  }

  if (input.armed && isArmedTarget(input.armed, input)) {
    return { kind: 'commit', action: flipAttempt(input.viewerId, input.ownerId, input.slotIndex) };
  }

  const next = makeArmed(input);
  if (!next) return { kind: 'noop', shake: true, reason: 'no-discard' };
  return { kind: 'arm', armed: next };
}

export type DisarmContext = {
  discardId: string | null;
  turnPlayerId: PlayerId | null;
  viewerId: PlayerId;
  cambeoCallerId: PlayerId | null;
  /** Card id currently in the armed slot, if the slot still exists. */
  cardIdAtSlot: string | null;
  localPhase: LocalPhase;
};

export type DisarmReason =
  | 'discard-changed'
  | 'card-moved'
  | 'became-our-turn'
  | 'called-cambeo'
  | 'pending-action'
  | 'timeout'
  | 'manual';

/** True when a state change should drop a local arm (section 7 of the flip-input spec). */
export function shouldDisarmArmed(armed: ArmedFlip | null, ctx: DisarmContext): DisarmReason | null {
  if (!armed) return null;
  if (ctx.cambeoCallerId === ctx.viewerId) return 'called-cambeo';
  if (ctx.localPhase !== 'idle') {
    if (ctx.localPhase === 'TURN_DRAW' || ctx.localPhase === 'CALLED_CAMBEO') {
      return ctx.localPhase === 'CALLED_CAMBEO' ? 'called-cambeo' : 'became-our-turn';
    }
    return 'pending-action';
  }
  if (ctx.discardId !== armed.discardId) return 'discard-changed';
  if (ctx.cardIdAtSlot !== armed.cardId) return 'card-moved';
  return null;
}

export type ActionBarCopy = {
  kicker: string;
  stepLabel: string | null;
  instruction: string;
  selectedLabel: string | null;
  canCancel: boolean;
};

function swapProgress(powerId: PowerId, stepIndex: number): { selected: number; total: number } | null {
  const def = POWER_DEFINITIONS[powerId];
  const swapSteps = (def?.steps ?? [])
    .map((step, i) => ({ step, i }))
    .filter(({ step }) => step.effect === 'SELECT_FOR_SWAP');
  if (swapSteps.length < 2) return null;
  const current = swapSteps.findIndex(({ i }) => i === stepIndex);
  if (current < 0) return null;
  return { selected: current, total: swapSteps.length };
}

export function powerActionCopy(powerId: PowerId, stepIndex: number): ActionBarCopy {
  const def = POWER_DEFINITIONS[powerId];
  const step = def?.steps[stepIndex];
  const title =
    powerId === 'LOOK_THEN_BLIND_SWAP'
      ? 'Look and Swap'
      : powerId === 'PEEK_OWN'
        ? 'Peek own'
        : powerId === 'PEEK_OTHER'
          ? 'Peek other'
          : powerId === 'BLIND_SWAP'
            ? 'Blind Swap'
            : powerId === 'LOOK_THEN_OPTIONAL_SWAP'
              ? 'Look then optional swap'
              : powerId === 'SHUFFLE_TARGET_HAND'
                ? 'Shuffle a hand'
                : powerId;

  const revealThenSwap = powerId === 'LOOK_THEN_BLIND_SWAP';
  const userStepCount = revealThenSwap ? 2 : (def?.steps.length ?? 1);
  let userStep = stepIndex + 1;
  if (revealThenSwap) {
    userStep = stepIndex === 0 ? 1 : 2;
  }

  const progress = step ? swapProgress(powerId, stepIndex) : null;
  const selectedLabel = progress
    ? `Selected: ${progress.selected} of ${progress.total}.`
    : null;

  const instruction = step
    ? powerId === 'LOOK_THEN_BLIND_SWAP' && step.kind === 'OTHER_CARD'
      ? 'Choose one opponent card to look at.'
      : powerId === 'LOOK_THEN_BLIND_SWAP' && step.effect === 'SELECT_FOR_SWAP'
        ? `Choose any two cards to swap, including the one you looked at. ${selectedLabel ?? ''}`.trim()
        : powerId === 'BLIND_SWAP'
          ? `Choose two cards to swap. ${selectedLabel ?? ''}`.trim()
          : powerId === 'PEEK_OWN'
            ? 'Peek one of your cards.'
            : powerId === 'PEEK_OTHER'
              ? 'Peek one opponent card.'
              : powerId === 'LOOK_THEN_OPTIONAL_SWAP' && step.kind === 'OWN_CARD'
                ? 'Look at one of your cards.'
                : powerId === 'LOOK_THEN_OPTIONAL_SWAP' && step.kind === 'OTHER_CARD'
                  ? 'Look at an opponent card.'
                  : powerId === 'LOOK_THEN_OPTIONAL_SWAP' && step.kind === 'CONFIRM'
                    ? 'Swap those two cards?'
                    : 'Tap a highlighted card.'
    : 'Tap a highlighted card.';

  const stepLabel = userStepCount > 1 ? `Step ${userStep} of ${userStepCount}` : null;
  const canCancel = step?.optional === true;

  return {
    kicker: title,
    stepLabel,
    instruction,
    selectedLabel: progress && !instruction.includes('Selected:') ? selectedLabel : null,
    canCancel,
  };
}

export function powerModeFromView(view: RedactedGameView, viewerId: PlayerId): PowerTargetingMode | undefined {
  const pending = view.pendingPower;
  if (!pending || pending.playerId !== viewerId) return undefined;
  const step = POWER_DEFINITIONS[pending.powerId]?.steps[pending.stepIndex];
  if (!step) return undefined;
  if (step.kind === 'CONFIRM' || step.kind === 'ANY_PLAYER') return undefined;
  return {
    allowOwn: step.kind === 'OWN_CARD' || step.kind === 'ANY_CARD',
    allowOther: step.kind === 'OTHER_CARD' || step.kind === 'ANY_CARD',
  };
}

export function powerStepNeedsSkip(view: RedactedGameView, viewerId: PlayerId): boolean {
  const pending = view.pendingPower;
  if (!pending || pending.playerId !== viewerId) return false;
  const step = POWER_DEFINITIONS[pending.powerId]?.steps[pending.stepIndex];
  if (!step || step.kind === 'CONFIRM') return false;
  return powerStepLacksLegalTarget({
    powerId: pending.powerId,
    stepIndex: pending.stepIndex,
    selections: pending.selections ?? [],
    actorId: pending.playerId,
    cambeoCallerId: view.cambeoCallerId,
    seating: view.seating ?? [],
    cardCount: (id) => view.players[id]?.cardCount ?? 0,
  });
}

export function commitFlipAction(viewerId: PlayerId, armed: ArmedFlip): FlipAttemptAction {
  return flipAttempt(viewerId, armed.ownerId, armed.slotIndex);
}

export function actionHasArmState(action: Action): boolean {
  return 'armed' in action || 'arm' in action;
}
