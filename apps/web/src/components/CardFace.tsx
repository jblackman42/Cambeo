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
  /** The face is on its way out: its reveal has expired and it is fading back to the card back. */
  hiding?: boolean;
};

function CardArtImg({
  src,
  srcSet,
  known,
  back = false,
}: {
  src: string;
  srcSet?: string;
  known: boolean;
  back?: boolean;
}) {
  return (
    <img
      className={back ? 'card-art card-back-art' : 'card-art'}
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
  hiding = false,
}: CardProps) {
  const known = face ? true : slot ? slot.known : false;
  const key = face?.key ?? (slot && slot.known ? slot.key : null);
  const suit = face?.suit ?? (slot && slot.known ? slot.suit : null);
  const value = face?.value ?? (slot && slot.known ? slot.value : null);
  const art = known && key && suit ? cardKeyToAsset(key, suit) : undefined;

  const jokerName = key === 'HEAVEN' ? 'Heaven' : key === 'HELL' ? 'Hell' : null;

  // The back is always mounted underneath, so a face can fade off it rather than being swapped
  // out from under the player. Nothing here is a 3-D flip: the face cross-fades and settles.
  const content = (
    <>
      <CardArtImg {...cardBackAsset()} known={false} back />
      {art && (
        <span className="card-face-layer" data-hiding={hiding ? 'true' : 'false'}>
          <CardArtImg {...art} known />
          {jokerName && <span className="card-joker-name">{jokerName}</span>}
          {value !== null && (
            <span className="card-value" data-negative={value < 0 ? 'true' : 'false'}>
              {value < 0 ? formatPoints(value) : String(value)}
            </span>
          )}
        </span>
      )}
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
