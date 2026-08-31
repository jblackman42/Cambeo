import type { Action, GameState, PlayerId } from '@cambeo/engine';
import { createGame, createRng, reduce, viewFor } from '@cambeo/engine';
import { HOUSE_RULES, type RedactedGameView, type RuleSet } from '@cambeo/shared';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type InteractionMode =
  | { kind: 'flip' }
  | { kind: 'replace' }
  | { kind: 'give' }
  | { kind: 'power-card'; allowOwn: boolean; allowOther: boolean }
  | { kind: 'power-player' };

interface GameStore {
  ruleSet: RuleSet;
  state: GameState | null;
  viewerId: PlayerId;
  names: Record<PlayerId, string>;
  view: RedactedGameView | null;
  lastReject: string | null;
  mode: InteractionMode;
  setViewerId: (id: PlayerId) => void;
  setMode: (mode: InteractionMode) => void;
  resetLobby: (playerNames: string[]) => void;
  rematch: () => void;
  dispatch: (action: Action) => void;
}

const GameContext = createContext<GameStore | null>(null);

function makeIds(names: string[]): { ids: PlayerId[]; nameMap: Record<PlayerId, string> } {
  const ids = names.map((_, i) => `p${i + 1}`);
  const nameMap: Record<PlayerId, string> = {};
  names.forEach((name, i) => {
    nameMap[ids[i]!] = name.trim() || `Player ${i + 1}`;
  });
  return { ids, nameMap };
}

function deriveMode(state: GameState | null, viewerId: PlayerId): InteractionMode {
  if (!state) return { kind: 'flip' };
  if (state.phase === 'GIVE_CARD_PENDING' && state.pendingGive?.flipperId === viewerId) {
    return { kind: 'give' };
  }
  if (state.phase === 'POWER_TARGETING' && state.pendingPower?.playerId === viewerId) {
    const def = state.pendingPower;
    // Mode refined by UI from POWER_DEFINITIONS; default to flip until PromptBar sets it
    void def;
    return { kind: 'flip' };
  }
  if (
    state.phase === 'TURN_CHOICE' &&
    state.turn?.playerId === viewerId &&
    state.drawnCard
  ) {
    return { kind: 'flip' };
  }
  return { kind: 'flip' };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [ruleSet] = useState<RuleSet>(HOUSE_RULES);
  const [state, setState] = useState<GameState | null>(null);
  const [viewerId, setViewerId] = useState<PlayerId>('p1');
  const [names, setNames] = useState<Record<PlayerId, string>>({});
  const [lastReject, setLastReject] = useState<string | null>(null);
  const [mode, setMode] = useState<InteractionMode>({ kind: 'flip' });
  const [lobbyNames, setLobbyNames] = useState<string[]>([]);

  const resetLobby = useCallback(
    (playerNames: string[]) => {
      const { ids, nameMap } = makeIds(playerNames);
      const seed = `hotseat-${Date.now()}`;
      let game = createGame(ids, seed, ruleSet);
      const rng = createRng(seed, game.rngState);
      game = reduce(game, { type: 'START_GAME', playerId: ids[0]! }, ruleSet, rng);
      setLobbyNames(playerNames);
      setNames(nameMap);
      setState(game);
      setViewerId(ids[0]!);
      setLastReject(null);
      setMode({ kind: 'flip' });
    },
    [ruleSet],
  );

  const rematch = useCallback(() => {
    if (lobbyNames.length === 0) return;
    resetLobby(lobbyNames);
  }, [lobbyNames, resetLobby]);

  const dispatch = useCallback(
    (action: Action) => {
      setState((prev) => {
        if (!prev) return prev;
        const rng = createRng(prev.seed, prev.rngState);
        const next = reduce(prev, action, ruleSet, rng);
        const reject = next.lastEvents.find((e) => e.type === 'ACTION_REJECTED');
        if (reject && reject.type === 'ACTION_REJECTED') {
          setLastReject(reject.reason);
        } else {
          setLastReject(null);
        }
        setMode(deriveMode(next, viewerId));
        return next;
      });
    },
    [ruleSet, viewerId],
  );

  const view = useMemo(() => {
    if (!state) return null;
    return viewFor(state, viewerId, ruleSet);
  }, [state, viewerId, ruleSet]);

  const value: GameStore = {
    ruleSet,
    state,
    viewerId,
    names,
    view,
    lastReject,
    mode,
    setViewerId: (id) => {
      setViewerId(id);
      setMode(deriveMode(state, id));
    },
    setMode,
    resetLobby,
    rematch,
    dispatch,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameStore {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
