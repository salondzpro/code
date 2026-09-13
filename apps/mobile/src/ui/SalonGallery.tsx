/**
 * Album photo de la fiche salon — jumelle du composant web
 * (apps/web/src/components/SalonGallery.tsx) : couverture, photos du salon et réalisations
 * dans un seul défilé, avec flèches et compteur.
 *
 * Les dégradés ne sont posés QUE sur les bords gauche et droit : ils détachent les flèches
 * de la photo sans assombrir le centre, là où il y a quelque chose à regarder.
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { C } from '@/theme/design';
import { I, Img, Tx } from './index';

export function SalonGallery({
  images,
  height = 190,
  children,
}: {
  images: string[];
  height?: number;
  /** Boutons posés sur la photo (retour, partage, favori). */
  children?: ReactNode;
}) {
  const [i, setI] = useState(0);
  const count = images.length;
  const go = (d: number) => setI((v) => (v + d + count) % count);
  const arrow = {
    position: 'absolute' as const,
    top: height / 2 - 18,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.35)',
  };

  return (
    <View style={{ height, backgroundColor: C.line, overflow: 'hidden' }}>
      {count > 0 && (
        <Img src={images[Math.min(i, count - 1)]} radius={0} style={{ height, width: '100%' }} />
      )}

      {count > 0 && (
        <>
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '20%' }}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.45)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            pointerEvents="none"
            style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '20%' }}
          />
        </>
      )}

      {children}

      {count > 1 && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Photo précédente"
            onPress={() => go(-1)}
            style={[arrow, { left: 8 }]}
          >
            <I icon={ChevronLeft} size={20} color="#fff" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Photo suivante"
            onPress={() => go(1)}
            style={[arrow, { right: 8 }]}
          >
            <I icon={ChevronRight} size={20} color="#fff" />
          </Pressable>
          <View
            style={{
              position: 'absolute',
              bottom: 8,
              right: 12,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.45)',
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Tx size={12} weight={600} color="#fff" lh={16}>
              {`${i + 1}/${count}`}
            </Tx>
          </View>
        </>
      )}
    </View>
  );
}
