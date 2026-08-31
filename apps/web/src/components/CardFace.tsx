import type { PublicCardView, SlotView } from '@cambeo/shared';
import { cardBackAsset, cardKeyToAsset } from '@/lib/card-art';
import { formatPoints, rankLabel } from '@/lib/format';

type CardProps = {
  slot?: SlotView;
  face?: PublicCardView;
  onClick?: () => void;
  selectable?: boolean;
  armed?: boolean;
  dimmed?: boolean;
  legalTarget?: boolean;
  locked?: boolean;
  shaking?: boolean;
  raceFade?: boolean;
  matchRank?: string | null;
  ambient?: 'heaven' | 'hell' | null;
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
  armed = false,
  dimmed = false,
  legalTarget = false,
  locked = false,
  shaking = false,
  raceFade = false,
  matchRank = null,
  ambient = null,
  disabled = false,
  asButton = true,
}: CardProps) {
  const known = face ? true : slot ? slot.known : false;
  const key = face?.key ?? (slot && slot.known ? slot.key : null);
  const suit = face?.suit ?? (slot && slot.known ? slot.suit : null);
  const value = face?.value ?? (slot && slot.known ? slot.value : null);

  const jokerName = key === 'HEAVEN' ? 'Heaven' : key === 'HELL' ? 'Hell' : null;

  const content =
    known && key && suit ? (
      <>
        <CardArtImg {...cardKeyToAsset(key, suit)} known />
        {jokerName && <span className="card-joker-name">{jokerName}</span>}
        {value !== null && (
          <span className="card-value" data-negative={value < 0 ? 'true' : 'false'}>
            {value < 0 ? formatPoints(value) : String(value)}
          </span>
        )}
        {armed && matchRank && <span className="card-match-rank">{matchRank}</span>}
      </>
    ) : (
      <>
        <CardArtImg {...cardBackAsset()} known={false} />
        {armed && matchRank && <span className="card-match-rank">{matchRank}</span>}
      </>
    );

  const dataAttrs = {
    'data-known': known ? 'true' : 'false',
    'data-selectable': selectable ? 'true' : 'false',
    'data-armed': armed ? 'true' : 'false',
    'data-dimmed': dimmed ? 'true' : 'false',
    'data-legal': legalTarget ? 'true' : 'false',
    'data-locked': locked ? 'true' : 'false',
    'data-shaking': shaking ? 'true' : 'false',
    'data-race-fade': raceFade ? 'true' : 'false',
    'data-key': key ?? undefined,
    'data-ambient': ambient ?? undefined,
  };

  const ariaLabel =
    known && key
      ? (jokerName ?? `${rankLabel(key)}${suit && suit !== 'joker' ? ` of ${suit}` : ''}`)
      : 'face-down card';

  const inner = (
    <span className="card" {...dataAttrs}>
      {content}
    </span>
  );

  if (asButton && onClick) {
    return (
      <button
        type="button"
        className="card-hit"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        disabled={disabled}
        aria-label={armed && matchRank ? `${ariaLabel}, armed against ${matchRank}` : ariaLabel}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className="card" {...dataAttrs} aria-label={ariaLabel}>
      {content}
    </div>
  );
}
