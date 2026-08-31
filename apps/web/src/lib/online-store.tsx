'use client';

import type { Action, PlayerId, RoomView, ServerMessage } from '@cambeo/shared';
import { HOUSE_RULES } from '@cambeo/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PlayProvider, deriveMode, type InteractionMode, type PlayStore } from '@/lib/play-context';
import {
  getSessionPlayerId,
  getUsername,
  setSessionPlayerId,
  workerWsUrl,
} from '@/lib/session';

export function OnlineProvider({
  roomCode,
  children,
}: {
  roomCode: string;
  children: ReactNode;
}) {
  const code = roomCode.toUpperCase();
  const [viewerId, setViewerId] = useState<PlayerId>('');
  const [room, setRoom] = useState<RoomView | null>(null);
  const [lastReject, setLastReject] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mode, setMode] = useState<InteractionMode>({ kind: 'flip' });
  const [wsStatus, setWsStatus] = useState<PlayStore['wsStatus']>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);

  const applyServer = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'welcome':
        setViewerId(msg.playerId);
        setSessionPlayerId(code, msg.playerId);
        setLastError(null);
        break;
      case 'snapshot':
      case 'room':
        setRoom(msg.room);
        if (msg.room.game) {
          setMode(deriveMode(msg.room.game, msg.room.you.playerId));
        }
        break;
      case 'state':
        setRoom((prev) =>
          prev
            ? { ...prev, seq: msg.seq, game: msg.view, lastEvents: msg.lastEvents }
            : prev,
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
  }, [code]);

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

  const names = useMemo(() => {
    const map: Record<PlayerId, string> = {};
    for (const p of room?.players ?? []) map[p.playerId] = p.name;
    return map;
  }, [room]);

  const view = room?.game ?? null;
  const effectiveViewer = viewerId || room?.you.playerId || '';

  const value: PlayStore = {
    playMode: 'online',
    ruleSet: view?.ruleSet ?? HOUSE_RULES,
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
    resetLobby: null,
    wsStatus,
    lastError,
  };

  return <PlayProvider value={value}>{children}</PlayProvider>;
}
