'use client';

import { CardFace } from '@/components/CardFace';
import { useGame } from '@/lib/play-context';
import { formatPoints } from '@/lib/format';
import { isHouseRules, type PlayerId, type SlotView } from '@cambeo/shared';
import { useEffect, useState } from 'react';

function scoringOrder(seating: PlayerId[], caller: PlayerId | null): PlayerId[] {
  if (!caller) return seating;
  const idx = seating.indexOf(caller);
  if (idx < 0) return seating;
  return [...seating.slice(idx + 1), ...seating.slice(0, idx), caller];
}

function ScoreRow({
  name,
  winner,
  called,
  total,
  hand,
  startDelay,
}: {
  name: string;
  winner: boolean;
  called: boolean;
  total: number;
  hand: SlotView[];
  startDelay: number;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const timers = hand.map((_, i) =>
      window.setTimeout(() => setShown(i + 1), startDelay + 120 * (i + 1)),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [hand, startDelay]);

  const running = hand.slice(0, shown).reduce((sum, slot) => sum + (slot.known ? slot.value : 0), 0);
  const locked = shown >= hand.length;

  return (
    <div className="score-row" data-winner={winner}>
      <div className="score-head">
        <span>
          {name}
          {winner ? ' · winner' : ''}
          {called ? ' · called' : ''}
        </span>
        <span className="tabular">
          {locked ? formatPoints(total) : formatPoints(running)} pts
        </span>
      </div>
      <div className="hand-row">
        {hand.map((slot, i) => (
          <div
            key={slot.id}
            style={{ animationDelay: `${startDelay + 120 * (i + 1)}ms` }}
          >
            {i < shown ? (
              <CardFace slot={slot} asButton={false} />
            ) : (
              <CardFace asButton={false} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Scoring() {
  const { view, names, rematch, ruleSet, playMode } = useGame();
  if (!view || view.phase !== 'OVER' || !view.result) return null;

  const { totals, winnerIds, callerBeaten } = view.result;
  const order = scoringOrder(view.seating, view.cambeoCallerId);
  const delays: Record<string, number> = {};
  let acc = 0;
  for (const id of order) {
    delays[id] = acc;
    acc += 120 * ((view.players[id]?.hand.length ?? 0) + 1);
  }

  return (
    <div className="panel">
      <h2>Game over</h2>
      <p className="prompt-hint" style={{ marginBottom: '1rem' }}>
        {callerBeaten
          ? 'Someone tied or beat the caller.'
          : view.cambeoCallerId
            ? `${names[view.cambeoCallerId] ?? 'Caller'} held the lead.`
            : 'Lowest total wins.'}
      </p>

      <div className="scoring-grid">
        {order.map((id) => (
          <ScoreRow
            key={id}
            name={names[id] ?? id}
            winner={winnerIds.includes(id)}
            called={view.cambeoCallerId === id}
            total={totals[id] ?? 0}
            hand={view.players[id]?.hand ?? []}
            startDelay={delays[id] ?? 0}
          />
        ))}
      </div>

      {playMode === 'hotseat' && (
        <div className="btn-row" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-primary" onClick={rematch}>
            Rematch (same players, {isHouseRules(ruleSet) ? 'House Rules' : 'custom rules'})
          </button>
        </div>
      )}
    </div>
  );
}
