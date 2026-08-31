'use client';

import type { GameEvent } from '@cambeo/shared';
import { useGame } from '@/lib/play-context';

function describe(event: GameEvent, names: Record<string, string>, discardKey?: string): string {
  const n = (id: string) => names[id] ?? id;
  switch (event.type) {
    case 'ACTION_REJECTED':
      return `Rejected: ${event.reason}`;
    case 'GAME_STARTED':
      return 'Game started';
    case 'TURN_STARTED':
      return `${n(event.playerId)}'s turn`;
    case 'TURN_PASSED':
      return `${n(event.playerId)} passed`;
    case 'CARD_DRAWN':
      return `${n(event.playerId)} drew from ${event.from.toLowerCase()}`;
    case 'CARD_DISCARDED':
      return `${n(event.playerId)} discarded${event.triggeredPower ? ` (${event.triggeredPower})` : ''}`;
    case 'CARD_REPLACED':
      return `${n(event.playerId)} replaced a card`;
    case 'CARD_KEPT':
      return `${n(event.playerId)} kept the drawn card`;
    case 'POWER_STARTED':
      return `${n(event.playerId)} power: ${event.powerId}`;
    case 'POWER_REVEAL':
      return `${n(event.playerId)} peeked a card`;
    case 'POWER_SWAP':
      return `${n(event.playerId)} swapped two cards`;
    case 'POWER_SHUFFLE':
      return `${n(event.playerId)} shuffled ${n(event.targetPlayerId)}`;
    case 'POWER_COMPLETED':
      return `Power done`;
    case 'POWER_STEP_SKIPPED':
      return `${n(event.playerId)} skipped a power step — ${event.reason.toLowerCase()}`;
    case 'FLIP_SUCCESS':
      return `${n(event.playerId)} flipped ${event.key} on ${n(event.targetPlayerId)}`;
    case 'FLIP_FAIL': {
      return discardKey
        ? `${n(event.playerId)} missed a flip — ${event.key} onto ${discardKey}. Penalty card.`
        : `${n(event.playerId)} missed a flip`;
    }
    case 'PENALTY_DRAWN':
      return `${n(event.playerId)} drew a penalty`;
    case 'GIVE_REQUIRED':
      return `${n(event.flipperId)} must give a card to ${n(event.targetId)}`;
    case 'CARD_GIVEN':
      return `${n(event.fromPlayerId)} gave a card to ${n(event.toPlayerId)}`;
    case 'CAMBEO_CALLED':
      return `${n(event.playerId)} called Cambeo!`;
    case 'GAME_OVER':
      return `Game over — winner: ${event.winnerIds.map(n).join(', ')}`;
    case 'DECK_RESHUFFLED':
      return 'Discard reshuffled into deck';
    case 'LOSS_THRESHOLD_EXCEEDED':
      return `${n(event.playerId)} went over the loss threshold`;
    case 'PEEK_ACKED':
      return `${n(event.playerId)} ready`;
    default:
      return event.type.replace(/_/g, ' ').toLowerCase();
  }
}

export function EventLog() {
  const { view, names } = useGame();
  if (!view) return null;

  const events = view.lastEvents.filter((e) => e.type !== 'PHASE_CHANGED');

  return (
    <div className="panel">
      <h2>Last action</h2>
      <div className="event-log">
        <ul>
          {events.length === 0 ? (
            <li>Waiting…</li>
          ) : (
            events.map((e, i) => (
              <li key={`${e.type}-${i}`}>{describe(e, names, view.discardTop?.key)}</li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
