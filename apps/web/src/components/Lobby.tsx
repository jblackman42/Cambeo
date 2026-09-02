'use client';

import { useState } from 'react';
import { useGame } from '@/lib/game-store';
import { RulesSummary } from '@/components/RulesSummary';
import { SettingsPanel } from '@/components/SettingsPanel';
import { validateForTable } from '@cambeo/shared';

const DEFAULT_NAMES = ['Alex', 'Blair', 'Casey'];

export function Lobby() {
  const { ruleSet, resetLobby } = useGame();
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES);
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!resetLobby) return null;

  const table = validateForTable(ruleSet, names.length);
  const canStart =
    table.ok && names.length >= ruleSet.minPlayers && names.every((n) => n.trim().length > 0);

  return (
    <div className="panel">
      <h2>Hot-seat lobby</h2>
      <p className="brand-sub" style={{ marginBottom: '1rem' }}>
        One device, pass it around. No server.
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
        <button type="button" className="btn btn-ghost" onClick={() => setSettingsOpen(true)}>
          Settings
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

      <RulesSummary ruleSet={ruleSet} playerCount={names.length} />

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
