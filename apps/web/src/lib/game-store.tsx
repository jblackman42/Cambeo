'use client';

import type { Action, PlayerId } from '@cambeo/engine';
import { createGame, createRng, reduce, viewFor } from '@cambeo/engine';
import { HOUSE_RULES, cloneRuleSet, type RedactedGameView, type RuleSet } from '@cambeo/shared';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PlayProvider, deriveMode, type InteractionMode, type PlayStore } from '@/lib/play-context';
import {
  dismissInitialPeeks as dropInitialPeeks,
  expireReveals,
  ingestReveals,
  nextExpiryAt,
  type ActiveReveal,
} from '@/lib/reveals';

function makeIds(names: string[]): { ids: PlayerId[]; nameMap: Record<PlayerId, string> } {
  const ids = names.map((_, i) => `p${i + 1}`);
  const nameMap: Record<PlayerId, string> = {};
  names.forEach((name, i) => {
    nameMap[ids[i]!] = name.trim() || `Player ${i + 1}`;
  });
  return { ids, nameMap };
}

export function GameProvider({
  children,
  initialRuleSet = HOUSE_RULES,
}: {
  children: ReactNode;
  initialRuleSet?: RuleSet;
}) {
  const [ruleSet, setRuleSet] = useState<RuleSet>(() => cloneRuleSet(initialRuleSet));
  const [state, setState] = useState<import('@cambeo/engine').GameState | null>(null);
  const [viewerId, setViewerId] = useState<PlayerId>('p1');
  const [names, setNames] = useState<Record<PlayerId, string>>({});
  const [lastReject, setLastReject] = useState<string | null>(null);
  const [mode, setMode] = useState<InteractionMode>({ kind: 'flip' });
  const [lobbyNames, setLobbyNames] = useState<string[]>([]);
  const [reveals, setReveals] = useState<ActiveReveal[]>([]);

  useEffect(() => {
    const at = nextExpiryAt(reveals);
    if (at == null) return undefined;
    const wait = Math.max(0, at - Date.now());
    const t = window.setTimeout(() => setReveals((rows) => expireReveals(rows, Date.now())), wait);
    return () => window.clearTimeout(t);
  }, [reveals]);

  useEffect(() => {
    if (!state) {
      setReveals([]);
      return;
    }
    setReveals((rows) => ingestReveals(rows, state.lastEvents, Date.now()));
  }, [state]);

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
        return next;
      });
    },
    [ruleSet],
  );

  const dismissInitialPeeks = useCallback(() => {
    setReveals((rows) => dropInitialPeeks(rows, viewerId));
  }, [viewerId]);

  const applyRules = useCallback((next: RuleSet) => {
    setRuleSet(cloneRuleSet(next));
  }, []);

  const view = useMemo<RedactedGameView | null>(() => {
    if (!state) return null;
    return viewFor(state, viewerId, ruleSet);
  }, [state, viewerId, ruleSet]);

  const value: PlayStore = {
    playMode: 'hotseat',
    ruleSet,
    viewerId,
    names,
    view,
    lastReject,
    mode,
    setMode,
    dispatch,
    rematch,
    setViewerId: (id) => {
      setViewerId(id);
      setMode(deriveMode(state ? viewFor(state, id, ruleSet) : null, id));
    },
    roomCode: null,
    isHost: true,
    playersList: Object.entries(names).map(([playerId, name], i) => ({
      playerId,
      name,
      connected: true,
      isHost: i === 0,
    })),
    startGame: () => undefined,
    applyRules,
    resetLobby,
    renameSelf: null,
    kickPlayer: null,
    kicked: false,
    wsStatus: 'idle',
    lastError: null,
    reveals,
    dismissInitialPeeks,
  };

  return <PlayProvider value={value}>{children}</PlayProvider>;
}

export { useGame } from '@/lib/play-context';
export type { InteractionMode } from '@/lib/play-context';
