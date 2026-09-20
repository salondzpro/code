/**
 * Le journal de l'administration.
 *
 * Un opérateur agit sur les données d'autrui. Savoir qui a regardé quoi, qui a suspendu qui et
 * pourquoi fait partie du contrat : c'est ce qui permet d'expliquer une décision six mois plus
 * tard, et c'est la contrepartie du pouvoir qu'on lui donne.
 *
 * Deux règles tenues ici :
 *   • l'écriture n'est JAMAIS bloquante — un journal en panne ne doit pas empêcher de travailler,
 *     il se signale dans les logs et le travail continue ;
 *   • on trace ce qui se raconte : une consultation de fiche nominative et TOUTE écriture. Une
 *     liste ou un compteur, non — un journal qui enregistre tout ne se lit plus.
 */
import type { FastifyRequest } from 'fastify';
import { db } from './supabase';

export async function trace(
  req: FastifyRequest,
  action: string,
  targetType: string | null,
  targetId: string | null,
  reason?: string | null,
): Promise<void> {
  const adminId = req.admin?.id;
  if (!adminId) return;
  const res = await db.from('admin_audit').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    reason: reason ?? null,
    ip: req.ip,
  });
  if (res.error) req.log.warn({ err: res.error }, 'admin_audit');
}
