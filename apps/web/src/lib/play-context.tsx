import type { Action, PlayerId, RedactedGameView, RoomPlayerInfo, RuleSet } from '@cambeo/shared';
import { createContext, useContext, type ReactNode } from 'react';

export type InteractionMode =
  | { kind: 'flip' }
  | { kind: 'replace' }
  | { kind: 'give' }
  | { kind: 'power-card'; allowOwn: boolean; allowOther: boolean }
  | { kind: 'power-player' };

export type PlayMode = 'hotseat' | 'online';

export interface PlayStore {
  playMode: PlayMode;
  ruleSet: RuleSet;
  viewerId: PlayerId;
  names: Record<PlayerId, string>;
  view: RedactedGameView | null;
  lastReject: string | null;
  mode: InteractionMode;
  setMode: (mode: InteractionMode) => void;
  dispatch: (action: Action) => void;
  rematch: () => void;
  setViewerId: (id: PlayerId) => void;
  roomCode: string | null;
  isHost: boolean;
  playersList: RoomPlayerInfo[];
  startGame: () => void;
  resetLobby: ((names: string[]) => void) | null;
  wsStatus: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  lastError: string | null;
}

const PlayContext = createContext<PlayStore | null>(null);

export function PlayProvider({
  value,
  children,
}: {
  value: PlayStore;
  children: ReactNode;
}) {
  return <PlayContext.Provider value={value}>{children}</PlayContext.Provider>;
}

export function usePlay(): PlayStore {
  const ctx = useContext(PlayContext);
  if (!ctx) throw new Error('usePlay must be used within a PlayProvider');
  return ctx;
}

/** Alias used by table components. */
export function useGame(): PlayStore {
  return usePlay();
}

export function deriveMode(view: RedactedGameView | null, viewerId: PlayerId): InteractionMode {
  if (!view) return { kind: 'flip' };
  if (view.phase === 'GIVE_CARD_PENDING' && view.pendingGive?.flipperId === viewerId) {
    return { kind: 'give' };
  }
  return { kind: 'flip' };
}
