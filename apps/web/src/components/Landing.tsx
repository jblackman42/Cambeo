'use client';

import { MuteToggle } from '@/components/MuteToggle';
import { getUsername, setUsername, workerHttpUrl } from '@/lib/session';
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
      setError('Enter your name first');
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
      setError('Enter your name first');
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a room code');
      return;
    }
    router.push(`/r/${trimmed}`);
  };

  return (
    <div className="app-shell landing">
      <header className="lobby-head">
        <span className="wordmark">Cambeo</span>
        <div className="icon-row">
          <MuteToggle />
        </div>
      </header>

      <div className="landing-body">
        <input
          className="text-input text-input-lg"
          value={name}
          onChange={(e) => saveName(e.target.value)}
          maxLength={20}
          aria-label="Your name"
          placeholder="Your name"
        />

        {error && <div className="reject-toast">{error}</div>}

        <button
          type="button"
          className="btn btn-primary btn-hero"
          disabled={busy}
          onClick={() => void create()}
        >
          {busy ? 'Creating…' : 'Create room'}
        </button>

        <div className="rule-or">
          <span>or</span>
        </div>

        <div className="join-row">
          <input
            className="text-input code-input tabular"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            aria-label="Room code"
            placeholder="CODE"
            onKeyDown={(e) => {
              if (e.key === 'Enter') join();
            }}
          />
          <button type="button" className="btn btn-ghost btn-join" onClick={join}>
            Join
          </button>
        </div>
      </div>
    </div>
  );
}
