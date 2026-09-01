import { flipPenaltyMessage, rankSpokenName } from '@/lib/format';
import {
  ARM_TIMEOUT_MS,
  isRaceLossReason,
  localPhaseFromView,
  powerModeFromView,
  routeCardTap,
  shouldDisarmArmed,
  type ArmedFlip,
  type CardTapResult,
  type LocalPhase,
} from '@/lib/input-routing';
import { haptic } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { useGame } from '@/lib/play-context';
import type { CardKey, PlayerId } from '@cambeo/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type TableInputValue = {
  localPhase: LocalPhase;
  armed: ArmedFlip | null;
  penalty: string | null;
  raceFade: boolean;
  shake: { ownerId: PlayerId; slotIndex: number; token: number } | null;
  onCardTap: (ownerId: PlayerId, slotIndex: number, cardId: string) => void;
  onBackgroundTap: () => void;
  disarm: () => void;
  dismissPenalty: () => void;
  lastOutbound: unknown | null;
};

const TableInputContext = createContext<TableInputValue | null>(null);

export function useTableInput(): TableInputValue {
  const ctx = useContext(TableInputContext);
  if (!ctx) throw new Error('useTableInput must be used within TableInputProvider');
  return ctx;
}

export function TableInputProvider({ children }: { children: ReactNode }) {
  const { view, viewerId, dispatch, lastReject } = useGame();
  const [armed, setArmed] = useState<ArmedFlip | null>(null);
  const [penalty, setPenalty] = useState<string | null>(null);
  const [raceFade, setRaceFade] = useState(false);
  const [shake, setShake] = useState<{ ownerId: PlayerId; slotIndex: number; token: number } | null>(
    null,
  );
  const [lastOutbound, setLastOutbound] = useState<unknown | null>(null);
  const shakeToken = useRef(0);
  const seenPenalty = useRef<string | null>(null);
  const prevTurn = useRef<string | null>(null);

  const localPhase: LocalPhase = view ? localPhaseFromView(view, viewerId) : 'blocked';
  const powerMode = view ? powerModeFromView(view, viewerId) : undefined;

  const disarm = useCallback(() => {
    setArmed(null);
  }, []);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(disarm, ARM_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [armed, disarm]);

  useEffect(() => {
    if (!view || !armed) return;
    const slot = view.players[armed.ownerId]?.hand[armed.slotIndex];
    const reason = shouldDisarmArmed(armed, {
      discardId: view.discardTop?.id ?? null,
      turnPlayerId: view.turn?.playerId ?? null,
      viewerId,
      cambeoCallerId: view.cambeoCallerId,
      cardIdAtSlot: slot?.id ?? null,
      localPhase,
    });
    if (reason) disarm();
  }, [view, armed, viewerId, localPhase, disarm]);

  useEffect(() => {
    if (!view) return;
    const fail = view.lastEvents.find((e) => e.type === 'FLIP_FAIL' && e.playerId === viewerId);
    if (fail && fail.type === 'FLIP_FAIL') {
      // FLIP_FAIL carries no identity. The face comes from the reveal that accompanies it,
      // which the engine addresses to every seat and the server times out like any other.
      const flipped = view.lastEvents.find(
        (e) =>
          e.type === 'CARD_REVEALED' &&
          e.kind === 'FLIP_FAIL' &&
          e.cardId === fail.cardId &&
          e.revealedToPlayerId === viewerId,
      );
      const flippedKey = flipped?.type === 'CARD_REVEALED' ? flipped.key : undefined;
      const id = `${fail.cardId}:${flippedKey ?? '?'}`;
      if (seenPenalty.current !== id && view.discardTop && flippedKey) {
        seenPenalty.current = id;
        setPenalty(flipPenaltyMessage(flippedKey, view.discardTop.key));
        haptic('fail');
        playSound('flip-fail');
      }
    }
    const success = view.lastEvents.find((e) => e.type === 'FLIP_SUCCESS');
    if (success && success.type === 'FLIP_SUCCESS') {
      if (success.playerId === viewerId) {
        haptic('success');
        playSound('flip-success');
      } else if (success.targetPlayerId === viewerId) {
        haptic('fail');
        playSound('flip-fail');
      }
    }
    const given = view.lastEvents.find((e) => e.type === 'CARD_GIVEN' && e.toPlayerId === viewerId);
    if (given) haptic('give');
    const cambeo = view.lastEvents.find((e) => e.type === 'CAMBEO_CALLED');
    if (cambeo) playSound('cambeo');
  }, [view, viewerId]);

  useEffect(() => {
    if (!view?.turn) return;
    if (view.turn.playerId === viewerId && prevTurn.current !== viewerId) {
      haptic('turn');
      playSound('turn');
    }
    prevTurn.current = view.turn.playerId;
  }, [view?.turn, viewerId]);

  useEffect(() => {
    if (lastReject && isRaceLossReason(lastReject)) {
      setRaceFade(true);
      disarm();
      const t = window.setTimeout(() => setRaceFade(false), 240);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [lastReject, disarm]);

  const applyResult = useCallback(
    (result: CardTapResult) => {
      switch (result.kind) {
        case 'arm':
          setArmed(result.armed);
          haptic('tap');
          playSound('slide');
          break;
        case 'commit':
          setArmed(null);
          setLastOutbound(result.action);
          dispatch(result.action);
          haptic('tap');
          break;
        case 'disarm':
          disarm();
          break;
        case 'target':
          disarm();
          setLastOutbound(result.action);
          dispatch(result.action);
          haptic('tap');
          break;
        case 'noop':
          if (result.shake) {
            shakeToken.current += 1;
            setShake({
              ownerId: armed?.ownerId ?? viewerId,
              slotIndex: armed?.slotIndex ?? -1,
              token: shakeToken.current,
            });
          }
          break;
        default:
          break;
      }
    },
    [armed, disarm, dispatch, viewerId],
  );

  const onCardTap = useCallback(
    (ownerId: PlayerId, slotIndex: number, cardId: string) => {
      if (!view) return;
      const result = routeCardTap({
        localPhase,
        viewerId,
        ownerId,
        slotIndex,
        cardId,
        cambeoCallerId: view.cambeoCallerId,
        armed,
        discardKey: view.discardTop?.key ?? null,
        discardId: view.discardTop?.id ?? null,
        powerMode,
      });
      if (result.kind === 'noop') {
        shakeToken.current += 1;
        setShake({ ownerId, slotIndex, token: shakeToken.current });
        return;
      }
      applyResult(result);
    },
    [view, localPhase, viewerId, armed, powerMode, applyResult],
  );

  const onBackgroundTap = useCallback(() => {
    if (armed) disarm();
  }, [armed, disarm]);

  const value = useMemo<TableInputValue>(
    () => ({
      localPhase,
      armed,
      penalty,
      raceFade,
      shake,
      onCardTap,
      onBackgroundTap,
      disarm,
      dismissPenalty: () => setPenalty(null),
      lastOutbound,
    }),
    [localPhase, armed, penalty, raceFade, shake, onCardTap, onBackgroundTap, disarm, lastOutbound],
  );

  return <TableInputContext.Provider value={value}>{children}</TableInputContext.Provider>;
}

export function discardRankName(viewDiscardKey: CardKey | null | undefined): string {
  return viewDiscardKey ? rankSpokenName(viewDiscardKey) : 'nothing';
}
