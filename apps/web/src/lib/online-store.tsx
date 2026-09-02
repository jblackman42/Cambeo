'use client';

import type { Action, PlayerId, RoomView, ServerMessage } from '@cambeo/shared';
import { repairRuleSet } from '@cambeo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PlayProvider, deriveMode, type InteractionMode, type PlayStore } from '@/lib/play-context';
import {
  getSessionPlayerId,
  getUsername,
  setSessionPlayerId,
  setUsername,
  workerWsUrl,
} from '@/lib/session';
import {
  dismissInitialPeeks as dropInitialPeeks,
  expireReveals,
  ingestReveals,
  nextExpiryAt,
  type ActiveReveal,
} from '@/lib/reveals';

export function OnlineProvider({ roomCode, children }: { roomCode: string; children: ReactNode }) {
  const code = roomCode.toUpperCase();
  const [viewerId, setViewerId] = useState<PlayerId>('');
  const [room, setRoom] = useState<RoomView | null>(null);
  const [lastReject, setLastReject] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mode, setMode] = useState<InteractionMode>({ kind: 'flip' });
  const [wsStatus, setWsStatus] = useState<PlayStore['wsStatus']>('connecting');
  const [reveals, setReveals] = useState<ActiveReveal[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    const at = nextExpiryAt(reveals);
    if (at == null) return undefined;
    const wait = Math.max(0, at - Date.now());
    const t = window.setTimeout(() => setReveals((rows) => expireReveals(rows, Date.now())), wait);
    return () => window.clearTimeout(t);
  }, [reveals]);

  const applyServer = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'welcome':
          setViewerId(msg.playerId);
          setSessionPlayerId(code, msg.playerId);
          setLastError(null);
          break;
        case 'snapshot':
        case 'room':
          if (!msg.room.game) setReveals([]);
          setRoom(msg.room);
          setLastError(null);
          if (msg.room.game) {
            setMode(deriveMode(msg.room.game, msg.room.you.playerId));
          }
          break;
        case 'state':
          setReveals((rows) => ingestReveals(rows, msg.lastEvents, Date.now()));
          setRoom((prev) =>
            prev ? { ...prev, seq: msg.seq, game: msg.view, lastEvents: msg.lastEvents } : prev,
          );
          setMode(deriveMode(msg.view, msg.view.viewerId));
          setLastReject(null);
          break;
        case 'rejected':
          setLastReject(msg.reason);
          break;
        case 'error':
          setLastError(msg.message);
          break;
        case 'pong':
          break;
      }
    },
    [code],
  );

  useEffect(() => {
    let stopped = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      if (stopped) return;
      setWsStatus('connecting');
      const ws = new WebSocket(`${workerWsUrl()}/room/${code}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setWsStatus('open');
        const name = getUsername() || 'Player';
        const playerId = getSessionPlayerId(code);
        ws.send(JSON.stringify({ type: 'join', name, playerId }));
        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 15_000);
      };

      ws.onmessage = (ev) => {
        try {
          applyServer(JSON.parse(String(ev.data)) as ServerMessage);
        } catch {
          setLastError('Bad server message');
        }
      };

      ws.onerror = () => {
        setWsStatus('error');
      };

      ws.onclose = () => {
        if (heartbeat) clearInterval(heartbeat);
        wsRef.current = null;
        if (stopped) return;
        setWsStatus('closed');
        const delay = Math.min(8_000, 500 * 2 ** retryRef.current);
        retryRef.current += 1;
        setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (heartbeat) clearInterval(heartbeat);
      wsRef.current?.close();
    };
  }, [applyServer, code]);

  const send = useCallback((payload: object) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }, []);

  const dispatch = useCallback(
    (action: Action) => {
      send({ type: 'action', action });
    },
    [send],
  );

  const dismissInitialPeeks = useCallback(() => {
    const id = viewerId || room?.you.playerId;
    if (!id) return;
    setReveals((rows) => dropInitialPeeks(rows, id));
  }, [viewerId, room?.you.playerId]);

  const names = useMemo(() => {
    const map: Record<PlayerId, string> = {};
    for (const p of room?.players ?? []) map[p.playerId] = p.name;
    return map;
  }, [room]);

  // A server on an older build can send a RuleSet missing newer fields; fill it in so the
  // lobby stays usable instead of failing validation with a bare schema error.
  const ruleSet = useMemo(() => repairRuleSet(room?.ruleSet), [room?.ruleSet]);

  const view = room?.game ?? null;
  const effectiveViewer = viewerId || room?.you.playerId || '';

  const value: PlayStore = {
    playMode: 'online',
    ruleSet,
    viewerId: effectiveViewer,
    names,
    view,
    lastReject,
    mode,
    setMode,
    dispatch,
    rematch: () => undefined,
    setViewerId: () => undefined,
    roomCode: code,
    isHost: room?.hostId === effectiveViewer,
    playersList: room?.players ?? [],
    startGame: () => send({ type: 'start' }),
    applyRules: (next) => send({ type: 'setRules', ruleSet: next }),
    resetLobby: null,
    renameSelf: (name) => {
      const trimmed = name.trim().slice(0, 20);
      if (!trimmed) return;
      setUsername(trimmed);
      // Re-sending join with our own playerId is a rename on the server side.
      send({ type: 'join', name: trimmed, playerId: getSessionPlayerId(code) ?? effectiveViewer });
    },
    wsStatus,
    lastError,
    reveals,
    dismissInitialPeeks,
  };

  return <PlayProvider value={value}>{children}</PlayProvider>;
}
