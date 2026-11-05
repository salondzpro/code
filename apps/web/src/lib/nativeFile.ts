/**
 * Partager un fichier depuis l'application : une WebView n'a ni téléchargements ni partage de fichiers.
 * On écrit le fichier sur le téléphone, puis on ouvre la feuille de partage du système. `navigator.share`
 * ne convient pas ici : `lib/native.ts` le remplace par une version qui ne transmet que du texte.
 */
import { env } from './env';

export async function isNativeApp(): Promise<boolean> {
  const { Capacitor } = await import('@capacitor/core');
  return Capacitor.isNativePlatform();
}

async function writeCache(blob: Blob, filename: string): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const data = await new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => ko(r.error);
    r.readAsDataURL(blob);
  });
  const saved = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  return saved.uri;
}

/** Rend `false` si l'application installée n'a pas encore le greffon de fichiers. */
export async function shareFileNative(blob: Blob, filename: string): Promise<boolean> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isPluginAvailable('Filesystem')) return false;
  const [uri, { Share }] = await Promise.all([writeCache(blob, filename), import('@capacitor/share')]);
  await Share.share({ title: filename, files: [uri] });
  return true;
}

/**
 * Ouvre Instagram sans feuille de partage. Rend `false` si l'application installée n'a pas ce greffon,
 * si Instagram est absent ou s'il refuse : l'appelant passe alors par la feuille du téléphone.
 */
export async function openInstagramNative(blob: Blob, filename: string): Promise<boolean> {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');
  if (!Capacitor.isPluginAvailable('PartageDirect') || !Capacitor.isPluginAvailable('Filesystem')) return false;
  const direct = registerPlugin<{ instagram(o: { chemin: string; identifiantMeta?: string }): Promise<{ ouvert: boolean }> }>('PartageDirect');
  const chemin = await writeCache(blob, filename);
  const { ouvert } = await direct.instagram({ chemin, identifiantMeta: env.metaAppId });
  return ouvert;
}
