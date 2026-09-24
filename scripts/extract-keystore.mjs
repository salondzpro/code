/** Écrit la clé d'envoi Android (récupérée depuis EAS) dans secrets/android/, hors git. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const list = JSON.parse(fs.readFileSync('secrets/eas-android-keystore.json', 'utf8'));
const creds = list.find((x) => x.isDefault) ?? list[0];
const k = creds.androidKeystore;
const dir = path.join(root, 'secrets', 'android');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'upload.jks'), Buffer.from(k.keystore, 'base64'));
const props = [
  `storeFile=${path.join(dir, 'upload.jks').replace(/\\/g, '/')}`,
  `storePassword=${k.keystorePassword}`,
  `keyAlias=${k.keyAlias}`,
  `keyPassword=${k.keyPassword}`,
  '',
].join('\n');
fs.writeFileSync(path.join(dir, 'keystore.properties'), props);
console.log('clé écrite, empreinte attendue :', k.sha1CertificateFingerprint);
