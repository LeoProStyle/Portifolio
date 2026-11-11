"use client";

import { useCallback, useEffect, useState } from 'react';
import PlayStage, { type MetaState, type PlayAccess, type PlayGameMeta } from '@/components/PlayStage';

export default function PlayPage({ params }: { params: { slug: string } }) {
  const [game, setGame] = useState<PlayGameMeta | null>(null);
  const [access, setAccess] = useState<PlayAccess | null>(null);
  const [metaState, setMetaState] = useState<MetaState>('loading');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    const loadGame = async () => {
      setGame(null);
      setAccess(null);
      setMetaState('loading');
      try {
        const response = await fetch(`/api/game/${encodeURIComponent(params.slug)}`);
        if (ignore) return;

        if (response.status === 404) {
          setGame(null);
          setMetaState('not-found');
          return;
        }
        if (!response.ok) {
          setGame(null);
          setMetaState('metadata-error');
          return;
        }

        const data = (await response.json()) as PlayGameMeta;
        if (ignore) return;

        // Full (NFC pass), demo or locked; the ROM URL with its ticket comes from here.
        const sessionResponse = await fetch(`/api/play/${encodeURIComponent(params.slug)}/session`, {
          method: 'POST',
          cache: 'no-store'
        });
        if (ignore) return;
        if (!sessionResponse.ok) {
          setGame(null);
          setMetaState(sessionResponse.status === 404 ? 'not-found' : 'metadata-error');
          return;
        }
        const session = (await sessionResponse.json()) as PlayAccess;
        if (ignore) return;

        setGame(data);
        setAccess(session);
        setMetaState('ok');
      } catch (error) {
        if (ignore) return;
        console.error('Unable to load game metadata', error);
        setGame(null);
        setMetaState('metadata-error');
      }
    };

    loadGame();
    return () => {
      ignore = true;
    };
  }, [params.slug, retryCount]);

  const handleRetry = useCallback(() => setRetryCount((count) => count + 1), []);

  return (
    <main>
      <PlayStage key={params.slug} slug={params.slug} game={game} metaState={metaState} access={access} onRetry={handleRetry} />
    </main>
  );
}
