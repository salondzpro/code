/**
 * OFFRES DES PROFESSIONNELS (20 nov. 2026, demande du propriétaire) — une seule source pour le site
 * pro (`/professionnels`) et l'espace pro (`/pro/abonnement`) : trois cartes (Gratuit, Pro, Max),
 * prix de lancement Black Friday −40 % à vie avec le prix normal barré, et le choix d'une offre par
 * WhatsApp (`SUPPORT_WHATSAPP`) — le super admin pose ensuite l'offre dans `/admin/abonnements`.
 * Aussi : le tag d'offre du compte (`PlanTag`, « Free » pour Gratuit) et le bouton d'aide WhatsApp.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Check, CreditCard, Crown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@salondz/api-client';
import { PLANS, PLAN_PROMO_END, formatDA, planById, supportWhatsAppUrl, type PlanId } from '@salondz/constants';
import { WhatsAppLogo } from './BrandIcons';
import { I } from './ui';
import { t } from '@/i18n';

/** Jours restants du tarif de lancement (0 = dernier jour, null = terminé). */
function joursRestants(): number | null {
  const fin = new Date(`${PLAN_PROMO_END}T23:59:59+01:00`).getTime();
  const reste = fin - Date.now();
  if (reste < 0) return null;
  return Math.floor(reste / 86_400_000);
}

export function usePlan(enabled = true) {
  const { api } = useApi();
  return useQuery({ queryKey: ['pro', 'plan'], queryFn: () => api.pro.plan(), enabled, staleTime: 5 * 60_000 });
}

/** Tag de l'offre du compte : « Free » pour Gratuit, sinon le nom de l'offre. */
export function PlanTag({ plan, className = '' }: { plan: PlanId | undefined; className?: string }) {
  if (!plan) return null;
  return <span className={`plan-tag ${plan} ${className}`}>{plan === 'free' ? t('Free') : t(planById(plan).name)}</span>;
}

/** Bouton « Une question ? WhatsApp » — le contact direct du support pro. */
export function SupportWhatsApp({ text, label }: { text?: string; label?: string }) {
  return (
    <a className="plan-wa" href={supportWhatsAppUrl(text ?? t('Bonjour, j’ai une question sur Salon DZ Pro.'))} target="_blank" rel="noopener noreferrer">
      <WhatsAppLogo size={20} />
      {label ?? t('Une question ? Écrivez-nous sur WhatsApp')}
    </a>
  );
}

/**
 * Les trois offres. `current` = l'offre du salon (espace pro) ; sans elle (site), « Gratuit »
 * mène à l'inscription. `salonName` complète le message WhatsApp.
 */
export function PlanCards({
  current,
  salonName,
  signupTo = '/pro/acces',
  rail = false,
  onPay,
}: {
  current?: PlanId;
  /** Espace pro (26 nov. 2026) : payer en ligne (Chargily, CIB / Edahabia) au lieu de passer par WhatsApp. */
  onPay?: (plan: 'pro' | 'salon') => void;
  salonName?: string;
  signupTo?: string;
  /**
   * DÉFILANT GAUCHE ⇄ DROITE (25 nov. 2026, demande du propriétaire, espace pro) : une carte presque
   * pleine largeur, la suivante qui dépasse, arrêt net sur chaque carte, points cliquables. S'ouvre
   * sur l'offre UTILE : Pro pour un compte Gratuit, sinon l'offre actuelle.
   */
  rail?: boolean;
}) {
  const jours = joursRestants();
  const promo = jours !== null;
  const piste = useRef<HTMLDivElement | null>(null);
  const depart = Math.max(0, PLANS.findIndex((p) => p.id === (!current || current === 'free' ? 'pro' : current)));
  const [vue, setVue] = useState(depart);
  const aller = (i: number, behavior: ScrollBehavior = 'smooth') => {
    const el = piste.current;
    const carte = el?.children[i] as HTMLElement | undefined;
    if (el && carte) el.scrollTo({ left: carte.offsetLeft - el.offsetLeft - (el.clientWidth - carte.clientWidth) / 2, behavior });
  };
  useEffect(() => {
    if (rail) aller(depart, 'auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rail, depart]);
  const suivre = () => {
    const el = piste.current;
    if (!el) return;
    const milieu = el.scrollLeft + el.clientWidth / 2;
    let i = 0;
    [...el.children].forEach((c, k) => {
      const e = c as HTMLElement;
      if (Math.abs(e.offsetLeft - el.offsetLeft + e.clientWidth / 2 - milieu) < Math.abs((el.children[i] as HTMLElement).offsetLeft - el.offsetLeft + (el.children[i] as HTMLElement).clientWidth / 2 - milieu)) i = k;
    });
    setVue(i);
  };
  return (
    <div className="plan-wrap">
      {/* Bandeau « Black Friday −40 % à vie · Encore N jours » retiré (25 nov. 2026, demande du
          propriétaire) : les prix gardent leur −40 % et le prix normal barré. */}
      <div ref={piste} className={rail ? 'plan-rail' : 'plan-grid'} onScroll={rail ? suivre : undefined}>
        {PLANS.map((p) => {
          const actuel = current === p.id;
          const prix = promo ? p.promo : p.price;
          const msg = t('Bonjour, je veux l’offre {offre} à {prix} par mois{salon}.', {
            offre: t(p.name),
            prix: formatDA(prix),
            salon: salonName ? ` — ${salonName}` : '',
          });
          return (
            <article key={p.id} className={`plan-card${p.id === 'pro' ? ' top' : ''}${actuel ? ' on' : ''}`}>
              <div className="plan-hd">
                <h3>{t(p.name)}</h3>
                {p.id === 'pro' && <span className="plan-pop">{t('Recommandé')}</span>}
                {actuel && <span className="plan-cur">{t('Votre offre')}</span>}
              </div>
              <p className="plan-for">{t(p.tagline)}</p>
              <p className="plan-price">
                {p.price === 0 ? (
                  <>
                    <b dir="ltr">{formatDA(0)}</b>
                    <span>{t('/ mois')}</span>
                  </>
                ) : (
                  <>
                    <b dir="ltr">{formatDA(prix)}</b>
                    <span>{t('/ mois')}</span>
                    {promo && (
                      <>
                        <s dir="ltr">{formatDA(p.price)}</s>
                        <em>−40 %</em>
                      </>
                    )}
                  </>
                )}
              </p>
              {p.yearly > 0 && promo && <p className="plan-year">{t('ou {prix} à l’année (2 mois offerts)', { prix: formatDA(p.yearly) })}</p>}
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <I icon={Check} size={16} strokeWidth={2.4} />
                    {t(f)}
                  </li>
                ))}
              </ul>
              {onPay && p.id !== 'free' ? (
                <>
                  <button type="button" className="btn plan-btn" onClick={() => onPay(p.id as 'pro' | 'salon')}>
                    <I icon={CreditCard} size={18} />
                    {actuel ? t('Prolonger') : t('Payer {offre}', { offre: t(p.name) })}
                  </button>
                  {/* WhatsApp reste proposé, en BLANC (26 nov. 2026, demande du propriétaire). */}
                  <a className="plan-wa plan-btn" href={supportWhatsAppUrl(msg)} target="_blank" rel="noopener noreferrer">
                    <WhatsAppLogo size={18} />
                    {t('Payer sur WhatsApp')}
                  </a>
                </>
              ) : actuel ? (
                <span className="btn g plan-btn" aria-disabled>
                  {t('Offre actuelle')}
                </span>
              ) : p.id === 'free' ? (
                current ? null : (
                  <Link to={signupTo} className="btn g plan-btn">
                    {t('Commencer gratuitement')}
                  </Link>
                )
              ) : (
                <a className="plan-wa plan-btn" href={supportWhatsAppUrl(msg)} target="_blank" rel="noopener noreferrer">
                  <WhatsAppLogo size={18} />
                  {t('Choisir {offre}', { offre: t(p.name) })}
                </a>
              )}
            </article>
          );
        })}
      </div>
      {rail && (
        <div className="plan-dots" role="tablist" aria-label={t('Offres')}>
          {PLANS.map((p, i) => (
            <button key={p.id} type="button" role="tab" aria-selected={i === vue} aria-label={t(p.name)} className={i === vue ? 'on' : ''} onClick={() => aller(i)} />
          ))}
        </div>
      )}
      <p className="plan-note">
        {onPay ? t('Paiement sécurisé par carte CIB ou Edahabia. Les clientes ne paient jamais.') : t('Paiement par BaridiMob ou CCP. Les clientes ne paient jamais.')}
      </p>
    </div>
  );
}

const RANG: Record<PlanId, number> = { free: 0, pro: 1, salon: 2 };

/**
 * Encart « Disponible avec l'offre Pro / Max » en tête d'un écran dont la fonction est payante. Le
 * serveur refuse de toute façon (403 `PLAN_REQUIRED`) : l'encart dit pourquoi AVANT qu'on essaie.
 */
export function PlanLock({ need, what }: { need: 'pro' | 'salon'; what: string }) {
  const plan = usePlan().data?.plan;
  if (!plan || RANG[plan] >= RANG[need]) return null;
  const def = planById(need);
  const promo = joursRestants() !== null;
  return (
    <div className="plan-lock">
      <I icon={Crown} size={20} strokeWidth={1.9} />
      <span className="min-w-0 flex-1">
        <b>{t('{what} : disponible avec l’offre {offre}', { what, offre: t(def.name) })}</b>
        <small>{t('{prix} par mois', { prix: formatDA(promo ? def.promo : def.price) })}</small>
      </span>
      <Link to="/pro/abonnement" className="btn sm">
        {t('Voir les offres')}
      </Link>
    </div>
  );
}
