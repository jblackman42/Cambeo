'use client';

import { OnlineLobby } from '@/components/OnlineLobby';
import { Table } from '@/components/Table';
import { useGame } from '@/lib/play-context';
import { OnlineProvider } from '@/lib/online-store';

function Shell() {
  const { view, wsStatus, lastError, roomCode } = useGame();

  return (
    <div className="app-shell">
      <header>
        <h1 className="brand">Cambeo</h1>
        <p className="brand-sub">
          {roomCode ? `Room ${roomCode}` : 'Online'}
          {wsStatus === 'connecting' ? ' · connecting…' : ''}
          {wsStatus === 'closed' ? ' · reconnecting…' : ''}
        </p>
      </header>
      {lastError && !view && <div className="reject-toast">{lastError}</div>}
      {!view ? <OnlineLobby /> : <Table />}
    </div>
  );
}

export function OnlineApp({ roomCode }: { roomCode: string }) {
  return (
    <OnlineProvider roomCode={roomCode}>
      <Shell />
    </OnlineProvider>
  );
}
