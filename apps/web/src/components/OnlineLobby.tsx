'use client';

import { validateForTable } from '@cambeo/shared';
import { QrCode, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGame } from '@/lib/play-context';
import { getUsername } from '@/lib/session';
import { CopyLinkField } from '@/components/CopyLinkField';
import { MuteToggle } from '@/components/MuteToggle';
import { NamePrompt } from '@/components/NamePrompt';
import { QrModal } from '@/components/QrModal';
import { SettingsPanel } from '@/components/SettingsPanel';

export function OnlineLobby() {
  const { roomCode, playersList, isHost, startGame, ruleSet, lastError, wsStatus, renameSelf } =
    useGame();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!getUsername().trim()) setNeedsName(true);
  }, []);

  const table = validateForTable(ruleSet, playersList.length);
  const canStart = isHost && table.ok;
  const url = origin && roomCode ? `${origin}/r/${roomCode}` : '';

  return (
    <div className="lobby">
      <header className="lobby-head">
        <span className="wordmark">Cambeo</span>
        <div className="icon-row">
          <MuteToggle />
          <button
            type="button"
            className="icon-btn"
            onClick={() => setQrOpen(true)}
            aria-label="Show join QR code"
            title="Scan to join"
            disabled={!url}
          >
            <QrCode size={20} aria-hidden />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label={isHost ? 'Game settings' : 'View rules'}
            title={isHost ? 'Settings' : 'Rules'}
          >
            <Settings size={20} aria-hidden />
          </button>
        </div>
      </header>

      <div className="room-hero">
        <span className="room-code-label">Room code</span>
        <p className="room-code tabular" data-long={(roomCode?.length ?? 0) > 6}>
          {roomCode}
        </p>
      </div>

      {url && <CopyLinkField url={url} />}

      {lastError && <div className="reject-toast">{lastError}</div>}
      {wsStatus !== 'open' && (
        <p className="status-line">
          {wsStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
        </p>
      )}

      <ul className="player-list">
        {playersList.map((p) => (
          <li className="player-row" key={p.playerId}>
            <span className={p.connected ? 'dot-on' : 'dot-off'} aria-hidden />
            <span className="player-name">{p.name}</span>
            {p.isHost && <span className="player-tag">Host</span>}
            {!p.connected && <span className="player-tag">Away</span>}
          </li>
        ))}
      </ul>

      <div className="action-bar">
        {isHost ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-hero"
              disabled={!canStart}
              onClick={startGame}
            >
              Start game
            </button>
            {!table.ok && <p className="status-line">{table.errors.join(' · ')}</p>}
          </>
        ) : (
          <p className="status-line">Waiting for the host</p>
        )}
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {qrOpen && url && (
        <QrModal url={url} roomCode={roomCode ?? ''} onClose={() => setQrOpen(false)} />
      )}
      {needsName && (
        <NamePrompt
          onSubmit={(name) => {
            renameSelf?.(name);
            setNeedsName(false);
          }}
          onDismiss={() => setNeedsName(false)}
        />
      )}
    </div>
  );
}
