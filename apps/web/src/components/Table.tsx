'use client';

import { CardFace } from '@/components/CardFace';
import { EventLog } from '@/components/EventLog';
import { PromptBar } from '@/components/PromptBar';
import { Scoring } from '@/components/Scoring';
import { SeatSwitcher } from '@/components/SeatSwitcher';
import { useGame } from '@/lib/play-context';
import {
  TableInputProvider,
  useTableInput,
} from '@/lib/table-input';
import {
  isLegalCardTarget,
  powerModeFromView,
} from '@/lib/input-routing';
import { rankSpokenName } from '@/lib/format';
import type { PlayerId, PublicCardView, RedactedGameView, SlotView } from '@cambeo/shared';
import { useEffect, useRef, useState } from 'react';

const REVEAL_HOLD_MS = 2500;

function RevealLift({
  view,
  viewerId,
}: {
  view: RedactedGameView;
  viewerId: PlayerId;
}) {
  const [reveal, setReveal] = useState<PublicCardView | null>(null);
  const processed = useRef<string | null>(null);

  useEffect(() => {
    const fingerprint = `${viewerId}:${view.lastEvents
      .map((e) => `${e.type}${'cardId' in e ? `:${e.cardId}` : ''}`)
      .join(',')}`;
    if (processed.current === fingerprint) return;
    processed.current = fingerprint;
    const ev = view.lastEvents.find(
      (e) => e.type === 'POWER_REVEAL' && e.playerId === viewerId && e.key && e.suit,
    );
    if (!ev || ev.type !== 'POWER_REVEAL' || !ev.key || !ev.suit) return;
    setReveal({
      id: ev.cardId,
      key: ev.key,
      suit: ev.suit,
      value: view.ruleSet.values[ev.key] ?? 0,
    });
  }, [view, viewerId]);

  useEffect(() => {
    if (!reveal) return;
    const t = window.setTimeout(() => setReveal(null), REVEAL_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [reveal]);

  useEffect(() => {
    if (!reveal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReveal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reveal]);

  if (!reveal) return null;

  return (
    <button
      type="button"
      className="reveal-overlay"
      onClick={() => setReveal(null)}
      aria-label="Dismiss revealed card"
    >
      <span className="reveal-stage">
        <svg className="reveal-countdown" viewBox="0 0 200 292" aria-hidden>
          <rect x="4" y="4" width="192" height="284" rx="14" pathLength="1" />
        </svg>
        <CardFace face={reveal} asButton={false} />
      </span>
      <span className="reveal-hint">Tap to close</span>
    </button>
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
  const { view } = useGame();
  const { localPhase, armed, onCardTap, shake, raceFade } = useTableInput();
  if (!view) return null;

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
  const knownKey = slot.known ? slot.key : null;
  const ambient =
    ownerId === viewerId && slot.known && (slot.key === 'HEAVEN' || slot.key === 'HELL')
      ? slot.key === 'HEAVEN'
        ? 'heaven'
        : 'hell'
      : null;
  const shaking = shake?.ownerId === ownerId && shake.slotIndex === slotIndex;

  return (
    <CardFace
      key={shaking ? `${slot.id}-${shake?.token}` : slot.id}
      slot={slot}
      selectable={!locked && (targeting ? legal : localPhase === 'idle')}
      armed={isArmed}
      dimmed={dimmed}
      legalTarget={legal && targeting}
      locked={locked}
      shaking={shaking}
      raceFade={raceFade && isArmed}
      matchRank={isArmed && view.discardTop ? rankSpokenName(view.discardTop.key) : null}
      ambient={ambient}
      onClick={() => onCardTap(ownerId, slotIndex, slot.id, knownKey)}
    />
  );
}

function PlayerPod({
  id,
  you,
}: {
  id: PlayerId;
  you?: boolean;
}) {
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

  const opponents = view.seating.filter((id) => id !== viewerId);
  const canDraw = localPhase === 'TURN_DRAW';

  return (
    <div
      className="table-layout"
      data-size={tableSize(view.seating.length)}
      onClick={onBackgroundTap}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onBackgroundTap();
      }}
    >
      {view.phase === 'FINAL_ROUND' && (
        <div className="final-banner">
          Final round
          {view.finalRoundRemaining.length > 0
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
        <div className="drawn-card-wrap">
          <div>
            <div className="pile-label" style={{ textAlign: 'center', marginBottom: 6 }}>
              Drawn
            </div>
            <CardFace face={view.drawnCard} asButton={false} />
          </div>
        </div>
      )}

      <EventLog />
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <PromptBar />
      </div>

      {view.players[viewerId] && <PlayerPod id={viewerId} you />}

      <RevealLift view={view} viewerId={viewerId} />

      {cambeoFlash && (
        <div className="cambeo-moment" aria-live="assertive">
          <span>CAMBEO</span>
        </div>
      )}

      {edge && (
        <div
          className="edge-glow"
          style={{ ['--glow-color' as string]: edge === 'positive' ? 'var(--positive)' : 'var(--negative)' }}
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
