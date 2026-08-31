'use client';

import {
  CARD_KEYS,
  isHouseRules,
  summarizeDeck,
  validateForTable,
  type RuleSet,
} from '@cambeo/shared';
import { cardKeyLabel, formatPoints, powerLabel } from '@/lib/format';

function powerSummary(ruleSet: RuleSet): string {
  const groups = new Map<string, string[]>();
  for (const key of CARD_KEYS) {
    if (!ruleSet.jokers && (key === 'HEAVEN' || key === 'HELL')) continue;
    const power = ruleSet.powers[key];
    if (!power || power === 'NONE') continue;
    const list = groups.get(power) ?? [];
    list.push(cardKeyLabel(key));
    groups.set(power, list);
  }
  if (groups.size === 0) return 'None';
  return [...groups.entries()]
    .map(([power, keys]) => `${keys.join(', ')} ${powerLabel(power)}`)
    .join(' · ');
}

export function RulesSummary({ ruleSet, playerCount }: { ruleSet: RuleSet; playerCount?: number }) {
  const summary = summarizeDeck(ruleSet);
  const table =
    playerCount !== undefined ? validateForTable(ruleSet, playerCount) : { ok: true, errors: [] };

  return (
    <>
      <h2>Rules</h2>
      <p className="prompt-hint" style={{ margin: '-0.35rem 0 0.65rem' }}>
        {isHouseRules(ruleSet) ? 'House Rules' : 'Custom'}
      </p>
      <dl className="rules-summary">
        <dt>Deck</dt>
        <dd>
          {summary.cardCount} cards · {formatPoints(summary.minCardValue)} to{' '}
          {formatPoints(summary.maxCardValue)} · {summary.poweredCardCount} with powers · hands{' '}
          {formatPoints(summary.minHand)} to {formatPoints(summary.maxHand)}
        </dd>
        <dt>Hand</dt>
        <dd>
          {ruleSet.handSize} cards, peek {ruleSet.initialRevealCount} at start
        </dd>
        <dt>Jokers</dt>
        <dd>
          {ruleSet.jokers
            ? `Heaven (${formatPoints(ruleSet.values.HEAVEN ?? 0)}) and Hell (${formatPoints(ruleSet.values.HELL ?? 0)}) on`
            : 'Off'}
        </dd>
        <dt>Loss threshold</dt>
        <dd>More than {ruleSet.lossThreshold} cards (flagged only — open question)</dd>
        <dt>Powers</dt>
        <dd>{powerSummary(ruleSet)}</dd>
        <dt>Heaven after cambeo</dt>
        <dd>{ruleSet.heavenDiscardableAfterCambeo ? 'Can be discarded' : 'Cannot be discarded'}</dd>
        <dt>Hell</dt>
        <dd>
          {ruleSet.hellDiscardOnlyOntoHeaven
            ? 'Only onto heaven'
            : 'Can be discarded like any card'}
        </dd>
        <dt>Players</dt>
        <dd>
          {ruleSet.minPlayers}–{ruleSet.maxPlayers}
        </dd>
      </dl>
      {!table.ok && (
        <div className="reject-toast" style={{ marginTop: '0.75rem' }}>
          {table.errors.join(' · ')}
        </div>
      )}
    </>
  );
}
