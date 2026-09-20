/**
 * « Vous êtes suspendu, et voici pourquoi. »
 *
 * Une plateforme qui coupe sans rien dire n'est pas un partenaire : le professionnel verrait ses
 * réservations s'arrêter sans comprendre, le client verrait chaque tentative échouer. Le motif
 * écrit au moment de la décision s'affiche donc ici, tel quel, à la personne concernée.
 *
 * Le bandeau ne se ferme pas : tant que la mesure dure, elle explique ce qui se passe.
 */
import { AlertTriangle } from 'lucide-react';
import { useMe } from '@salondz/api-client';
import { I } from '@/components/ui';
import { t } from '@/i18n';

function Bandeau({ titre, motif }: { titre: string; motif: string | null }) {
  return (
    <div className="mx-4 mt-3 flex gap-2.5 rounded-[var(--radius-card)] border border-danger/30 bg-danger/8 p-3" role="status">
      <I icon={AlertTriangle} size={18} className="mt-0.5 shrink-0 text-danger" />
      <span className="min-w-0 text-[0.857rem]">
        <b className="block">{titre}</b>
        {motif && <span className="block text-muted">{motif}</span>}
        <span className="block text-muted">{t('Écrivez à support@salondz.com pour en discuter.')}</span>
      </span>
    </div>
  );
}

/** Côté professionnel : ses réservations sont gelées, ou son salon est retiré de la place de marché. */
export function SalonSuspendedNotice() {
  const salon = useMe().data?.salon ?? null;
  if (!salon?.suspendedAt) return null;
  return (
    <Bandeau
      titre={
        salon.suspensionLevel === 'hidden'
          ? t('Votre salon est retiré de la place de marché. Vos rendez-vous déjà pris tiennent.')
          : t('Vos réservations sont suspendues. Votre page reste en ligne et vos rendez-vous déjà pris tiennent.')
      }
      motif={salon.suspendedReason}
    />
  );
}

/** Côté client : il ne peut plus réserver en ligne, nulle part. */
export function AccountSuspendedNotice() {
  const profil = useMe().data?.profile ?? null;
  if (!profil?.suspendedAt) return null;
  return (
    <Bandeau
      titre={t('Votre compte ne peut plus réserver en ligne. Vos rendez-vous déjà pris tiennent.')}
      motif={profil.suspendedReason}
    />
  );
}
