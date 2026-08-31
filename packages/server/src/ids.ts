const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomRoomCode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
  }
  return out;
}

export function makeRoomCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return randomRoomCode(bytes);
}

export function newPlayerId(): string {
  return `p_${crypto.randomUUID()}`;
}

export function newSeed(): string {
  return crypto.randomUUID();
}

export function newConnId(): string {
  return crypto.randomUUID();
}
