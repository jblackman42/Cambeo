'use client';

import { CardFace } from '@/components/CardFace';
import { useGame } from '@/lib/game-store';

export function Scoring() {
  const { state, view, names, rematch, ruleSet } = useGame();
  if (!state || !view || state.phase !== 'OVER' || !state.result) return null;

  const { totals, winnerIds, callerBeaten } = state.result;

  return (
    <div className="panel">
      <h2>Game over</h2>
      <p className="prompt-hint" style={{ marginBottom: '1rem' }}>
        {callerBeaten
          ? 'Someone tied or beat the caller.'
          : state.cambeo
            ? `${names[state.cambeo.callerId] ?? 'Caller'} held the lead.`
            : 'Lowest total wins.'}
      </p>

      <div className="scoring-grid">
        {state.seating.map((id) => (
          <div
            key={id}
            className="score-row"
            data-winner={winnerIds.includes(id)}
          >
            <div className="score-head">
              <span>
                {names[id] ?? id}
                {winnerIds.includes(id) ? ' · winner' : ''}
                {state.cambeo?.callerId === id ? ' · called' : ''}
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

      <div className="btn-row" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={rematch}>
          Rematch (same players, {ruleSet.jokers ? 'House Rules' : 'rules'})
        </button>
      </div>
    </div>
  );
}
