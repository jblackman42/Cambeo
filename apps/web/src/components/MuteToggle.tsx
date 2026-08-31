'use client';

import { getMuted, setMuted } from '@/lib/sounds';
import { useEffect, useState } from 'react';

export function MuteToggle() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(getMuted());
  }, []);

  return (
    <button
      type="button"
      className="mute-toggle"
      aria-pressed={!muted}
      onClick={() => {
        const next = !getMuted();
        setMuted(next);
        setMutedState(next);
      }}
    >
      {muted ? 'Muted' : 'Sound'}
    </button>
  );
}
