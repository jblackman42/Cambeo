'use client';

import { POWER_DEFINITIONS } from '@cambeo/shared';
import { useGame } from '@/lib/play-context';
import { powerActionCopy, isRaceLossReason, powerStepNeedsSkip } from '@/lib/input-routing';
import { useTableInput } from '@/lib/table-input';
import { rankSpokenName } from '@/lib/format';
import { useEffect, useRef } from 'react';

export function PromptBar() {
  const { view, viewerId, names, lastReject, dispatch, playMode, dismissInitialPeeks } = useGame();
  const { localPhase, armed, penalty, disarm, dismissPenalty } = useTableInput();

  const pending = view?.pendingPower;
  const powerDef = pending ? POWER_DEFINITIONS[pending.powerId] : null;
  const step = powerDef && pending ? powerDef.steps[pending.stepIndex] : null;
  const penaltyUntil = useRef(0);

  useEffect(() => {
    if (!penalty) return;
    penaltyUntil.current = Date.now() + 2500;
    const t = window.setTimeout(() => dismissPenalty(), 2500);
    return () => window.clearTimeout(t);
  }, [penalty, dismissPenalty]);

  if (!view) return null;

  const isViewerTurn = view.turn?.playerId === viewerId;
  const name = (id: string) => names[id] ?? id;
  const seatHint = playMode === 'hotseat' ? ' Switch seat to play as them.' : '';
  const reject =
    lastReject && !isRaceLossReason(lastReject) ? lastReject : null;

  const extras = (
    <>
      {reject && <div className="reject-toast">{reject}</div>}
      {penalty && (
        <button type="button" className="penalty-notice" onClick={dismissPenalty}>
          <span className="icon" aria-hidden>
            ✕
          </span>
          {penalty}
        </button>
      )}
    </>
  );

  if (view.phase === 'OVER' && view.result) {
    return null;
  }

  if (armed) {
    return (
      <div className="prompt-bar">
        {extras}
        <div className="action-bar-head">
          <div>
            <p className="prompt-kicker">Flip</p>
            <p className="prompt-title">Tap again to flip</p>
            <p className="prompt-hint">
              Discard shows {rankSpokenName(armed.discardKey)}.
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={disarm}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (view.phase === 'INITIAL_PEEK') {
    const acked = view.ackedPeek.includes(viewerId);
    return (
      <div className="prompt-bar">
        {extras}
        <p className="prompt-kicker">Peek</p>
        <p className="prompt-title">Memorize your peeks</p>
        <p className="prompt-hint">
          {acked
            ? 'Waiting for everyone else…'
            : `You can see ${view.ruleSet.initialRevealCount} of your cards. They stay in place.`}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={acked}
            onClick={() => {
              dismissInitialPeeks();
              dispatch({ type: 'ACK_PEEK', playerId: viewerId });
            }}
          >
            {acked ? 'Ready' : 'Got it'}
          </button>
        </div>
      </div>
    );
  }

  if (view.phase === 'LOBBY') {
    return (
      <div className="prompt-bar">
        {extras}
        <p className="prompt-title">Deal when ready</p>
      </div>
    );
  }

  if (view.phase === 'GIVE_CARD_PENDING' && view.pendingGive) {
    const isFlipper = view.pendingGive.flipperId === viewerId;
    return (
      <div className="prompt-bar">
        {extras}
        <p className="prompt-kicker">Give a card</p>
        <p className="prompt-title">
          {isFlipper
            ? `Give a card to ${name(view.pendingGive.targetId)}`
            : `${name(view.pendingGive.flipperId)} is choosing a card to give`}
        </p>
        <p className="prompt-hint">
          {isFlipper ? 'Tap one of your cards.' : `Waiting.${seatHint}`}
        </p>
      </div>
    );
  }

  if (view.phase === 'POWER_TARGETING' && pending) {
    const isActor = pending.playerId === viewerId;
    if (!isActor) {
      return (
        <div className="prompt-bar">
          {extras}
          <p className="prompt-title">
            {name(pending.playerId)} is resolving {powerActionCopy(pending.powerId, pending.stepIndex).kicker}
          </p>
          <p className="prompt-hint">You can still arm a flip.{seatHint}</p>
        </div>
      );
    }

    const copy = powerActionCopy(pending.powerId, pending.stepIndex);
    const needsSkip = powerStepNeedsSkip(view, viewerId);
    const skipHint =
      needsSkip && step?.kind === 'OTHER_CARD'
        ? 'No opponent card you can look at. Skip to continue.'
        : needsSkip && step?.effect === 'SELECT_FOR_SWAP'
          ? 'Not enough cards left to swap. Skip to continue.'
          : needsSkip
            ? 'No legal target. Skip this step to continue.'
            : null;

    if (step?.kind === 'CONFIRM') {
      return (
        <div className="prompt-bar">
          {extras}
          <p className="prompt-kicker">
            {copy.kicker}
            {copy.stepLabel ? ` · ${copy.stepLabel}` : ''}
          </p>
          <p className="prompt-title">{copy.instruction}</p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                dispatch({
                  type: 'RESOLVE_POWER_TARGET',
                  playerId: viewerId,
                  target: { kind: 'CONFIRM', swap: true },
                })
              }
            >
              Swap
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                dispatch({
                  type: 'RESOLVE_POWER_TARGET',
                  playerId: viewerId,
                  target: { kind: 'CONFIRM', swap: false },
                })
              }
            >
              Keep
            </button>
          </div>
        </div>
      );
    }

    if (step?.kind === 'ANY_PLAYER') {
      return (
        <div className="prompt-bar">
          {extras}
          <p className="prompt-kicker">{copy.kicker}</p>
          <p className="prompt-title">{copy.instruction}</p>
          {skipHint && <p className="prompt-hint">{skipHint}</p>}
          <div className="btn-row">
            {view.seating
              .filter((id) => id !== view.cambeoCallerId)
              .map((id) => (
                <button
                  key={id}
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    dispatch({
                      type: 'RESOLVE_POWER_TARGET',
                      playerId: viewerId,
                      target: { kind: 'PLAYER', playerId: id },
                    })
                  }
                >
                  {name(id)}
                </button>
              ))}
            {needsSkip && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  dispatch({
                    type: 'RESOLVE_POWER_TARGET',
                    playerId: viewerId,
                    target: { kind: 'SKIP' },
                  })
                }
              >
                Skip
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="prompt-bar">
        {extras}
        <div className="action-bar-head">
          <div>
            <p className="prompt-kicker">
              {copy.kicker}
              {copy.stepLabel ? ` · ${copy.stepLabel}` : ''}
            </p>
            <p className="prompt-title">{copy.instruction}</p>
            {skipHint && <p className="prompt-hint">{skipHint}</p>}
          </div>
          {(copy.canCancel || needsSkip) && (
            <button
              type="button"
              className={needsSkip ? 'btn btn-primary' : 'btn btn-ghost'}
              onClick={() =>
                dispatch({
                  type: 'RESOLVE_POWER_TARGET',
                  playerId: viewerId,
                  target: { kind: 'SKIP' },
                })
              }
            >
              {needsSkip ? 'Skip' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (
    (view.phase === 'TURN_DRAW' || view.phase === 'FINAL_ROUND') &&
    isViewerTurn &&
    !view.turn?.hasDrawn
  ) {
    return (
      <div className="prompt-bar">
        {extras}
        <p className="prompt-kicker">Your turn</p>
        <p className="prompt-title">Draw</p>
        <p className="prompt-hint">
          {view.phase === 'FINAL_ROUND' ? 'Final round after Cambeo.' : 'Or call Cambeo before drawing.'}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'DRAW_DECK', playerId: viewerId })}
          >
            Draw deck ({view.deckCount})
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!view.discardTop}
            onClick={() => dispatch({ type: 'DRAW_DISCARD', playerId: viewerId })}
          >
            Draw discard
          </button>
          {view.phase === 'TURN_DRAW' && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => dispatch({ type: 'CALL_CAMBEO', playerId: viewerId })}
            >
              Call Cambeo
            </button>
          )}
        </div>
      </div>
    );
  }

  if (view.phase === 'TURN_CHOICE' && isViewerTurn && view.drawnCard) {
    const drawnKey = view.drawnCard.key;
    const canReplace = (view.players[viewerId]?.cardCount ?? 0) > 0;
    const hellLocked = drawnKey === 'HELL' && view.ruleSet.hellDiscardOnlyOntoHeaven;
    const heavenLocked =
      drawnKey === 'HEAVEN' &&
      !view.ruleSet.heavenDiscardableAfterCambeo &&
      view.cambeoCallerId !== null;

    const keep = (label: string, primary = false) => (
      <button
        type="button"
        className={primary ? 'btn btn-primary' : 'btn btn-ghost'}
        onClick={() => dispatch({ type: 'KEEP_DRAWN', playerId: viewerId })}
      >
        {label}
      </button>
    );

    if (hellLocked) {
      return (
        <div className="prompt-bar">
          {extras}
          <p className="prompt-kicker">Hell</p>
          <p className="prompt-title">{canReplace ? 'Replace or keep?' : 'Keep it'}</p>
          <p className="prompt-hint">
            {canReplace
              ? 'Hell cannot be discarded except by flipping it onto heaven. Tap one of your cards to replace it, or keep it as an extra card.'
              : 'Hell cannot be discarded except by flipping it onto heaven. You have no cards to replace, so keep it to end your turn.'}
          </p>
          <div className="btn-row">{keep('Keep', !canReplace)}</div>
        </div>
      );
    }

    if (heavenLocked) {
      return (
        <div className="prompt-bar">
          {extras}
          <p className="prompt-kicker">Heaven</p>
          <p className="prompt-title">Keep it</p>
          <p className="prompt-hint">
            After Cambeo, heaven cannot go on the discard pile. Keep it in your hand to end your
            turn.
            {canReplace
              ? ' You may still tap a non-heaven card to replace it if you want something else on the pile.'
              : ''}
          </p>
          <div className="btn-row">{keep('Keep heaven', true)}</div>
        </div>
      );
    }

    return (
      <div className="prompt-bar">
        {extras}
        <p className="prompt-kicker">Your turn</p>
        <p className="prompt-title">Discard, replace, or keep?</p>
        <p className="prompt-hint">
          {view.turn?.drawnFrom === 'DISCARD'
            ? 'Drawn from discard — discarding it will not fire a power. Tap one of your cards to replace it.'
            : 'Discard to use its power, tap a card to replace, or keep it as an extra card.'}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'DISCARD_DRAWN', playerId: viewerId })}
          >
            Discard
          </button>
          {keep('Keep')}
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-bar">
      {extras}
      <p className="prompt-title">{view.turn ? `${name(view.turn.playerId)}'s turn` : view.phase}</p>
      <p className="prompt-hint">
        {localPhase === 'CALLED_CAMBEO'
          ? 'You called Cambeo. Your cards are locked.'
          : view.discardTop
            ? `Tap a card twice to flip. Discard shows ${rankSpokenName(view.discardTop.key)}.`
            : 'Waiting…'}
      </p>
    </div>
  );
}
