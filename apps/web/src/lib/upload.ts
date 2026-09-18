import imageCompression from 'browser-image-compression';
import { IMAGE_MAX_BYTES, IMAGE_MAX_DIMENSION, STORAGE_BUCKETS } from '@salondz/constants';
import { supabase } from './supabase';
import { isDemo } from '@/demo/session';

/** Compresse côté client (4G moyenne) : max 1600 px, ~600 Ko, WebP. */
export async function compressImage(file: File): Promise<File> {
  return imageCompression(file, {
    maxSizeMB: IMAGE_MAX_BYTES / (1024 * 1024),
    maxWidthOrHeight: IMAGE_MAX_DIMENSION,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.82,
  });
}

async function uploadTo(bucket: string, folder: string, file: File): Promise<string> {
  const compressed = await compressImage(file);
  // Démonstration : l'image vit dans ce navigateur, le temps de la session.
  if (isDemo()) return await toDataUrl(compressed);
  const path = `${folder}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Photo de salon → `salons/<salonId>/<uuid>.webp` (policy Storage : propriétaire uniquement). */
export const uploadSalonPhoto = (salonId: string, file: File) => uploadTo(STORAGE_BUCKETS.salons, salonId, file);

/** Avatar → `avatars/<userId>/<uuid>.webp`. */
export const uploadAvatar = (userId: string, file: File) => uploadTo(STORAGE_BUCKETS.avatars, userId, file);
