'use client';

import { validateForTable } from '@cambeo/shared';
import { Pencil, QrCode, Settings, UserMinus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGame } from '@/lib/play-context';
import { getUsername } from '@/lib/session';
import { CopyLinkField } from '@/components/CopyLinkField';
import { MuteToggle } from '@/components/MuteToggle';
import { NamePrompt } from '@/components/NamePrompt';
import { QrModal } from '@/components/QrModal';
import { SettingsPanel } from '@/components/SettingsPanel';

export function OnlineLobby() {
  const {
    roomCode,
    playersList,
    isHost,
    startGame,
    ruleSet,
    lastError,
    wsStatus,
    renameSelf,
    kickPlayer,
    viewerId,
  } = useGame();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [nameEditor, setNameEditor] = useState<'join' | 'edit' | null>(null);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!getUsername().trim()) setNameEditor('join');
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
        {playersList.map((p) => {
          const isYou = p.playerId === viewerId;
          const confirming = confirmKickId === p.playerId;
          return (
            <li className="player-row" key={p.playerId} data-confirming={confirming}>
              <span className={p.connected ? 'dot-on' : 'dot-off'} aria-hidden />
              <span className="player-name">{confirming ? `Remove ${p.name}?` : p.name}</span>

              {confirming ? (
                <>
                  <button
                    type="button"
                    className="btn btn-danger btn-compact"
                    onClick={() => {
                      kickPlayer?.(p.playerId);
                      setConfirmKickId(null);
                    }}
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    onClick={() => setConfirmKickId(null)}
                    aria-label="Cancel"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  {p.isHost && <span className="player-tag">Host</span>}
                  {!p.connected && <span className="player-tag">Away</span>}
                  {isYou && (
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      onClick={() => setNameEditor('edit')}
                      aria-label="Edit your name"
                      title="Edit your name"
                    >
                      <Pencil size={16} aria-hidden />
                    </button>
                  )}
                  {isHost && !isYou && (
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm"
                      onClick={() => setConfirmKickId(p.playerId)}
                      aria-label={`Remove ${p.name}`}
                      title={`Remove ${p.name}`}
                    >
                      <UserMinus size={16} aria-hidden />
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
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
      {nameEditor && (
        <NamePrompt
          initialName={nameEditor === 'edit' ? getUsername() : ''}
          submitLabel={nameEditor === 'edit' ? 'Save' : 'Join room'}
          onSubmit={(name) => {
            renameSelf?.(name);
            setNameEditor(null);
          }}
          onDismiss={() => setNameEditor(null)}
        />
      )}
    </div>
  );
}
