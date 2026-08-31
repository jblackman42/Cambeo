'use client';

import { isHouseRules, validateForTable } from '@cambeo/shared';
import { useState } from 'react';
import { useGame } from '@/lib/play-context';
import { RulesSummary } from '@/components/RulesSummary';
import { SettingsPanel } from '@/components/SettingsPanel';

export function OnlineLobby() {
  const { roomCode, playersList, isHost, startGame, ruleSet, lastError, wsStatus } = useGame();
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const table = validateForTable(ruleSet, playersList.length);
  const canStart = isHost && table.ok;

  const copy = async () => {
    if (!roomCode) return;
    const url = `${window.location.origin}/r/${roomCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (settingsOpen && isHost) {
    return <SettingsPanel onClose={() => setSettingsOpen(false)} />;
  }

  return (
    <div className="panel">
      <h2>Room {roomCode}</h2>
      <p className="brand-sub" style={{ marginBottom: '1rem' }}>
        Share the code. Host starts at {ruleSet.minPlayers}+ players.
        {isHouseRules(ruleSet) ? ' House Rules.' : ' Custom rules.'}
        {wsStatus !== 'open' ? ` · ${wsStatus}` : ''}
      </p>

      {lastError && <div className="reject-toast">{lastError}</div>}

      <div className="btn-row" style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn btn-ghost" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <div className="lobby-list">
        {playersList.map((p) => (
          <div className="lobby-row" key={p.playerId}>
            <span>
              <span className={p.connected ? 'dot-on' : 'dot-off'} aria-hidden />
              {p.name}
              {p.isHost ? ' · host' : ''}
              {!p.connected ? ' · away' : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="btn-row" style={{ margin: '1rem 0' }}>
        {isHost ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canStart}
              onClick={startGame}
            >
              Start game
            </button>
          </>
        ) : (
          <p className="prompt-hint">Waiting for the host to start…</p>
        )}
      </div>

      <RulesSummary ruleSet={ruleSet} playerCount={playersList.length} />
    </div>
  );
}
