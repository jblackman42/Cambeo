export const PHASES = [
  'LOBBY',
  'INITIAL_PEEK',
  'TURN_DRAW',
  'TURN_CHOICE',
  'POWER_TARGETING',
  'GIVE_CARD_PENDING',
  'FINAL_ROUND',
  'SCORING',
  'OVER',
] as const;

export type Phase = (typeof PHASES)[number];
