'use client';

import { Lobby } from '@/components/Lobby';
import { Table } from '@/components/Table';
import { GameProvider, useGame } from '@/lib/game-store';

function Shell() {
  const { state } = useGame();

  return (
    <div className="app-shell">
      <header>
        <h1 className="brand">Cambeo</h1>
        <p className="brand-sub">
          {state ? 'Hot-seat table' : 'Fewest points wins'}
        </p>
      </header>
      {!state ? <Lobby /> : <Table />}
    </div>
  );
}

export function HotSeatApp() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
