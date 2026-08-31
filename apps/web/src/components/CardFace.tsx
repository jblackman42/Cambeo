import type { PublicCardView, SlotView } from '@cambeo/shared';
import { cardBackAsset, cardKeyToAsset } from '@/lib/card-art';
import { rankLabel } from '@/lib/format';

type CardProps = {
  slot?: SlotView;
  face?: PublicCardView;
  onClick?: () => void;
  selectable?: boolean;
  mode?: 'flip' | 'power' | 'replace' | 'give' | 'none';
  disabled?: boolean;
  asButton?: boolean;
};

function CardArtImg({ src, srcSet, known }: { src: string; srcSet?: string; known: boolean }) {
  return (
    <img
      className="card-art"
      src={src}
      srcSet={srcSet}
      alt=""
      draggable={false}
      decoding={known ? 'sync' : 'async'}
    />
  );
}

export function CardFace({
  slot,
  face,
  onClick,
  selectable = false,
  mode = 'none',
  disabled = false,
  asButton = true,
}: CardProps) {
  const known = face ? true : slot ? slot.known : false;
  const key = face?.key ?? (slot && slot.known ? slot.key : null);
  const suit = face?.suit ?? (slot && slot.known ? slot.suit : null);
  const value = face?.value ?? (slot && slot.known ? slot.value : null);

  const className = 'card' + (asButton && onClick ? ' card-btn' : '');
  const jokerName = key === 'HEAVEN' ? 'Heaven' : key === 'HELL' ? 'Hell' : null;

  const content =
    known && key && suit ? (
      <>
        <CardArtImg {...cardKeyToAsset(key, suit)} known />
        {jokerName && <span className="card-joker-name">{jokerName}</span>}
        {value !== null && <span className="card-value">{value}</span>}
      </>
    ) : (
      <CardArtImg {...cardBackAsset()} known={false} />
    );

  const dataAttrs = {
    'data-known': known ? 'true' : 'false',
    'data-selectable': selectable ? 'true' : 'false',
    'data-mode': selectable ? mode : 'none',
    'data-key': key ?? undefined,
  };

  const ariaLabel =
    known && key
      ? (jokerName ?? `${rankLabel(key)}${suit && suit !== 'joker' ? ` of ${suit}` : ''}`)
      : 'face-down card';

  if (asButton && onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={disabled}
        {...dataAttrs}
        aria-label={ariaLabel}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} {...dataAttrs} aria-label={ariaLabel}>
      {content}
    </div>
  );
}
