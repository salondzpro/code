/** Pagination « Voir plus » : le serveur n'envoie jamais toute une liste ; le bouton charge la page suivante. */
import React from 'react';
import { View } from 'react-native';
import { Button, Tx } from './index';

export function LoadMore({
  hasMore,
  loading,
  onMore,
  label = 'Voir plus',
}: {
  hasMore: boolean | undefined;
  loading: boolean;
  onMore: () => void;
  label?: string;
}) {
  if (!hasMore) return null;
  return (
    <View style={{ alignItems: 'center', paddingVertical: 6 }}>
      <Button variant="g" auto sm disabled={loading} loading={loading} onPress={onMore}>
        <Tx size={11.5} weight={600} lh={15}>
          {label}
        </Tx>
      </Button>
    </View>
  );
}
