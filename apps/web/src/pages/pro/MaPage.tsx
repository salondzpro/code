/**
 * MA PAGE — D'OÙ VIENNENT VOS CLIENTES (13 nov. 2026, demande du propriétaire). Ouvert en touchant la
 * carte « Ma page » de l'accueil.
 *
 * Le but, à la manière des grandes plateformes (le récapitulatif d'Uber, les rapports d'Apple) : montrer
 * au professionnel, chiffres à l'appui, ce que SALON DZ LUI RAPPORTE — clientes trouvées sur la place de
 * marché, nouvelles clientes, chiffre d'affaires — à côté de ce qu'apportent son lien, Instagram,
 * Snapchat et son code QR. C'est ce qui lui donne une raison de rester.
 *
 *   1. « Salon DZ vous a apporté » : chiffre d'affaires et nouvelles clientes venus de la place de marché.
 *   2. Le parcours : visites → réservations → taux de réservation.
 *   3. Chaque provenance, avec son logo OFFICIEL : visites, réservations, nouvelles clientes, montant.
 *
 * Données : `GET /pro/page-stats` (compteur anonyme de visites + réservations en ligne par provenance).
 * Le réseau, jamais la personne : aucune donnée personnelle n'est suivie.
 */
import { useState } from 'react';
import { Link2, QrCode, TrendingUp, UserPlus } from 'lucide-react';
import { useProPageStats, useProSalon } from '@salondz/api-client';
import { addDaysToKey, formatDA, toLocalDateKey } from '@salondz/constants';
import type { BookingOrigin } from '@salondz/types';
import { InstagramLogo, SnapchatLogo } from '@/components/BrandIcons';
import { I, Segmented, Skeleton, TopBar } from '@/components/ui';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { t } from '@/i18n';

type Periode = '7' | '30' | '90';

const CANAUX: { key: BookingOrigin; nom: string; aide: string }[] = [
  { key: 'marketplace', nom: 'Trouvé sur Salon DZ', aide: 'Recherche, carte et favoris de Salon DZ' },
  { key: 'instagram', nom: 'Instagram', aide: 'Votre bio et vos stories' },
  { key: 'link', nom: 'Votre lien', aide: 'Lien partagé : WhatsApp, SMS, Facebook…' },
  { key: 'qr', nom: 'Code QR', aide: 'Affiche et autocollant du salon' },
  { key: 'snapchat', nom: 'Snapchat', aide: 'Vos stories Snapchat' },
];

function LogoCanal({ k }: { k: BookingOrigin }) {
  if (k === 'instagram') return <InstagramLogo size={22} />;
  if (k === 'snapchat') return <SnapchatLogo size={22} />;
  if (k === 'marketplace')
    return (
      <span className="mp-sdz" aria-hidden>
        S
      </span>
    );
  return <I icon={k === 'qr' ? QrCode : Link2} size={20} />;
}

export function MaPage() {
  const salon = useProSalon().data?.salon ?? null;
  const [periode, setPeriode] = useState<Periode>('7');
  const to = toLocalDateKey();
  const from = addDaysToKey(to, -(Number(periode) - 1));
  const stats = useProPageStats(from, to, !!salon);
  const s = stats.data;
  const o = s?.origins;
  const total = o ? Object.values(o).reduce((n, x) => n + x.bookings, 0) : 0;
  const mp = o?.marketplace;
  const taux = s && s.total ? Math.round((s.bookings / s.total) * 1000) / 10 : 0;

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro" title={t('Ma page')} />
      <Segmented<Periode>
        label={t('Période')}
        value={periode}
        onChange={setPeriode}
        options={[
          { value: '7', label: t('7 jours') },
          { value: '30', label: t('30 jours') },
          { value: '90', label: t('3 mois') },
        ]}
      />

      {stats.isError && <ErrorMessage error={stats.error} retry={() => stats.refetch()} />}
      {stats.isPending && <Skeleton className="h-[12rem] w-full !rounded-[var(--radius-card)]" />}

      {s && (
        <>
          {/* 1. Ce que Salon DZ rapporte. */}
          <section className="mp-hero" aria-label={t('Salon DZ vous a apporté')}>
            <span className="mp-hero-k">
              <span className="mp-sdz" aria-hidden>
                S
              </span>
              {t('Salon DZ vous a apporté')}
            </span>
            <b className="mp-hero-v" dir="ltr">
              {formatDA(mp?.revenueDa ?? 0)}
            </b>
            <span className="mp-hero-s">
              <span>
                <I icon={UserPlus} size={16} /> {t(mp?.newClients === 1 ? '{n} nouvelle cliente' : '{n} nouvelles clientes', { n: mp?.newClients ?? 0 })}
              </span>
              <span>
                <I icon={TrendingUp} size={16} /> {t(mp?.bookings === 1 ? '{n} réservation' : '{n} réservations', { n: mp?.bookings ?? 0 })}
              </span>
            </span>
            <span className="mp-hero-n">{t('Des clientes qui ont trouvé votre salon en cherchant sur Salon DZ.')}</span>
          </section>

          {/* 2. Le parcours de la visite à la réservation. */}
          <section className="mp-flux" aria-label={t('De la visite à la réservation')}>
            <div>
              <b>{s.total}</b>
              <span>{t('visites')}</span>
            </div>
            <i aria-hidden>→</i>
            <div>
              <b>{s.bookings}</b>
              <span>{t('réservations')}</span>
            </div>
            <i aria-hidden>=</i>
            <div>
              <b>{taux} %</b>
              <span>{t('réservent')}</span>
            </div>
          </section>

          {/* 3. Chaque provenance, ce qu'elle apporte. */}
          <h2 className="h12-h">{t('D’où viennent vos clientes')}</h2>
          <div className="crd !gap-0 !py-1">
            {CANAUX.map((c) => {
              const v = o?.[c.key] ?? { bookings: 0, newClients: 0, revenueDa: 0 };
              const visites = s.bySource[c.key] ?? 0;
              const part = total ? Math.round((v.bookings / total) * 100) : 0;
              return (
                <div key={c.key} className="mp-canal">
                  <span className="mp-canal-i">
                    <LogoCanal k={c.key} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mp-canal-t">
                      <b>{t(c.nom)}</b>
                      <b dir="ltr">{formatDA(v.revenueDa)}</b>
                    </span>
                    <span className="mp-canal-s">{t(c.aide)}</span>
                    <span className="mp-barre" aria-hidden>
                      <i style={{ width: `${part}%` }} className={c.key === 'marketplace' ? 'sdz' : ''} />
                    </span>
                    <span className="mp-canal-c">
                      {t('{v} visites', { v: visites })} · {t('{n} réservations', { n: v.bookings })} · {t('{n} nouvelles', { n: v.newClients })}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mp-note">
            {t('Mesuré sans données personnelles : on sait par quel canal une cliente arrive, jamais qui elle est sur ce réseau. Montants : rendez-vous non annulés pris en ligne.')}
          </p>
        </>
      )}
    </Screen>
  );
}
