const USERNAME_KEY = 'cambeo.username';

export function playerSessionKey(roomCode: string): string {
  return `cambeo.player.${roomCode.toUpperCase()}`;
}

export function getUsername(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(USERNAME_KEY) ?? '';
}

export function setUsername(name: string): void {
  window.localStorage.setItem(USERNAME_KEY, name.trim());
}

/** Per-tab identity so two tabs can be two players; refresh still reconnects. */
export function getSessionPlayerId(roomCode: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.sessionStorage.getItem(playerSessionKey(roomCode)) ?? undefined;
}

export function setSessionPlayerId(roomCode: string, playerId: string): void {
  const key = playerSessionKey(roomCode);
  window.sessionStorage.setItem(key, playerId);
  window.localStorage.setItem(key, playerId);
}

export function getRememberedPlayerId(roomCode: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage.getItem(playerSessionKey(roomCode)) ?? undefined;
}

export function workerHttpUrl(): string {
  const ws = workerWsUrl();
  return ws.replace(/^ws/i, 'http');
}

export function workerWsUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8787';
}
