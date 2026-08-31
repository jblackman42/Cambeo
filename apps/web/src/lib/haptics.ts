export type HapticKind = 'tap' | 'success' | 'fail' | 'turn' | 'give';

const PATTERNS: Record<HapticKind, number[]> = {
  tap: [12],
  success: [15, 30, 15],
  fail: [40, 50, 80],
  turn: [20],
  give: [25],
};

export function haptic(kind: HapticKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(PATTERNS[kind]);
}
