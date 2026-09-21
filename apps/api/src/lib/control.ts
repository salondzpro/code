/**
 * Le jeton de contrôle : la clé qui ouvre l'espace d'un professionnel à un administrateur.
 *
 * Un administrateur qui « agit en tant que » un professionnel fait tout ce que ce professionnel
 * ferait, depuis son navigateur à lui. Le pouvoir est total, donc l'accès est étroit :
 *
 *   • LIÉ à une personne — `sub` est l'administrateur, et le serveur exige que ce soit aussi
 *     l'auteur de la requête. Un jeton volé, seul, ne vaut rien ; une session d'administrateur,
 *     seule, n'ouvre aucun salon ;
 *   • LIÉ à un salon — le jeton nomme le salon, l'appelant n'en choisit jamais un autre ;
 *   • DATÉ — deux heures, puis il meurt tout seul. Un administrateur qui oublie de sortir ne
 *     laisse pas une porte ouverte pour la semaine ;
 *   • VÉRIFIÉ À CHAQUE REQUÊTE contre `platform_admins` (voir `requireAdmin`) : retirer l'accès à un
 *     administrateur coupe aussi tous ses jetons en cours, sans rien à révoquer.
 *
 * La clé de signature est dérivée du secret serveur : une variable de configuration de moins à
 * poser (et à oublier de poser), sans rien affaiblir — qui détiendrait ce secret tiendrait déjà
 * toute la base.
 */
import { createHmac } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import { config } from '../config';
import { AppError } from './errors';

/** Durée d'un accès. Assez pour une conversation de dépannage, trop peu pour être oublié. */
export const CONTROL_TTL_SECONDS = 2 * 60 * 60;

const ISSUER = 'salondz-api';
const AUDIENCE = 'admin-control';

const key = createHmac('sha256', config.SUPABASE_SECRET_KEY).update('salondz:admin-control:v1').digest();

export async function issueControlToken(
  adminId: string,
  salonId: string,
  /** Surchargeable pour les tests (un jeton déjà expiré) ; la production garde la durée fixe. */
  ttlSeconds = CONTROL_TTL_SECONDS,
): Promise<{ token: string; expiresAt: string }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = await new SignJWT({ salon: salonId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(adminId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

/**
 * Le salon que ce jeton ouvre, pour CET administrateur. Deux refus distincts : un accès expiré
 * n'est pas un accès forgé, et l'interface doit pouvoir dire « rouvrez l'espace » plutôt que
 * « refusé ». Ce sont des 403, jamais des 401 : un 401 déconnecterait l'administrateur de sa
 * propre session, qui n'a rien à se reprocher.
 */
export async function readControlToken(token: string, adminId: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
      subject: adminId,
      algorithms: ['HS256'],
    });
    if (typeof payload.salon !== 'string') throw new Error('jeton sans salon');
    return payload.salon;
  } catch (err) {
    if (err instanceof errors.JWTExpired)
      throw new AppError(
        403,
        'CONTROL_EXPIRED',
        "Votre accès à cet espace a expiré. Rouvrez-le depuis la fiche du professionnel.",
      );
    throw new AppError(403, 'CONTROL_INVALID', "Cet accès n'est pas valable. Rouvrez l'espace depuis la fiche du professionnel.");
  }
}
