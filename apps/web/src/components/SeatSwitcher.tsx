'use client';

import { useGame } from '@/lib/play-context';

export function SeatSwitcher() {
  const { view, viewerId, setViewerId, names, playMode } = useGame();
  if (!view || playMode !== 'hotseat') return null;

  return (
    <div className="seat-bar" role="tablist" aria-label="Switch seat">
      {view.seating.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          className="seat-chip"
          data-active={viewerId === id}
          data-turn={view.turn?.playerId === id}
          aria-selected={viewerId === id}
          onClick={() => setViewerId(id)}
        >
          {names[id] ?? id}
        </button>
      ))}
    </div>
  );
}
