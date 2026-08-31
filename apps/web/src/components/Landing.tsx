'use client';

import { MuteToggle } from '@/components/MuteToggle';
import { getRememberedPlayerId, getUsername, setUsername, workerHttpUrl } from '@/lib/session';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function Landing() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(getUsername());
  }, []);

  const saveName = (value: string) => {
    setName(value);
    setUsername(value);
  };

  const create = async () => {
    if (!name.trim()) {
      setError('Enter a username first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${workerHttpUrl()}/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const body = (await res.json()) as { roomCode: string };
      router.push(`/r/${body.roomCode}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message}. Is wrangler running on ${workerHttpUrl()}?`
          : 'Could not create room',
      );
    } finally {
      setBusy(false);
    }
  };

  const join = () => {
    if (!name.trim()) {
      setError('Enter a username first');
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a room code');
      return;
    }
    router.push(`/r/${trimmed}`);
  };

  const remembered = code.trim() ? getRememberedPlayerId(code.trim()) : undefined;

  return (
    <div className="app-shell">
      <header className="chrome-row">
        <div>
          <h1 className="brand">Cambeo</h1>
          <p className="brand-sub">Fewest points wins. Create a room or join by code.</p>
        </div>
        <MuteToggle />
      </header>

      <div className="panel">
        <h2>Your name</h2>
        <div className="lobby-row">
          <input
            value={name}
            onChange={(e) => saveName(e.target.value)}
            maxLength={20}
            aria-label="Username"
            placeholder="Alex"
          />
        </div>

        {error && <div className="reject-toast">{error}</div>}

        <div className="btn-row" style={{ margin: '1rem 0' }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void create()}>
            {busy ? 'Creating…' : 'Create room'}
          </button>
        </div>

        <h2>Join</h2>
        <div className="lobby-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            aria-label="Room code"
            placeholder="Room code"
            onKeyDown={(e) => {
              if (e.key === 'Enter') join();
            }}
          />
        </div>
        <div className="btn-row" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="btn btn-ghost" onClick={join}>
            Join room
          </button>
        </div>
        {remembered && (
          <p className="prompt-hint">This browser has a saved seat for that room (this tab is a new seat unless you reopen the same tab).</p>
        )}
      </div>

      <p className="brand-sub">
        <Link href="/hotseat">Hot-seat (one device, no server)</Link>
      </p>
    </div>
  );
}
