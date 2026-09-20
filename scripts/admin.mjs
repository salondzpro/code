/**
 * Donner, retirer et lister les accès à l'espace d'administration.
 *
 * Aucun administrateur n'est créé par une migration : un accès se donne à la main, en connaissance
 * de cause, et la ligne garde QUI l'a donné. C'est la même exigence que le journal des actions —
 * un pouvoir sur les données d'autrui doit toujours pouvoir s'expliquer.
 *
 *   node --env-file=.env scripts/admin.mjs list
 *   node --env-file=.env scripts/admin.mjs grant <email> [support|owner]
 *   node --env-file=.env scripts/admin.mjs revoke <email>
 *
 * Le compte doit déjà exister (s'être inscrit une fois sur salondz.com).
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!URL || !KEY) {
  console.error('SUPABASE_URL et SUPABASE_SECRET_KEY sont requis (node --env-file=.env …).');
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false } });

const [action, email, niveau = 'support'] = process.argv.slice(2);

/** Retrouve un compte par son adresse : c'est ce qu'on connaît d'une personne, pas son identifiant. */
async function parEmail(mail) {
  const { data, error } = await db.rpc('auth_user_by_email', { p_email: mail.trim().toLowerCase() });
  if (error) throw error;
  const id = Array.isArray(data) ? data[0]?.id : data?.id;
  if (!id) {
    console.error(`Aucun compte pour « ${mail} ». La personne doit s'être inscrite une fois sur salondz.com.`);
    process.exit(1);
  }
  return id;
}

async function liste() {
  const { data, error } = await db
    .from('platform_admins')
    .select('user_id, level, created_at, disabled_at, profiles!platform_admins_user_id_fkey(full_name, phone)')
    .order('created_at');
  if (error) throw error;
  if (!data.length) return console.log('Aucun administrateur.');
  for (const a of data) {
    const nom = a.profiles?.full_name ?? '(sans nom)';
    const etat = a.disabled_at ? `retiré le ${a.disabled_at.slice(0, 10)}` : 'actif';
    console.log(`${a.level.padEnd(7)} ${nom.padEnd(24)} ${etat}   ${a.user_id}`);
  }
}

if (action === 'list') {
  await liste();
} else if (action === 'grant') {
  if (!email) {
    console.error('Usage : grant <email> [support|owner]');
    process.exit(1);
  }
  if (!['support', 'owner'].includes(niveau)) {
    console.error('Niveau attendu : support ou owner.');
    process.exit(1);
  }
  const id = await parEmail(email);
  const { error } = await db
    .from('platform_admins')
    .upsert({ user_id: id, level: niveau, disabled_at: null }, { onConflict: 'user_id' });
  if (error) throw error;
  console.log(`✔ ${email} est administrateur (${niveau}).`);
  await liste();
} else if (action === 'revoke') {
  if (!email) {
    console.error('Usage : revoke <email>');
    process.exit(1);
  }
  const id = await parEmail(email);
  // On DÉSACTIVE, on ne supprime pas : la ligne explique le journal laissé derrière.
  const { error } = await db
    .from('platform_admins')
    .update({ disabled_at: new Date().toISOString() })
    .eq('user_id', id);
  if (error) throw error;
  console.log(`✔ Accès retiré à ${email}.`);
  await liste();
} else {
  console.log('Usage : list | grant <email> [support|owner] | revoke <email>');
  process.exit(1);
}
