'use client';

import {
  CARD_KEYS,
  HAND_SIZE_MAX,
  HAND_SIZE_MIN,
  HOUSE_RULES,
  POWER_IDS,
  RuleSetSchema,
  cloneRuleSet,
  decodeRuleSetCode,
  encodeRuleSetCode,
  isHouseRules,
  summarizeDeck,
  type CardKey,
  type PowerId,
  type RuleSet,
} from '@cambeo/shared';
import { Check, Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '@/lib/play-context';
import { Modal } from '@/components/Modal';
import { cardKeyLabel, formatPoints, powerLabel } from '@/lib/format';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { ruleSet, applyRules, lastError, isHost } = useGame();
  const [draft, setDraft] = useState<RuleSet>(() => cloneRuleSet(ruleSet));
  const lastCustom = useRef<RuleSet | null>(isHouseRules(ruleSet) ? null : cloneRuleSet(ruleSet));
  const [paste, setPaste] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const appliedCode = encodeRuleSetCode(ruleSet);
  const locked = !isHost;

  useEffect(() => {
    const applied = decodeRuleSetCode(appliedCode);
    if (applied) setDraft(cloneRuleSet(applied));
  }, [appliedCode]);

  const parsed = RuleSetSchema.safeParse(draft);
  const summary = useMemo(() => summarizeDeck(draft), [draft]);
  const dirty = encodeRuleSetCode(draft) !== appliedCode;
  const house = isHouseRules(draft);
  const canApply = !locked && dirty && parsed.success;

  const setScalar = <K extends keyof RuleSet>(key: K, value: RuleSet[K]) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'handSize' && typeof value === 'number') {
        next.initialRevealCount = Math.min(next.initialRevealCount, value);
        next.lossThreshold = Math.max(next.lossThreshold, value);
      }
      if (!isHouseRules(next)) lastCustom.current = cloneRuleSet(next);
      return next;
    });
  };

  const setCardValue = (key: CardKey, value: number) => {
    setDraft((prev) => {
      const next = { ...prev, values: { ...prev.values, [key]: value } };
      if (!isHouseRules(next)) lastCustom.current = cloneRuleSet(next);
      return next;
    });
  };

  const setCardPower = (key: CardKey, power: PowerId) => {
    setDraft((prev) => {
      const next = { ...prev, powers: { ...prev.powers, [key]: power } };
      if (!isHouseRules(next)) lastCustom.current = cloneRuleSet(next);
      return next;
    });
  };

  const applyHouse = () => {
    if (!house) lastCustom.current = cloneRuleSet(draft);
    setDraft(cloneRuleSet(HOUSE_RULES));
  };

  const applyCustom = () => {
    if (lastCustom.current) setDraft(cloneRuleSet(lastCustom.current));
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(encodeRuleSetCode(draft));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setPasteError('Could not copy — select the code after Apply, or copy from the URL');
    }
  };

  const importCode = () => {
    const decoded = decodeRuleSetCode(paste);
    if (!decoded) {
      setPasteError('Could not read that rules code');
      return;
    }
    setPasteError(null);
    setPaste('');
    if (!isHouseRules(decoded)) lastCustom.current = cloneRuleSet(decoded);
    setDraft(cloneRuleSet(decoded));
  };

  return (
    <Modal
      title={locked ? 'Rules' : 'Settings'}
      onClose={onClose}
      footer={
        locked ? (
          <p className="status-line">Only the host can change these</p>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!canApply}
            onClick={() => {
              applyRules(draft);
              onClose();
            }}
          >
            Apply
          </button>
        )
      }
    >
      {lastError && <div className="reject-toast">{lastError}</div>}
      {!parsed.success && (
        <div className="reject-toast">
          {parsed.error.issues.map((issue) => issue.message).join(' · ')}
        </div>
      )}

      <div className="btn-row seg-row">
        <button
          type="button"
          className="btn btn-ghost"
          data-active={house}
          disabled={locked}
          onClick={applyHouse}
        >
          House Rules
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          data-active={!house}
          disabled={locked || (house && !lastCustom.current)}
          onClick={applyCustom}
        >
          Custom
        </button>
      </div>

      <section className="deck-summary" aria-label="Deck summary">
        <div>
          <strong>{summary.cardCount}</strong>
          <span>cards</span>
        </div>
        <div>
          <strong>
            {formatPoints(summary.minCardValue)} to {formatPoints(summary.maxCardValue)}
          </strong>
          <span>point range</span>
        </div>
        <div>
          <strong>{summary.poweredCardCount}</strong>
          <span>with powers</span>
        </div>
        <div>
          <strong>
            {formatPoints(summary.minHand)} to {formatPoints(summary.maxHand)}
          </strong>
          <span>possible hand</span>
        </div>
      </section>

      <fieldset className="settings-section" disabled={locked}>
        <legend>Deck</legend>
        <label className="field-check">
          <input
            type="checkbox"
            checked={draft.jokers}
            onChange={(e) => setScalar('jokers', e.target.checked)}
          />
          Heaven and hell (jokers)
        </label>
      </fieldset>

      <fieldset className="settings-section" disabled={locked}>
        <legend>Game</legend>
        <label className="field">
          Starting hand size
          <input
            type="number"
            min={HAND_SIZE_MIN}
            max={HAND_SIZE_MAX}
            step={1}
            value={draft.handSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isInteger(n)) return;
              setScalar('handSize', n);
            }}
          />
        </label>
        <label className="field">
          Cards revealed at start
          <input
            type="number"
            min={0}
            max={draft.handSize}
            step={1}
            value={draft.initialRevealCount}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isInteger(n)) return;
              setScalar('initialRevealCount', n);
            }}
          />
        </label>
        <label className="field">
          Initial peek duration (ms)
          <input
            type="number"
            min={500}
            step={500}
            value={draft.initialPeekDurationMs}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isInteger(n)) return;
              setScalar('initialPeekDurationMs', n);
            }}
          />
        </label>
        <label className="field">
          Power reveal duration (ms)
          <input
            type="number"
            min={500}
            step={500}
            value={draft.powerRevealDurationMs}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isInteger(n)) return;
              setScalar('powerRevealDurationMs', n);
            }}
          />
        </label>
        <label className="field">
          Missed-flip reveal duration (ms)
          <input
            type="number"
            min={500}
            step={500}
            value={draft.flipRevealDurationMs}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isInteger(n)) return;
              setScalar('flipRevealDurationMs', n);
            }}
          />
        </label>
        <label className="field">
          Loss threshold
          <input
            type="number"
            min={draft.handSize}
            step={1}
            value={draft.lossThreshold}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isInteger(n)) return;
              setScalar('lossThreshold', n);
            }}
          />
        </label>
        <label className="field-check">
          <input
            type="checkbox"
            checked={draft.heavenDiscardableAfterCambeo}
            onChange={(e) => setScalar('heavenDiscardableAfterCambeo', e.target.checked)}
          />
          Heaven can be discarded after cambeo
        </label>
        <label className="field-check">
          <input
            type="checkbox"
            checked={draft.hellDiscardOnlyOntoHeaven}
            onChange={(e) => setScalar('hellDiscardOnlyOntoHeaven', e.target.checked)}
          />
          Hell may only be discarded onto heaven
        </label>
      </fieldset>

      <fieldset className="settings-section" disabled={locked}>
        <legend>Card values and powers</legend>
        <div className="settings-card-head">
          <span>Card</span>
          <span>Value</span>
          <span>Power</span>
        </div>
        {CARD_KEYS.map((key) => {
          const jokerOff = !draft.jokers && (key === 'HEAVEN' || key === 'HELL');
          return (
            <div className="settings-card-row" key={key} data-muted={jokerOff}>
              <span className="settings-card-label">{cardKeyLabel(key)}</span>
              <input
                type="number"
                step={1}
                aria-label={`${cardKeyLabel(key)} value`}
                value={draft.values[key] ?? 0}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setCardValue(key, n);
                }}
              />
              <select
                aria-label={`${cardKeyLabel(key)} power`}
                value={draft.powers[key] ?? 'NONE'}
                onChange={(e) => setCardPower(key, e.target.value as PowerId)}
              >
                {POWER_IDS.map((id) => (
                  <option key={id} value={id}>
                    {powerLabel(id)}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </fieldset>

      <fieldset className="settings-section">
        <legend>Rules code</legend>
        <div className="copy-field">
          <input
            className="copy-field-input"
            readOnly
            value={encodeRuleSetCode(draft)}
            aria-label="Rules code"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="icon-btn copy-field-btn"
            onClick={() => void copyCode()}
            aria-label={copied ? 'Rules code copied' : 'Copy rules code'}
            title={copied ? 'Copied' : 'Copy rules code'}
            data-copied={copied}
          >
            {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
          </button>
        </div>
        {!locked && (
          <div className="import-row">
            <input
              className="text-input"
              value={paste}
              onChange={(e) => {
                setPaste(e.target.value);
                setPasteError(null);
              }}
              placeholder="Paste a rules code"
              aria-label="Import rules code"
              onKeyDown={(e) => {
                if (e.key === 'Enter') importCode();
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!paste.trim()}
              onClick={importCode}
            >
              Import
            </button>
          </div>
        )}
        {pasteError && (
          <div className="reject-toast" style={{ marginTop: '0.65rem' }}>
            {pasteError}
          </div>
        )}
      </fieldset>
    </Modal>
  );
}
