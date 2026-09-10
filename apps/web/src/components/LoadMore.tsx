/**
 * Pagination « Voir plus » : le serveur n'envoie jamais toute une liste. Le bouton charge la page suivante ;
 * quand il entre dans l'écran (défilement), la page suivante se charge d'elle-même (`auto`).
 */
import { useEffect, useRef } from 'react';
import { Button } from './ui';

export function LoadMore({
  hasMore,
  loading,
  onMore,
  label = 'Voir plus',
  auto = true,
}: {
  hasMore: boolean | undefined;
  loading: boolean;
  onMore: () => void;
  label?: string;
  auto?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!auto || !hasMore || loading) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onMore();
      },
      { rootMargin: '240px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [auto, hasMore, loading, onMore]);
  if (!hasMore) return null;
  return (
    <div ref={ref} className="flex justify-center py-2">
      <Button variant="g" auto sm onClick={onMore} disabled={loading}>
        {loading ? 'Chargement…' : label}
      </Button>
    </div>
  );
}
