'use client';

import { useGame } from '@/lib/play-context';
import { useState } from 'react';

export function OnlineLobby() {
  const { roomCode, playersList, isHost, startGame, ruleSet, lastError, wsStatus } = useGame();
  const [copied, setCopied] = useState(false);
  const canStart = isHost && playersList.length >= ruleSet.minPlayers;

  const copy = async () => {
    if (!roomCode) return;
    const url = `${window.location.origin}/r/${roomCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="panel">
      <h2>Room {roomCode}</h2>
      <p className="brand-sub" style={{ marginBottom: '1rem' }}>
        Share the code. Host starts at {ruleSet.minPlayers}+ players. House Rules.
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
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canStart}
            onClick={startGame}
          >
            Start game
          </button>
        ) : (
          <p className="prompt-hint">Waiting for the host to start…</p>
        )}
      </div>

      <h2>Rules</h2>
      <dl className="rules-summary">
        <dt>Hand</dt>
        <dd>
          {ruleSet.handSize} cards, peek {ruleSet.initialRevealCount} at start
        </dd>
        <dt>Jokers</dt>
        <dd>{ruleSet.jokers ? 'Heaven (−4) and Hell (+15) on' : 'Off'}</dd>
        <dt>Players</dt>
        <dd>
          {ruleSet.minPlayers}–{ruleSet.maxPlayers}
        </dd>
      </dl>
    </div>
  );
}
