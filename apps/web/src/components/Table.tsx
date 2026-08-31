'use client';

import type { PlayerId } from '@cambeo/engine';
import { CardFace } from '@/components/CardFace';
import { EventLog } from '@/components/EventLog';
import { PromptBar } from '@/components/PromptBar';
import { Scoring } from '@/components/Scoring';
import { SeatSwitcher } from '@/components/SeatSwitcher';
import { useGame, type InteractionMode } from '@/lib/game-store';

function cardSelectable(
  mode: InteractionMode,
  viewerId: PlayerId,
  ownerId: PlayerId,
): boolean {
  if (mode.kind === 'replace' || mode.kind === 'give') {
    return ownerId === viewerId;
  }
  if (mode.kind === 'power-card') {
    if (ownerId === viewerId) return mode.allowOwn;
    return mode.allowOther;
  }
  return mode.kind === 'flip';
}

export function Table() {
  const { state, view, viewerId, names, mode, dispatch } = useGame();

  if (!state || !view) return null;

  if (state.phase === 'OVER') {
    return (
      <>
        <SeatSwitcher />
        <Scoring />
        <EventLog />
      </>
    );
  }

  const opponents = state.seating.filter((id) => id !== viewerId);
  const you = view.players[viewerId];

  const onCardTap = (ownerId: PlayerId, slotIndex: number) => {
    if (mode.kind === 'replace') {
      dispatch({ type: 'REPLACE_CARD', playerId: viewerId, slotIndex });
      return;
    }
    if (mode.kind === 'give') {
      dispatch({ type: 'GIVE_CARD', playerId: viewerId, slotIndex });
      return;
    }
    if (mode.kind === 'power-card') {
      dispatch({
        type: 'RESOLVE_POWER_TARGET',
        playerId: viewerId,
        target: { kind: 'CARD', playerId: ownerId, slotIndex },
      });
      return;
    }
    // Default: flip
    dispatch({
      type: 'FLIP_ATTEMPT',
      playerId: viewerId,
      target: { playerId: ownerId, slotIndex },
    });
  };

  const tapMode =
    mode.kind === 'replace'
      ? 'replace'
      : mode.kind === 'give'
        ? 'give'
        : mode.kind === 'power-card'
          ? 'power'
          : 'flip';

  return (
    <div className="table-layout">
      <SeatSwitcher />

      <div className="opponents">
        {opponents.map((id) => {
          const player = view.players[id];
          if (!player) return null;
          const protectedCaller = state.cambeo?.callerId === id;
          return (
            <div
              key={id}
              className="opponent-block"
              data-protected={protectedCaller}
            >
              <div className="player-meta">
                <strong>{names[id] ?? id}</strong>
                <span className="meta-muted">
                  {player.cardCount} cards
                  {state.turn?.playerId === id ? ' · turn' : ''}
                  {protectedCaller ? ' · cambeo' : ''}
                </span>
              </div>
              <div className="hand-row">
                {player.hand.map((slot, slotIndex) => {
                  const selectable = cardSelectable(mode, viewerId, id);
                  return (
                    <CardFace
                      key={slot.id}
                      slot={slot}
                      selectable={selectable}
                      mode={tapMode}
                      onClick={() => onCardTap(id, slotIndex)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="center-piles">
        <div className="pile">
          <span className="pile-label">Deck · {view.deckCount}</span>
          <div className="card" data-known="false" aria-hidden>
            <span className="card-back-mark">◆</span>
          </div>
        </div>
        <div className="pile">
          <span className="pile-label">
            Discard
            {view.discardTop?.key === 'HEAVEN' ? ' · heaven!' : ''}
          </span>
          {view.discardTop ? (
            <div
              className={
                view.discardTop.key === 'HEAVEN' ? 'discard-heaven-glow' : undefined
              }
            >
              <CardFace face={view.discardTop} asButton={false} />
            </div>
          ) : (
            <div className="card" data-known="false" style={{ opacity: 0.4 }}>
              <span className="card-back-mark">—</span>
            </div>
          )}
        </div>
      </div>

      {view.drawnCard && state.turn?.playerId === viewerId && (
        <div className="drawn-card-wrap">
          <div>
            <div className="pile-label" style={{ textAlign: 'center', marginBottom: 6 }}>
              Drawn
            </div>
            <CardFace face={view.drawnCard} asButton={false} />
          </div>
        </div>
      )}

      {you && (
        <div
          className="you-block"
          data-your-turn={state.turn?.playerId === viewerId}
        >
          <div className="player-meta">
            <strong>You · {names[viewerId] ?? viewerId}</strong>
            <span className="meta-muted">
              {you.cardCount} cards
              {state.cambeo?.callerId === viewerId ? ' · cambeo' : ''}
            </span>
          </div>
          <div className="hand-row">
            {you.hand.map((slot, slotIndex) => {
              const selectable = cardSelectable(mode, viewerId, viewerId);
              return (
                <CardFace
                  key={slot.id}
                  slot={slot}
                  selectable={selectable}
                  mode={tapMode}
                  onClick={() => onCardTap(viewerId, slotIndex)}
                />
              );
            })}
          </div>
        </div>
      )}

      <EventLog />
      <PromptBar />
    </div>
  );
}
