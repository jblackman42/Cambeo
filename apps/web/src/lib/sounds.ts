const STORAGE_KEY = 'cambeo-sound-muted';

export type SoundKind = 'slide' | 'land' | 'flip-success' | 'flip-fail' | 'turn' | 'cambeo';

let audioCtx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx ??= new Ctor();
  return audioCtx;
}

export function getMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

export function setMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
}

function beep(freq: number, duration: number, type: OscillatorType, gain = 0.06, delay = 0) {
  const ctx = context();
  if (!ctx) return;
  void ctx.resume();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g);
  g.connect(ctx.destination);
  const t = ctx.currentTime + delay;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function playSound(kind: SoundKind): void {
  if (getMuted()) return;
  switch (kind) {
    case 'slide':
      beep(420, 0.08, 'triangle', 0.04);
      break;
    case 'land':
      beep(180, 0.12, 'sine', 0.05);
      break;
    case 'flip-success':
      beep(660, 0.09, 'triangle', 0.06);
      beep(880, 0.12, 'triangle', 0.05, 0.07);
      break;
    case 'flip-fail':
      beep(160, 0.18, 'sawtooth', 0.04);
      break;
    case 'turn':
      beep(520, 0.1, 'sine', 0.05);
      break;
    case 'cambeo':
      beep(392, 0.18, 'sine', 0.06);
      beep(523, 0.22, 'sine', 0.05, 0.12);
      beep(784, 0.35, 'sine', 0.05, 0.28);
      break;
    default:
      break;
  }
}
