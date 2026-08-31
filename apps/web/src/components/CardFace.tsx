import type { PublicCardView, SlotView } from '@cambeo/shared';
import { isRedSuit, rankLabel, suitGlyph } from '@/lib/format';

type CardProps = {
  slot?: SlotView;
  face?: PublicCardView;
  onClick?: () => void;
  selectable?: boolean;
  mode?: 'flip' | 'power' | 'replace' | 'give' | 'none';
  disabled?: boolean;
  asButton?: boolean;
};

export function CardFace({
  slot,
  face,
  onClick,
  selectable = false,
  mode = 'none',
  disabled = false,
  asButton = true,
}: CardProps) {
  const known = face
    ? true
    : slot
      ? slot.known
      : false;
  const key = face?.key ?? (slot && slot.known ? slot.key : null);
  const suit = face?.suit ?? (slot && slot.known ? slot.suit : null);
  const value = face?.value ?? (slot && slot.known ? slot.value : null);
  const red = suit ? isRedSuit(suit) : false;

  const className = 'card' + (asButton && onClick ? ' card-btn' : '');
  const content = known && key && suit ? (
    <>
      <span className="card-rank">
        {rankLabel(key)}
        {suit !== 'joker' ? suitGlyph(suit) : ''}
      </span>
      <span className="card-suit" aria-hidden>
        {suitGlyph(suit)}
      </span>
      {value !== null && <span className="card-value">{value}</span>}
    </>
  ) : (
    <span className="card-back-mark" aria-hidden>
      ◆
    </span>
  );

  const dataAttrs = {
    'data-known': known ? 'true' : 'false',
    'data-red': red ? 'true' : 'false',
    'data-selectable': selectable ? 'true' : 'false',
    'data-mode': selectable ? mode : 'none',
  };

  if (asButton && onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={disabled}
        {...dataAttrs}
        aria-label={known && key ? `${rankLabel(key)} ${suit}` : 'face-down card'}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} {...dataAttrs}>
      {content}
    </div>
  );
}
