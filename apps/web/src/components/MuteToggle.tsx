'use client';

import { getMuted, setMuted } from '@/lib/sounds';
import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

export function MuteToggle() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(getMuted());
  }, []);

  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={muted}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      title={muted ? 'Unmute' : 'Mute'}
      onClick={() => {
        const next = !getMuted();
        setMuted(next);
        setMutedState(next);
      }}
    >
      {muted ? <VolumeX size={20} aria-hidden /> : <Volume2 size={20} aria-hidden />}
    </button>
  );
}
