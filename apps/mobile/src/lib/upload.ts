import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { IMAGE_MAX_DIMENSION, STORAGE_BUCKETS } from '@salondz/constants';
import { supabase } from './supabase';

type Bucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

// WebP encodé côté Android ; JPEG sur iOS (encodage WebP non garanti).
const FORMAT = Platform.OS === 'android' ? SaveFormat.WEBP : SaveFormat.JPEG;
const EXT = Platform.OS === 'android' ? 'webp' : 'jpg';
const MIME = Platform.OS === 'android' ? 'image/webp' : 'image/jpeg';

const randomId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** Redimensionne (max 1600 px) + compresse : indispensable en 4G moyenne. */
export async function compressImage(uri: string, width?: number, height?: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  const largest = Math.max(width ?? 0, height ?? 0);
  if (!largest || largest > IMAGE_MAX_DIMENSION) {
    if ((width ?? 0) >= (height ?? 0)) ctx.resize({ width: IMAGE_MAX_DIMENSION });
    else ctx.resize({ height: IMAGE_MAX_DIMENSION });
  }
  const image = await ctx.renderAsync();
  try {
    const result = await image.saveAsync({ format: FORMAT, compress: 0.8 });
    return result.uri;
  } finally {
    image.release();
  }
}

/** Upload d'un fichier local vers Supabase Storage ; renvoie l'URL publique. */
export async function uploadToStorage(bucket: Bucket, path: string, localUri: string, contentType = MIME): Promise<string> {
  const response = await fetch(localUri);
  const buffer = await response.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Échec de l'envoi de l'image : ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Ouvre la galerie, compresse et envoie une photo de salon. null si annulé. */
export async function pickAndUploadSalonPhoto(salonId: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Autorisez l'accès aux photos dans les réglages pour continuer.");
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
    exif: false,
  });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return null;
  const compressed = await compressImage(asset.uri, asset.width, asset.height);
  return uploadToStorage(STORAGE_BUCKETS.salons, `${salonId}/${randomId()}.${EXT}`, compressed);
}

/** Avatar utilisateur : bucket avatars/<userId>/… */
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Autorisez l'accès aux photos dans les réglages pour continuer.");
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return null;
  const compressed = await compressImage(asset.uri, asset.width, asset.height);
  return uploadToStorage(STORAGE_BUCKETS.avatars, `${userId}/${randomId()}.${EXT}`, compressed);
}
