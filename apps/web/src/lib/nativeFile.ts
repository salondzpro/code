/**
 * Partager un fichier depuis l'application : une WebView n'a ni téléchargements ni partage de fichiers.
 * On écrit le fichier sur le téléphone, puis on ouvre la feuille de partage du système. `navigator.share`
 * ne convient pas ici : `lib/native.ts` le remplace par une version qui ne transmet que du texte.
 */
export async function isNativeApp(): Promise<boolean> {
  const { Capacitor } = await import('@capacitor/core');
  return Capacitor.isNativePlatform();
}

/** Rend `false` si l'application installée n'a pas encore le greffon de fichiers. */
export async function shareFileNative(blob: Blob, filename: string): Promise<boolean> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isPluginAvailable('Filesystem')) return false;
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => ko(r.error);
    r.readAsDataURL(blob);
  });
  const saved = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  await Share.share({ title: filename, files: [saved.uri] });
  return true;
}
