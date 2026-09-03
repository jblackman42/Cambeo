'use client';

import { CardArtPreloader } from '@/components/CardArtPreloader';
import { MuteToggle } from '@/components/MuteToggle';
import { OnlineLobby } from '@/components/OnlineLobby';
import { Table } from '@/components/Table';
import { useGame } from '@/lib/play-context';
import { OnlineProvider } from '@/lib/online-store';
import Link from 'next/link';

function Shell() {
  const { view, wsStatus, roomCode, kicked } = useGame();

  if (kicked) {
    return (
      <div className="app-shell landing">
        <header className="lobby-head">
          <span className="wordmark">Cambeo</span>
        </header>
        <div className="landing-body">
          <p className="removed-title">The host removed you from this room</p>
          <Link className="btn btn-primary btn-hero btn-link" href="/">
            Back to start
          </Link>
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="app-shell app-shell-lobby">
        <CardArtPreloader />
        <OnlineLobby />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <CardArtPreloader />
      <header className="chrome-row">
        <div>
          <h1 className="brand">Cambeo</h1>
          <p className="brand-sub">
            {roomCode ? `Room ${roomCode}` : 'Online'}
            {wsStatus === 'connecting' ? ' · connecting…' : ''}
            {wsStatus === 'closed' ? ' · reconnecting…' : ''}
          </p>
        </div>
        <MuteToggle />
      </header>
      <Table />
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
