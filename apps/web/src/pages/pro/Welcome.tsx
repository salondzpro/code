/**
 * AUTH 16 / PRO-F 01 — Bienvenue professionnel, façon Planity Pro. Dans l'ordre : retour (on vient souvent
 * du compte client), photo et promesse, LE CHOIX tout de suite (créer mon espace / me connecter — ou
 * « Ouvrir mon espace pro » si déjà connecté), puis les avantages en grandes lignes et les quatre étapes.
 */
import { useNavigate } from 'react-router';
import { BellRing, CalendarCheck, ChevronLeft, Link2, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES, writeAuthFlow } from '@/lib/authFlow';
import { useBack } from '@/lib/useBack';
import { Button, I, IconButton, LinkButton, SectionLabel } from '@/components/ui';
import { t } from '@/i18n';

const PROMISES: { icon: LucideIcon; title: string; sub: string }[] = [
  { icon: CalendarCheck, title: 'Réservations en ligne 24 h/24', sub: 'Vos clients réservent seuls, même quand le salon est fermé.' },
  { icon: Link2, title: 'Votre page et votre lien', sub: 'À partager sur WhatsApp, Instagram et en vitrine avec le QR code.' },
  { icon: BellRing, title: 'Rappels automatiques', sub: 'Moins d’oublis, moins de créneaux perdus.' },
  { icon: Users, title: 'Votre clientèle en main', sub: 'Agenda par membre, fiches clients, historique et chiffre d’affaires.' },
];

const STEPS = ['Votre salon : nom, photo, adresse', 'Vos prestations et vos prix', 'Vos horaires et vos règles', 'Publiez et partagez votre lien'];

export function ProWelcome() {
  const navigate = useNavigate();
  const back = useBack('/profil');
  const { session } = useAuth();
  const start = () => {
    writeAuthFlow({ role: 'pro', next: '/pro' });
    navigate(session ? '/pro' : '/inscription?role=pro');
  };
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative h-[15rem] flex-none overflow-hidden">
        <img src={DESIGN_IMAGES.pro.src} alt="" className="h-full w-full object-cover" />
        <div className="ovl" />
        <div className="absolute start-5 top-4">
          <IconButton lg aria-label={t("Retour")} onClick={back}>
            <I icon={ChevronLeft} />
          </IconButton>
        </div>
        <span className="absolute end-3 top-3 rounded-[var(--radius-card-sm)] bg-black/45 px-1.5 py-0.5 text-[0.857rem] text-white/80">{DESIGN_IMAGES.pro.credit}</span>
        <div className="ovl-t">
          <div className="h3 mb-2 !text-white/70">{t("Espace professionnel")}</div>
          <div className="text-[1.714rem] font-bold leading-[1.1] tracking-[-0.8px]">
            {t("Votre agenda,")}
            <br />
            {t("votre page, votre lien.")}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pb-8 pt-5">
        {/* Le choix d'abord : créer ou se connecter. Déjà connecté (compte client) : on ouvre l'espace. */}
        <div className="flex flex-col gap-3">
          <Button onClick={start}>{session ? t("Ouvrir mon espace pro") : t("Créer mon espace pro")}</Button>
          {!session && (
            <LinkButton to="/connexion?role=pro" variant="g">
              {t("J’ai déjà un compte · Se connecter")}
            </LinkButton>
          )}
          <p className="p text-center text-[0.857rem]">{t("Gratuit · Sans engagement · Votre page prête en 5 minutes")}</p>
        </div>

        <SectionLabel>{t("Pourquoi Salon DZ")}</SectionLabel>
        <ul className="flex flex-col gap-4">
          {PROMISES.map((p) => (
            <li key={p.title} className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink text-white">
                <I icon={p.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-[1rem] font-semibold">{t(p.title)}</span>
                <span className="p block text-[0.857rem]">{t(p.sub)}</span>
              </span>
            </li>
          ))}
        </ul>

        <SectionLabel>{t("Comment ça marche")}</SectionLabel>
        <ol className="crd !gap-0 !py-1">
          {STEPS.map((s, i) => (
            <li key={s} className="li">
              <span className="flex items-center gap-3.5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-fill text-[0.857rem] font-bold">{i + 1}</span>
                <span className="text-[1rem]">{t(s)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
