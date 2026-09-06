/** Choix d'images (galerie) et envoi vers Supabase Storage, compressées pour la 4G. */
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { STORAGE_BUCKETS } from '@salondz/constants';
import type { LocalImage } from './proDraft';
import { compressImage, uploadToStorage } from './upload';

const EXT = Platform.OS === 'android' ? 'webp' : 'jpg';
const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** Ouvre la galerie ; [] si annulé. `square` propose un recadrage carré (logo, avatar). */
export async function pickImages({ multiple = false, square = false, max = 6 }: { multiple?: boolean; square?: boolean; max?: number } = {}): Promise<LocalImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Autorisez l'accès aux photos dans les réglages pour continuer.");
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? max : 1,
    allowsEditing: square && !multiple,
    aspect: square ? [1, 1] : undefined,
    quality: 1,
    exif: false,
  });
  if (picked.canceled) return [];
  return (picked.assets ?? []).slice(0, max).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Compresse et envoie une image locale dans `salons/<salonId>/…` ; renvoie l'URL publique. */
export async function uploadSalonImage(salonId: string, img: LocalImage): Promise<string> {
  const compressed = await compressImage(img.uri, img.width, img.height);
  return uploadToStorage(STORAGE_BUCKETS.salons, `${salonId}/${randomId()}.${EXT}`, compressed);
}
