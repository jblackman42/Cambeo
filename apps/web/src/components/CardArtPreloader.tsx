'use client';

import { useEffect } from 'react';
import { allCardArtUrls } from '@/lib/card-art';

/** Decode the full deck during lobby so a flip never waits on a first paint. */
export function CardArtPreloader() {
  useEffect(() => {
    for (const url of allCardArtUrls()) {
      const img = new Image();
      img.src = url;
      void img.decode?.().catch(() => undefined);
    }
  }, []);
  return null;
}
