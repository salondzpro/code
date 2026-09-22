/**
 * AUTH 16 / PRO-F 01 — Bienvenue professionnel, façon Planity Pro. Dans l'ordre : retour (on vient souvent
 * du compte client), photo et promesse, LE CHOIX tout de suite (créer mon espace / me connecter / voir une
 * démonstration — ou « Ouvrir mon espace pro » si déjà connecté), puis les avantages et les quatre étapes.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BellRing, CalendarCheck, ChevronLeft, Link2, PlayCircle, Users, type LucideIcon } from 'lucide-react';
import { DEMO_ACCOUNTS, demoAccountFor } from '@salondz/constants';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES, writeAuthFlow } from '@/lib/authFlow';
import { useBack } from '@/lib/useBack';
import { describeAuthError } from '@/lib/auth';
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
  const { session, demoLogin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = () => {
    writeAuthFlow({ role: 'pro', next: '/pro' });
    navigate(session ? '/pro' : '/inscription?role=pro');
  };
  /** Deux salons de démonstration prêts à l'emploi (Hommes / Femmes) : un geste, aucune saisie. */
  const demo = async (identifier: string) => {
    const acct = demoAccountFor(identifier);
    if (!acct) return;
    setError(null);
    setBusy(true);
    try {
      writeAuthFlow({ role: 'pro', next: '/pro', identifier: acct.email, channel: 'email' });
      await demoLogin(acct.email);
      navigate('/connexion/retour?next=%2Fpro', { replace: true });
    } catch (err) {
      setError(describeAuthError(err).text);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rd flex min-h-dvh flex-col">
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
        {/* Le choix d'abord : créer, se connecter, ou essayer sans engagement. Déjà connecté (compte
            client) : on ouvre l'espace, la démonstration n'a alors plus lieu d'être proposée. */}
        <div className="flex flex-col gap-3">
          <Button onClick={start}>{session ? t("Ouvrir mon espace pro") : t("Créer mon espace pro")}</Button>
          {!session && (
            <LinkButton to="/connexion?role=pro" variant="g">
              {t("J’ai déjà un compte · Se connecter")}
            </LinkButton>
          )}
          <p className="p text-center text-[0.857rem]">{t("Gratuit · Sans engagement · Votre page prête en 5 minutes")}</p>
        </div>

        {!session && (
          <div className="crd !gap-2">
            <p className="flex items-center gap-2 text-[0.857rem] font-semibold uppercase tracking-[0.08em] text-muted">
              <I icon={PlayCircle} size={16} /> {t("Démonstration")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.filter((a) => a.role === 'pro').map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className="flex flex-col items-start gap-0.5 rounded-[var(--radius-card-sm)] border border-line bg-fill px-3 py-2.5 text-start disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void demo(a.email)}
                >
                  <span className="text-[1rem] font-semibold">{t(a.label)}</span>
                  <span className="text-[0.857rem] text-muted">{t(a.hint)}</span>
                </button>
              ))}
            </div>
            <p className="text-[0.857rem] text-muted">
              {t("Tout se passe dans ce navigateur : rien n'est envoyé, chaque appareil a sa propre démonstration.")}
            </p>
            {error && (
              <p className="text-[0.857rem] text-danger" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

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
