'use client';

import { CardFace } from '@/components/CardFace';
import { useGame } from '@/lib/play-context';

export function Scoring() {
  const { view, names, rematch, ruleSet, playMode } = useGame();
  if (!view || view.phase !== 'OVER' || !view.result) return null;

  const { totals, winnerIds, callerBeaten } = view.result;

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
        {view.seating.map((id) => (
          <div
            key={id}
            className="score-row"
            data-winner={winnerIds.includes(id)}
          >
            <div className="score-head">
              <span>
                {names[id] ?? id}
                {winnerIds.includes(id) ? ' · winner' : ''}
                {view.cambeoCallerId === id ? ' · called' : ''}
              </span>
              <span>{totals[id]} pts</span>
            </div>
            <div className="hand-row">
              {view.players[id]?.hand.map((slot) => (
                <CardFace key={slot.id} slot={slot} asButton={false} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {playMode === 'hotseat' && (
        <div className="btn-row" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-primary" onClick={rematch}>
            Rematch (same players, {ruleSet.jokers ? 'House Rules' : 'rules'})
          </button>
        </div>
      )}
    </div>
  );
}
