'use client';

import { useGame } from '@/lib/game-store';

export function SeatSwitcher() {
  const { state, viewerId, setViewerId, names } = useGame();
  if (!state) return null;

  return (
    <div className="seat-bar" role="tablist" aria-label="Switch seat">
      {state.seating.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          className="seat-chip"
          data-active={viewerId === id}
          data-turn={state.turn?.playerId === id}
          aria-selected={viewerId === id}
          onClick={() => setViewerId(id)}
        >
          {names[id] ?? id}
        </button>
      ))}
    </div>
  );
}
