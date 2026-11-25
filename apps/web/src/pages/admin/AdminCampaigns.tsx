/**
 * Administration — CAMPAGNES DE NOTIFICATIONS (25 nov. 2026, demande du propriétaire).
 *
 * Écrire une notification, choisir QUI la reçoit (filtres), OÙ mène le toucher (un chemin par
 * public : l'application cliente et l'application pro n'ont pas les mêmes écrans), et QUAND :
 * tout de suite, à une date, ou en répétition (chaque jour / semaine / mois, jamais deux fois la
 * même personne). Un essai part d'abord sur le téléphone de l'administrateur.
 * Moteur : `apps/api/src/lib/campaigns.ts`. Niveau `owner` pour envoyer ; tout est au journal.
 */
import { useEffect, useMemo, useState } from 'react';
import { BellRing, Repeat, Send, Square, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminMe, useApi, type AdminCampaign, type CampaignAudience, type CampaignRepeat } from '@salondz/api-client';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button, Field, I, Input, PageHead, Segmented, Skeleton, Textarea } from '@/components/ui';
import { t } from '@/i18n';

const AUDIENCE_DEFAUT: CampaignAudience = { role: 'all', device: 'any', plan: 'any', market: 'any', newSinceDays: null, olderThanDays: null };

/** Destinations proposées : les écrans qui existent dans CHAQUE application. */
const DEST_CLIENT = [
  { v: '', l: 'Ouvrir l’application' },
  { v: '/salons', l: 'Place de marché' },
  { v: '/rendez-vous', l: 'Mes rendez-vous' },
  { v: '/fidelite', l: 'Ma fidélité' },
  { v: '/notifications', l: 'Mes notifications' },
];
const DEST_PRO = [
  { v: '', l: 'Ouvrir l’application' },
  { v: '/pro', l: 'Accueil' },
  { v: '/pro/agenda', l: 'Agenda' },
  { v: '/pro/reservations', l: 'Demandes' },
  { v: '/pro/abonnement', l: 'Mon abonnement' },
  { v: '/pro/ma-page', l: 'Ma page' },
  { v: '/pro/promotions', l: 'Promotions' },
  { v: '/pro/profil/fidelite', l: 'Programme fidélité' },
  { v: '/pro/parametres', l: 'Paramètres' },
];

type Moment = 'now' | 'later' | 'repeat';

function Puces<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.v} type="button" className={`cp-chip${o.v === value ? ' on' : ''}`} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {t(o.l)}
        </button>
      ))}
    </div>
  );
}

function Destination({ label, value, onChange, options, prefix }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; prefix: string }) {
  const preset = options.some((o) => o.v === value);
  return (
    <Field label={label}>
      <select className="inp" value={preset ? value : '__autre'} onChange={(e) => onChange(e.target.value === '__autre' ? prefix : e.target.value)}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {t(o.l)}
          </option>
        ))}
        <option value="__autre">{t('Autre écran…')}</option>
      </select>
      {!preset && <Input className="mt-2" value={value} onChange={(e) => onChange(e.target.value)} placeholder={`${prefix}…`} autoCapitalize="none" spellCheck={false} />}
    </Field>
  );
}

/** Résumé lisible d'un public. */
function resumePublic(a: CampaignAudience): string {
  const p: string[] = [a.role === 'all' ? t('Tout le monde') : a.role === 'pro' ? t('Professionnels') : t('Clients')];
  if (a.device === 'app') p.push(t('application installée'));
  if (a.device === 'no_app') p.push(t('sans l’application'));
  if (a.device === 'push') p.push(t('notifications actives'));
  if (a.device === 'no_push') p.push(t('sans notifications'));
  if (a.plan !== 'any') p.push({ free: t('offre Gratuit'), paid: t('offres payantes'), pro: t('offre Pro'), salon: t('offre Max') }[a.plan]);
  if (a.market !== 'any') p.push(a.market === 'women' ? t('côté Femmes') : t('côté Hommes'));
  if (a.newSinceDays) p.push(t('inscrits depuis moins de {n} j', { n: a.newSinceDays }));
  if (a.olderThanDays) p.push(t('inscrits depuis plus de {n} j', { n: a.olderThanDays }));
  return p.join(' · ');
}

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Algiers' }).format(new Date(iso)) : '—';

export function AdminCampaigns() {
  const { api } = useApi();
  const qc = useQueryClient();
  const owner = useAdminMe().data?.level === 'owner';
  const liste = useQuery({ queryKey: ['admin', 'campaigns'], queryFn: () => api.admin.campaigns(), refetchInterval: 30_000 });

  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [aud, setAud] = useState<CampaignAudience>(AUDIENCE_DEFAUT);
  const [anc, setAnc] = useState<'all' | 'new' | 'old'>('all');
  const [jours, setJours] = useState('7');
  const [urlClient, setUrlClient] = useState('');
  const [urlPro, setUrlPro] = useState('');
  const [moment, setMoment] = useState<Moment>('now');
  const [quand, setQuand] = useState('');
  const [repeat, setRepeat] = useState<Exclude<CampaignRepeat, 'none'>>('daily');
  const [confirmer, setConfirmer] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const audience = useMemo<CampaignAudience>(() => {
    const n = Math.max(1, Math.min(3650, Number(jours) || 1));
    return {
      ...aud,
      plan: aud.role === 'client' ? 'any' : aud.plan,
      market: aud.role === 'pro' ? 'any' : aud.market,
      newSinceDays: anc === 'new' ? n : null,
      olderThanDays: anc === 'old' ? n : null,
    };
  }, [aud, anc, jours]);

  // Nombre de personnes visées, recalculé à chaque changement de filtre (petit délai).
  const [cle, setCle] = useState(audience);
  useEffect(() => {
    const id = window.setTimeout(() => setCle(audience), 350);
    return () => window.clearTimeout(id);
  }, [audience]);
  const apercu = useQuery({ queryKey: ['admin', 'campaigns', 'preview', cle], queryFn: () => api.admin.campaignPreview(cle) });

  const contenu = () => ({ title: titre.trim(), body: texte.trim(), urlClient: aud.role === 'pro' ? '' : urlClient.trim(), urlPro: aud.role === 'client' ? '' : urlPro.trim() });
  const invalide = titre.trim().length < 2 || texte.trim().length < 2 || (moment !== 'now' && !quand);

  const essai = useMutation({
    mutationFn: () => api.admin.testCampaign(contenu()),
    onSuccess: () => setMsg(t('Essai envoyé sur votre téléphone et dans vos notifications.')),
  });
  const envoi = useMutation({
    mutationFn: () =>
      api.admin.createCampaign({
        ...contenu(),
        audience,
        sendAt: moment === 'now' ? null : new Date(quand).toISOString(),
        repeat: moment === 'repeat' ? repeat : 'none',
      }),
    onSuccess: ({ campaign }) => {
      setConfirmer(false);
      const r = campaign.runs[0];
      setMsg(r ? t('Envoyée · {n} notifications créées', { n: r.created }) : t('Programmée pour le {d}', { d: fmt(campaign.nextAt) }));
      setTitre('');
      setTexte('');
      void qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
    },
  });
  const action = useMutation({
    mutationFn: ({ id, quoi }: { id: string; quoi: 'run' | 'cancel' }) => (quoi === 'run' ? api.admin.runCampaign(id) : api.admin.cancelCampaign(id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  });

  const reprendre = (c: AdminCampaign) => {
    setTitre(c.title);
    setTexte(c.body);
    setAud(c.audience);
    setAnc(c.audience.newSinceDays ? 'new' : c.audience.olderThanDays ? 'old' : 'all');
    setJours(String(c.audience.newSinceDays ?? c.audience.olderThanDays ?? 7));
    setUrlClient(c.urlClient ?? '');
    setUrlPro(c.urlPro ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const total = apercu.data?.total;

  return (
    <Screen gap={16} width="page">
      <PageHead title={t('Notifications')} sub={t('Écrire, choisir le public, la destination et le moment.')} />

      {owner && (
        <div className="cp-grid">
          <div className="crd !gap-4">
            <Field label={t('Titre')} htmlFor="cp-t">
              <Input id="cp-t" maxLength={65} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={t('🎁 Une surprise vous attend')} />
              <small className="cp-cpt">{titre.length}/65</small>
            </Field>
            <Field label={t('Message')} htmlFor="cp-b">
              <Textarea id="cp-b" maxLength={240} rows={3} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('Deux lignes au plus : ce qui donne envie de toucher.')} />
              <small className="cp-cpt">{texte.length}/240</small>
            </Field>

            <div className="cp-sec">
              <span className="cp-h">
                <I icon={Users} size={16} /> {t('Public')}
              </span>
              <Segmented
                label={t('Public')}
                value={aud.role}
                onChange={(role) => setAud({ ...aud, role })}
                options={[
                  { value: 'all', label: t('Tout le monde') },
                  { value: 'client', label: t('Clients') },
                  { value: 'pro', label: t('Pros') },
                ]}
              />
              <span className="cp-l">{t('Appareil')}</span>
              <Puces
                value={aud.device}
                onChange={(device) => setAud({ ...aud, device })}
                options={[
                  { v: 'any', l: 'Tous' },
                  { v: 'app', l: 'Application installée' },
                  { v: 'no_app', l: 'Sans l’application' },
                  { v: 'push', l: 'Notifications actives' },
                  { v: 'no_push', l: 'Sans notifications' },
                ]}
              />
              {aud.role !== 'client' && (
                <>
                  <span className="cp-l">{t('Abonnement des pros')}</span>
                  <Puces
                    value={aud.plan}
                    onChange={(plan) => setAud({ ...aud, plan })}
                    options={[
                      { v: 'any', l: 'Tous' },
                      { v: 'free', l: 'Gratuit' },
                      { v: 'paid', l: 'Payants' },
                      { v: 'pro', l: 'Pro' },
                      { v: 'salon', l: 'Max' },
                    ]}
                  />
                </>
              )}
              {aud.role !== 'pro' && (
                <>
                  <span className="cp-l">{t('Côté des clients')}</span>
                  <Puces
                    value={aud.market}
                    onChange={(market) => setAud({ ...aud, market })}
                    options={[
                      { v: 'any', l: 'Tous' },
                      { v: 'women', l: 'Femmes' },
                      { v: 'men', l: 'Hommes' },
                    ]}
                  />
                </>
              )}
              <span className="cp-l">{t('Ancienneté du compte')}</span>
              <Puces
                value={anc}
                onChange={setAnc}
                options={[
                  { v: 'all', l: 'Tous' },
                  { v: 'new', l: 'Inscrits depuis moins de…' },
                  { v: 'old', l: 'Inscrits depuis plus de…' },
                ]}
              />
              {anc !== 'all' && (
                <div className="flex items-center gap-2">
                  <Input className="!w-24" inputMode="numeric" value={jours} onChange={(e) => setJours(e.target.value.replace(/\D/g, ''))} />
                  <span>{t('jours')}</span>
                </div>
              )}
              <p className="cp-count">
                {apercu.isPending ? (
                  t('Calcul…')
                ) : total == null ? (
                  '—'
                ) : (
                  <>
                    <b>{t('{n} personnes', { n: total })}</b>
                    <span>
                      {t('{c} clients · {p} pros · {r} reçoivent sur un appareil', { c: apercu.data!.clients, p: apercu.data!.pros, r: apercu.data!.reachable })}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="cp-sec">
              <span className="cp-h">
                <I icon={Send} size={16} /> {t('Au toucher, ouvrir')}
              </span>
              {aud.role !== 'pro' && <Destination label={t('Dans l’application Salon DZ')} value={urlClient} onChange={setUrlClient} options={DEST_CLIENT} prefix="/" />}
              {aud.role !== 'client' && <Destination label={t('Dans l’application Salon DZ Pro')} value={urlPro} onChange={setUrlPro} options={DEST_PRO} prefix="/pro/" />}
            </div>

            <div className="cp-sec">
              <span className="cp-h">
                <I icon={Repeat} size={16} /> {t('Quand')}
              </span>
              <Segmented
                label={t('Quand')}
                value={moment}
                onChange={setMoment}
                options={[
                  { value: 'now', label: t('Maintenant') },
                  { value: 'later', label: t('Programmer') },
                  { value: 'repeat', label: t('Répéter') },
                ]}
              />
              {moment !== 'now' && (
                <Field label={moment === 'repeat' ? t('Premier envoi') : t('Date et heure (Alger)')}>
                  <Input type="datetime-local" value={quand} onChange={(e) => setQuand(e.target.value)} />
                </Field>
              )}
              {moment === 'repeat' && (
                <>
                  <Puces
                    value={repeat}
                    onChange={setRepeat}
                    options={[
                      { v: 'daily', l: 'Chaque jour' },
                      { v: 'weekly', l: 'Chaque semaine' },
                      { v: 'monthly', l: 'Chaque mois' },
                    ]}
                  />
                  <p className="cp-note">{t('Automatique : à chaque passage, seules les personnes qui ne l’ont jamais reçue. Ex. « inscrits depuis moins d’un jour », chaque matin = message de bienvenue.')}</p>
                </>
              )}
            </div>

            {(essai.isError || envoi.isError) && <ErrorMessage error={(essai.error ?? envoi.error)!} />}
            {msg && <p className="text-[1rem] font-medium">{msg}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="soft" icon={BellRing} loading={essai.isPending} disabled={invalide || essai.isPending} onClick={() => essai.mutate()}>
                {t('M’envoyer un essai')}
              </Button>
              {confirmer ? (
                <Button icon={Send} loading={envoi.isPending} disabled={envoi.isPending} onClick={() => envoi.mutate()}>
                  {moment === 'now' ? t('Confirmer · {n} personnes', { n: total ?? 0 }) : t('Confirmer la programmation')}
                </Button>
              ) : (
                <Button icon={Send} disabled={invalide || !total} onClick={() => setConfirmer(true)}>
                  {moment === 'now' ? t('Envoyer à {n} personnes', { n: total ?? 0 }) : moment === 'later' ? t('Programmer') : t('Lancer la répétition')}
                </Button>
              )}
            </div>
          </div>

          {/* Aperçu sur l'écran verrouillé d'un téléphone. */}
          <div className="cp-phone" aria-hidden>
            <div className="cp-lock">
              <span className="cp-time">9:41</span>
              <div className="cp-notif">
                <span className="cp-ico">S</span>
                <div className="min-w-0 flex-1">
                  <div className="cp-top">
                    <b>{aud.role === 'pro' ? 'Salon DZ Pro' : 'Salon DZ'}</b>
                    <span>{t('maintenant')}</span>
                  </div>
                  <p className="cp-tt">{titre || t('Titre de la notification')}</p>
                  <p className="cp-bd">{texte || t('Le message apparaît ici, sur deux lignes au plus.')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 className="h2">{t('Campagnes')}</h2>
      {liste.isError && <ErrorMessage error={liste.error} retry={() => void liste.refetch()} />}
      {liste.isPending && <Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" />}
      {liste.data && liste.data.items.length === 0 && <p className="p">{t('Aucune campagne pour le moment.')}</p>}
      {liste.data && liste.data.items.length > 0 && (
        <div className="lst">
          {liste.data.items.map((c) => {
            const dernier = c.runs[0];
            return (
              <div key={c.id} className="lst-r !items-start">
                <span className="lst-t">
                  <span className="flex flex-wrap items-center gap-2">
                    {c.title}
                    <span className={`cp-st ${c.status}`}>
                      {{ scheduled: c.repeat !== 'none' ? t('Répétée') : t('Programmée'), sending: t('En cours'), done: t('Envoyée'), cancelled: t('Arrêtée') }[c.status]}
                    </span>
                  </span>
                  <small>
                    {resumePublic(c.audience)}
                    {dernier ? ` · ${t('dernier envoi {d} : {n} notifications', { d: fmt(dernier.at), n: dernier.created })}` : ''}
                    {c.nextAt ? ` · ${t('prochain : {d}', { d: fmt(c.nextAt) })}` : ''}
                    {c.runs.length > 1 ? ` · ${t('{n} envois', { n: c.runs.length })}` : ''}
                  </small>
                </span>
                {owner && (
                  <span className="flex flex-none gap-1">
                    <button type="button" className="ad-ic" aria-label={t('Réutiliser')} title={t('Réutiliser')} onClick={() => reprendre(c)}>
                      <I icon={Repeat} size={18} />
                    </button>
                    {c.status === 'scheduled' && (
                      <>
                        <button type="button" className="ad-ic" aria-label={t('Envoyer maintenant')} title={t('Envoyer maintenant')} disabled={action.isPending} onClick={() => action.mutate({ id: c.id, quoi: 'run' })}>
                          <I icon={Send} size={18} />
                        </button>
                        <button type="button" className="ad-ic" aria-label={t('Arrêter')} title={t('Arrêter')} disabled={action.isPending} onClick={() => action.mutate({ id: c.id, quoi: 'cancel' })}>
                          <I icon={Square} size={18} />
                        </button>
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
