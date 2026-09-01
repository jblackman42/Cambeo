'use client';

import { CardFace } from '@/components/CardFace';
import { EventLog } from '@/components/EventLog';
import { PromptBar } from '@/components/PromptBar';
import { Scoring } from '@/components/Scoring';
import { SeatSwitcher } from '@/components/SeatSwitcher';
import { useGame } from '@/lib/play-context';
import { TableInputProvider, useTableInput } from '@/lib/table-input';
import { isLegalCardTarget, powerModeFromView } from '@/lib/input-routing';
import { rankSpokenName } from '@/lib/format';
import type { PlayerId, PublicCardView, SlotView } from '@cambeo/shared';
import { useEffect, useRef, useState } from 'react';
import { REVEAL_WARNING_MS, type ActiveReveal } from '@/lib/reveals';
import { useRevealPresence, useRevealsPresence } from '@/lib/reveal-presence';

function CountdownRing({ reveal }: { reveal: ActiveReveal }) {
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    const remain = reveal.expiresAt - Date.now();
    const untilWarn = remain - REVEAL_WARNING_MS;
    if (untilWarn <= 0) {
      setWarning(true);
      return undefined;
    }
    setWarning(false);
    const t = window.setTimeout(() => setWarning(true), untilWarn);
    return () => window.clearTimeout(t);
  }, [reveal.expiresAt]);

  const remain = Math.max(0, reveal.expiresAt - Date.now());
  const elapsed = Math.max(0, reveal.durationMs - remain);
  const from = reveal.durationMs > 0 ? Math.min(1, elapsed / reveal.durationMs) : 0;

  return (
    <svg
      className="reveal-countdown"
      data-warning={warning ? 'true' : 'false'}
      viewBox="0 0 200 292"
      aria-hidden
      style={{
        ['--reveal-ms' as string]: `${remain}ms`,
        ['--reveal-from' as string]: String(from),
      }}
    >
      <rect x="8" y="8" width="184" height="276" rx="16" pathLength="1" />
    </svg>
  );
}

function RevealLift({ viewerId }: { viewerId: PlayerId }) {
  const { reveals } = useGame();
  // A power peek is one event, so it lifts once. A missed flip is revealed to every seat, so
  // only the row addressed to this viewer is lifted — otherwise the same card stacks up N times.
  const lifted = reveals.filter(
    (row) =>
      row.kind === 'POWER' || (row.kind === 'FLIP_FAIL' && row.revealedToPlayerId === viewerId),
  );
  const presence = useRevealsPresence(lifted);
  if (presence.length === 0) return null;

  return (
    <div className="reveal-overlay" role="status" aria-live="polite">
      <div className="reveal-lift-row">
        {presence.map(({ reveal: row, hiding }) => {
          const mine = row.revealedToPlayerId === viewerId && row.key && row.suit;
          const face: PublicCardView | undefined = mine
            ? { id: row.cardId, key: row.key!, suit: row.suit!, value: row.value ?? 0 }
            : undefined;
          return (
            <span className="reveal-stage" key={`${row.cardId}-${row.revealedToPlayerId}`}>
              {!hiding && <CountdownRing reveal={row} />}
              <CardFace face={face} hiding={hiding} asButton={false} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The card you are holding mid-turn. Face-up only while its draw reveal is unexpired — after
 * that you choose from memory, the same as every other look in the game.
 */
function DrawnCard({ cardId, viewerId }: { cardId: string; viewerId: PlayerId }) {
  const { reveals } = useGame();
  const live = reveals.find(
    (row) =>
      row.kind === 'DRAW' &&
      row.cardId === cardId &&
      row.revealedToPlayerId === viewerId &&
      row.key &&
      row.suit,
  );
  const presence = useRevealPresence(live);
  const face: PublicCardView | undefined = presence
    ? {
        id: presence.reveal.cardId,
        key: presence.reveal.key!,
        suit: presence.reveal.suit!,
        value: presence.reveal.value ?? 0,
      }
    : undefined;

  return (
    <div className="drawn-card-wrap">
      <div>
        <div className="pile-label" style={{ textAlign: 'center', marginBottom: 6 }}>
          Drawn
        </div>
        <span className="card-reveal-wrap">
          {live && <CountdownRing reveal={live} />}
          <CardFace face={face} hiding={presence?.hiding ?? false} asButton={false} />
        </span>
      </div>
    </div>
  );
}

function tableSize(playerCount: number): 'lg' | 'md' | 'sm' {
  if (playerCount <= 4) return 'lg';
  if (playerCount <= 6) return 'md';
  return 'sm';
}

function HandCard({
  slot,
  ownerId,
  slotIndex,
  viewerId,
}: {
  slot: SlotView;
  ownerId: PlayerId;
  slotIndex: number;
  viewerId: PlayerId;
}) {
  const { view, reveals } = useGame();
  const { localPhase, armed, onCardTap, shake, raceFade } = useTableInput();
  const reveal = reveals.find(
    (row) =>
      row.cardId === slot.id &&
      row.kind === 'INITIAL_PEEK' &&
      row.revealedToPlayerId === viewerId &&
      row.key &&
      row.suit,
  );
  const presence = useRevealPresence(reveal);
  if (!view) return null;

  const face: PublicCardView | undefined = presence
    ? {
        id: presence.reveal.cardId,
        key: presence.reveal.key!,
        suit: presence.reveal.suit!,
        value: presence.reveal.value ?? 0,
      }
    : undefined;

  const powerMode = powerModeFromView(view, viewerId);
  const targeting =
    localPhase === 'POWER_TARGETING' ||
    localPhase === 'TURN_CHOICE' ||
    localPhase === 'GIVE_CARD_PENDING';
  const locked = view.cambeoCallerId === ownerId && ownerId !== viewerId;
  const legal = targeting
    ? isLegalCardTarget(localPhase, viewerId, ownerId, view.cambeoCallerId, powerMode)
    : false;
  const isArmed = armed?.ownerId === ownerId && armed.slotIndex === slotIndex;
  const dimmed = targeting && !legal && !isArmed;
  const ambient =
    ownerId === viewerId && face && (face.key === 'HEAVEN' || face.key === 'HELL')
      ? face.key === 'HEAVEN'
        ? 'heaven'
        : 'hell'
      : null;
  const shaking = shake?.ownerId === ownerId && shake.slotIndex === slotIndex;

  return (
    <span className="card-reveal-wrap">
      {reveal && <CountdownRing reveal={reveal} />}
      <CardFace
        key={shaking ? `${slot.id}-${shake?.token}` : slot.id}
        slot={slot}
        face={face}
        selectable={!locked && (targeting ? legal : localPhase === 'idle')}
        armed={isArmed}
        dimmed={dimmed}
        legalTarget={legal && targeting}
        locked={locked}
        shaking={shaking}
        raceFade={raceFade && isArmed}
        matchRank={isArmed && view.discardTop ? rankSpokenName(view.discardTop.key) : null}
        ambient={ambient}
        hiding={presence?.hiding ?? false}
        onClick={() => onCardTap(ownerId, slotIndex, slot.id)}
      />
    </span>
  );
}

function PlayerPod({ id, you }: { id: PlayerId; you?: boolean }) {
  const { view, names, playMode, playersList, viewerId } = useGame();
  if (!view) return null;
  const player = view.players[id];
  if (!player) return null;
  const active = view.turn?.playerId === id;
  const locked = view.cambeoCallerId === id;
  const connected = playersList.find((p) => p.playerId === id)?.connected !== false;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
  }, [active]);

  return (
    <div
      ref={ref}
      className={you ? 'player-pod you-pod' : 'player-pod'}
      data-active={active}
      data-locked={locked && !you}
    >
      <div className="player-meta">
        <strong>
          {playMode === 'online' && (
            <span className={connected ? 'dot-on' : 'dot-off'} aria-hidden />
          )}
          {you ? `You · ${names[id] ?? id}` : (names[id] ?? id)}
        </strong>
        <span className="meta-muted">
          <span className="tabular">{player.cardCount}</span> cards
          {locked ? ' · cambeo' : ''}
          {playMode === 'online' && !you && !connected ? ' · away' : ''}
        </span>
      </div>
      <div className="hand-row">
        {player.hand.map((slot, slotIndex) => (
          <HandCard
            key={slot.id}
            slot={slot}
            ownerId={id}
            slotIndex={slotIndex}
            viewerId={viewerId}
          />
        ))}
      </div>
    </div>
  );
}

function TableBody() {
  const { view, viewerId, dispatch } = useGame();
  const { onBackgroundTap, localPhase } = useTableInput();
  const [cambeoFlash, setCambeoFlash] = useState(false);
  const [edge, setEdge] = useState<'positive' | 'negative' | null>(null);

  useEffect(() => {
    if (!view) return;
    if (view.lastEvents.some((e) => e.type === 'CAMBEO_CALLED')) {
      setCambeoFlash(true);
      const t = window.setTimeout(() => setCambeoFlash(false), 1200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [view]);

  useEffect(() => {
    if (!view) return;
    const hit = view.lastEvents.find(
      (e) =>
        (e.type === 'FLIP_SUCCESS' || e.type === 'FLIP_FAIL') &&
        (e.playerId === viewerId || ('targetPlayerId' in e && e.targetPlayerId === viewerId)),
    );
    if (!hit || view.turn?.playerId === viewerId) return;
    setEdge(hit.type === 'FLIP_SUCCESS' ? 'positive' : 'negative');
    const t = window.setTimeout(() => setEdge(null), 400);
    return () => window.clearTimeout(t);
  }, [view, viewerId]);

  if (!view) return null;

  const opponents = (view.seating ?? []).filter((id) => id !== viewerId);
  const canDraw = localPhase === 'TURN_DRAW';

  return (
    <div
      className="table-layout"
      data-size={tableSize(view.seating?.length ?? 0)}
      onClick={onBackgroundTap}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onBackgroundTap();
      }}
    >
      {view.phase === 'FINAL_ROUND' && (
        <div className="final-banner">
          Final round
          {view.finalRoundRemaining?.length
            ? ` · ${view.finalRoundRemaining.length} turn${view.finalRoundRemaining.length === 1 ? '' : 's'} left`
            : ''}
        </div>
      )}

      <div className="opponent-band">
        {opponents.map((id) => (
          <PlayerPod key={id} id={id} />
        ))}
      </div>

      <div className="center-piles">
        <div className="pile">
          <span className="pile-label">Deck · {view.deckCount}</span>
          <button
            type="button"
            className="pile-btn"
            disabled={!canDraw}
            onClick={(e) => {
              e.stopPropagation();
              if (canDraw) dispatch({ type: 'DRAW_DECK', playerId: viewerId });
            }}
            aria-label="Draw from deck"
          >
            <CardFace asButton={false} />
          </button>
        </div>
        <div className="pile">
          <span className="pile-label">
            Discard
            {view.discardTop?.key === 'HEAVEN' ? ' · heaven' : ''}
          </span>
          {view.discardTop ? (
            <button
              type="button"
              className="pile-btn"
              disabled={!canDraw}
              onClick={(e) => {
                e.stopPropagation();
                if (canDraw) dispatch({ type: 'DRAW_DISCARD', playerId: viewerId });
              }}
              aria-label="Draw from discard"
            >
              <div className={view.discardTop.key === 'HEAVEN' ? 'discard-heaven' : undefined}>
                <CardFace face={view.discardTop} asButton={false} />
              </div>
            </button>
          ) : (
            <div className="card card-empty" aria-hidden />
          )}
        </div>
      </div>

      {view.drawnCard && view.turn?.playerId === viewerId && (
        <DrawnCard cardId={view.drawnCard.id} viewerId={viewerId} />
      )}

      <EventLog />
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <PromptBar />
      </div>

      {view.players[viewerId] && <PlayerPod id={viewerId} you />}

      <RevealLift viewerId={viewerId} />

      {cambeoFlash && (
        <div className="cambeo-moment" aria-live="assertive">
          <span>CAMBEO</span>
        </div>
      )}

      {edge && (
        <div
          className="edge-glow"
          style={{
            ['--glow-color' as string]: edge === 'positive' ? 'var(--positive)' : 'var(--negative)',
          }}
        />
      )}
    </div>
  );
}

export function Table() {
  const { view, playMode } = useGame();

  if (!view) return null;

  if (view.phase === 'OVER') {
    return (
      <>
        {playMode === 'hotseat' && <SeatSwitcher />}
        <Scoring />
        <EventLog />
      </>
    );
  }

  return (
    <TableInputProvider>
      {playMode === 'hotseat' && <SeatSwitcher />}
      <TableBody />
    </TableInputProvider>
  );
}
