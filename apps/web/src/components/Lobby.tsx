'use client';

import { useState } from 'react';
import { useGame } from '@/lib/game-store';

const DEFAULT_NAMES = ['Alex', 'Blair', 'Casey'];

export function Lobby() {
  const { ruleSet, resetLobby } = useGame();
  if (!resetLobby) return null;
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);

  const canStart = names.length >= ruleSet.minPlayers && names.every((n) => n.trim().length > 0);

  return (
    <div className="panel">
      <h2>Hot-seat lobby</h2>
      <p className="brand-sub" style={{ marginBottom: '1rem' }}>
        One device, pass it around. House Rules. No server.
      </p>

      <div className="lobby-list">
        {names.map((name, i) => (
          <div className="lobby-row" key={i}>
            <input
              value={name}
              aria-label={`Player ${i + 1} name`}
              onChange={(e) => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
              maxLength={20}
            />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={names.length <= ruleSet.minPlayers}
              onClick={() => setNames(names.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="btn-row" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={names.length >= ruleSet.maxPlayers}
          onClick={() => setNames([...names, `Player ${names.length + 1}`])}
        >
          Add player
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canStart}
          onClick={() => resetLobby(names)}
        >
          Start game
        </button>
      </div>

      <h2>Rules</h2>
      <dl className="rules-summary">
        <dt>Hand</dt>
        <dd>
          {ruleSet.handSize} cards, peek {ruleSet.initialRevealCount} at start
        </dd>
        <dt>Jokers</dt>
        <dd>{ruleSet.jokers ? 'Heaven (−4) and Hell (+15) on' : 'Off'}</dd>
        <dt>Loss threshold</dt>
        <dd>More than {ruleSet.lossThreshold} cards (flagged only — open question)</dd>
        <dt>Powers</dt>
        <dd>6–7 peek own · 8–9 spy · 10 blind swap · J look then swap</dd>
        <dt>Players</dt>
        <dd>
          {ruleSet.minPlayers}–{ruleSet.maxPlayers}
        </dd>
      </dl>
    </div>
  );
}
