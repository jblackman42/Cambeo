'use client';

import { OnlineApp } from '@/components/OnlineApp';
import { useParams } from 'next/navigation';

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = String(params.code ?? '');
  if (!code) return null;
  return <OnlineApp roomCode={code} />;
}
