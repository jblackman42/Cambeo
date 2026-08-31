'use client';

import { Lobby } from '@/components/Lobby';
import { Table } from '@/components/Table';
import { GameProvider, useGame } from '@/lib/game-store';

function Shell() {
  const { view } = useGame();

  return (
    <div className="app-shell">
      <header>
        <h1 className="brand">Cambeo</h1>
        <p className="brand-sub">
          {view ? 'Hot-seat table' : 'Fewest points wins'}
        </p>
      </header>
      {!view ? <Lobby /> : <Table />}
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
