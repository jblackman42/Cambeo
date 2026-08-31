'use client';

import { POWER_DEFINITIONS } from '@cambeo/shared';
import { useEffect } from 'react';
import { useGame } from '@/lib/play-context';
import { powerPromptLabel } from '@/lib/format';

export function PromptBar() {
  const {
    view,
    viewerId,
    names,
    lastReject,
    mode,
    setMode,
    dispatch,
    playMode,
  } = useGame();

  const pending = view?.pendingPower;
  const powerDef = pending ? POWER_DEFINITIONS[pending.powerId] : null;
  const step = powerDef && pending ? powerDef.steps[pending.stepIndex] : null;

  useEffect(() => {
    if (!view || !pending || pending.playerId !== viewerId || !step) {
      return;
    }
    if (step.kind === 'CONFIRM') return;
    if (step.kind === 'ANY_PLAYER') {
      setMode({ kind: 'power-player' });
      return;
    }
    setMode({
      kind: 'power-card',
      allowOwn: step.kind === 'OWN_CARD' || step.kind === 'ANY_CARD',
      allowOther: step.kind === 'OTHER_CARD' || step.kind === 'ANY_CARD',
    });
  }, [view, pending, viewerId, step, setMode]);

  if (!view) return null;

  const isViewerTurn = view.turn?.playerId === viewerId;
  const name = (id: string) => names[id] ?? id;
  const seatHint =
    playMode === 'hotseat' ? ' Switch seat to play as them.' : '';

  if (view.phase === 'OVER' && view.result) {
    return null;
  }

  if (view.phase === 'INITIAL_PEEK') {
    const acked = view.ackedPeek.includes(viewerId);
    return (
      <div className="prompt-bar">
        {lastReject && <div className="reject-toast">{lastReject}</div>}
        <p className="prompt-title">Memorize your peeks</p>
        <p className="prompt-hint">
          {acked
            ? 'Waiting for everyone else…'
            : `You can see ${view.ruleSet.initialRevealCount} of your cards.`}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={acked}
            onClick={() => dispatch({ type: 'ACK_PEEK', playerId: viewerId })}
          >
            {acked ? 'Ready' : "I've memorized them"}
          </button>
        </div>
      </div>
    );
  }

  if (view.phase === 'LOBBY') {
    return (
      <div className="prompt-bar">
        {lastReject && <div className="reject-toast">{lastReject}</div>}
        <p className="prompt-title">Deal when ready</p>
      </div>
    );
  }

  if (view.phase === 'GIVE_CARD_PENDING' && view.pendingGive) {
    const isFlipper = view.pendingGive.flipperId === viewerId;
    return (
      <div className="prompt-bar">
        {lastReject && <div className="reject-toast">{lastReject}</div>}
        <p className="prompt-title">
          {isFlipper
            ? `Give a card to ${name(view.pendingGive.targetId)}`
            : `${name(view.pendingGive.flipperId)} is choosing a card to give`}
        </p>
        <p className="prompt-hint">
          {isFlipper ? 'Tap one of your cards.' : `Flips are paused.${seatHint}`}
        </p>
      </div>
    );
  }

  if (view.phase === 'POWER_TARGETING' && pending) {
    const isActor = pending.playerId === viewerId;
    if (!isActor) {
      return (
        <div className="prompt-bar">
          {lastReject && <div className="reject-toast">{lastReject}</div>}
          <p className="prompt-title">{name(pending.playerId)} is resolving {pending.powerId}</p>
          <p className="prompt-hint">Flips are still legal.{seatHint}</p>
        </div>
      );
    }

    if (step?.kind === 'CONFIRM') {
      return (
        <div className="prompt-bar">
          {lastReject && <div className="reject-toast">{lastReject}</div>}
          <p className="prompt-title">{powerPromptLabel(pending.powerId, 'CONFIRM')}</p>
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
          {lastReject && <div className="reject-toast">{lastReject}</div>}
          <p className="prompt-title">
            {powerPromptLabel(pending.powerId, step.kind)}
          </p>
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
          </div>
        </div>
      );
    }

    return (
      <div className="prompt-bar">
        {lastReject && <div className="reject-toast">{lastReject}</div>}
        <p className="prompt-title">
          {step ? powerPromptLabel(pending.powerId, step.kind) : pending.powerId}
        </p>
        <p className="prompt-hint">Tap a highlighted card. Flips still work for others.</p>
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
        {lastReject && <div className="reject-toast">{lastReject}</div>}
        <p className="prompt-title">Your turn — draw</p>
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
    const hellLocked =
      drawnKey === 'HELL' && view.ruleSet.hellDiscardOnlyOntoHeaven;
    const heavenLocked =
      drawnKey === 'HEAVEN' &&
      !view.ruleSet.heavenDiscardableAfterCambeo &&
      view.cambeoCallerId !== null;

    if (hellLocked) {
      return (
        <div className="prompt-bar">
          {lastReject && <div className="reject-toast">{lastReject}</div>}
          <p className="prompt-title">Hell — replace only</p>
          <p className="prompt-hint">
            Hell cannot be discarded except by flipping it onto heaven. Replace one of
            your cards with it.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setMode({ kind: 'replace' })}
            >
              Replace a card…
            </button>
          </div>
          {mode.kind === 'replace' && (
            <p className="prompt-hint">Tap one of your cards to replace it.</p>
          )}
        </div>
      );
    }

    if (heavenLocked) {
      return (
        <div className="prompt-bar">
          {lastReject && <div className="reject-toast">{lastReject}</div>}
          <p className="prompt-title">Heaven — keep it</p>
          <p className="prompt-hint">
            After Cambeo, heaven cannot go on the discard pile. Keep it in your hand to
            end your turn. You may still replace a non-heaven card if you want something
            else on the pile.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dispatch({ type: 'KEEP_DRAWN', playerId: viewerId })}
            >
              Keep heaven
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMode({ kind: 'replace' })}
            >
              Replace a non-heaven card…
            </button>
          </div>
          {mode.kind === 'replace' && (
            <p className="prompt-hint">
              Tap a card that is not heaven — replacing heaven onto the pile is illegal.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="prompt-bar">
        {lastReject && <div className="reject-toast">{lastReject}</div>}
        <p className="prompt-title">Keep or discard?</p>
        <p className="prompt-hint">
          {view.turn?.drawnFrom === 'DISCARD'
            ? 'Drawn from discard — power will not fire if you discard it.'
            : 'Discard to use its power, or replace one of your cards.'}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'DISCARD_DRAWN', playerId: viewerId })}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            data-active={mode.kind === 'replace'}
            onClick={() => setMode({ kind: 'replace' })}
          >
            Replace a card…
          </button>
        </div>
        {mode.kind === 'replace' && (
          <p className="prompt-hint">Tap one of your cards to replace it.</p>
        )}
      </div>
    );
  }

  return (
    <div className="prompt-bar">
      {lastReject && <div className="reject-toast">{lastReject}</div>}
      <p className="prompt-title">
        {view.turn
          ? `${name(view.turn.playerId)}'s turn`
          : view.phase}
      </p>
      <p className="prompt-hint">Tap any card to attempt a flip.</p>
    </div>
  );
}
