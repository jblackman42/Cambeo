'use client';

import { Lobby } from '@/components/Lobby';
import { Table } from '@/components/Table';
import { GameProvider, useGame } from '@/lib/game-store';
import { decodeRuleSetCode } from '@cambeo/shared';
import { useEffect, useRef } from 'react';

function Shell() {
  const { view } = useGame();

  return (
    <div className="app-shell">
      <header>
        <h1 className="brand">Cambeo</h1>
        <p className="brand-sub">{view ? 'Hot-seat table' : 'Fewest points wins'}</p>
      </header>
      {!view ? <Lobby /> : <Table />}
    </div>
  );
}

function ApplyRulesFromQuery() {
  const { applyRules } = useGame();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    const raw = new URLSearchParams(window.location.search).get('rules');
    if (!raw) return;
    const decoded = decodeRuleSetCode(raw);
    if (decoded) applyRules(decoded);
  }, [applyRules]);

  return null;
}

export function HotSeatApp() {
  return (
    <GameProvider>
      <ApplyRulesFromQuery />
      <Shell />
    </GameProvider>
  );
}
