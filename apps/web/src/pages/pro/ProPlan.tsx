/**
 * `/pro/abonnement` — MON ABONNEMENT (20 nov. 2026, demande du propriétaire) : l'offre du salon
 * (tag « Free » pour Gratuit), les trois offres avec le tarif de lancement, et le contact WhatsApp.
 * Offres en défilant gauche ⇄ droite depuis le 25 nov. 2026 (`PlanCards rail`).
 *
 * PAIEMENT EN LIGNE (26 nov. 2026, Chargily Pay) : « Payer Pro / Max » ouvre une fenêtre (1 mois ou
 * 12 mois, prix donnés par le serveur), puis la page de paiement sécurisée de Chargily (carte CIB ou
 * Edahabia). Au retour (`?paiement=<id>`), l'écran demande l'état au serveur — qui le relit chez
 * Chargily — jusqu'à la réponse ; l'abonnement est prolongé par le serveur seulement.
 * Tant que le paiement en ligne n'est pas branché (`available` faux), les cartes gardent WhatsApp.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi, useProSalon } from '@salondz/api-client';
import { formatDA, formatDateShortDZ, planById } from '@salondz/constants';
import { Screen } from '@/components/AppFrame';
import { BottomSheet, Button, Dim, TopBar } from '@/components/ui';
import { PlanCards, PlanTag, SupportWhatsApp, usePlan } from '@/components/Plans';
import { errorText } from '@/components/ErrorMessage';
import { ICONE } from '@/lib/actionIcons';
import { isNative } from '@/lib/native';
import { openExternal } from '@/lib/openExternal';
import { t } from '@/i18n';

type Offre = 'pro' | 'salon';

export function ProPlan() {
  const { api } = useApi();
  const qc = useQueryClient();
  const salon = useProSalon().data?.salon ?? null;
  const plan = usePlan(!!salon);
  const id = plan.data?.plan;
  const prix = useQuery({ queryKey: ['pro', 'plan-prices'], queryFn: () => api.pro.planPrices(), enabled: !!salon, staleTime: 60_000 });
  const [choix, setChoix] = useState<Offre | null>(null);
  const [mois, setMois] = useState<1 | 12>(1);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Retour de la page de paiement : `?paiement=<id>` (et `&echec=1` si Chargily renvoie sur l'échec).
  const [params, setParams] = useSearchParams();
  const paiementId = params.get('paiement');
  const retourEchec = params.get('echec') === '1';
  const suivi = useQuery({
    queryKey: ['pro', 'plan-payment', paiementId],
    queryFn: () => api.pro.planPayment(paiementId!),
    enabled: !!paiementId,
    // On redemande tant que la banque n'a pas répondu (au plus une minute).
    refetchInterval: (q) => (q.state.data?.status === 'pending' && q.state.dataUpdateCount < 30 ? 2000 : false),
  });
  useEffect(() => {
    if (suivi.data?.status === 'paid') void qc.invalidateQueries({ queryKey: ['pro', 'plan'] });
  }, [suivi.data?.status, qc]);

  const payer = async () => {
    if (!choix) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api.pro.planCheckout({ plan: choix, months: mois });
      // Dans l'application : la page de la banque s'ouvre dans le navigateur du téléphone, et le retour
      // (`/pro/abonnement?paiement=…`) rouvre l'application. Sur le site : la page entière y va.
      if (isNative()) {
        await openExternal(r.checkoutUrl);
        setChoix(null);
        setParams({ paiement: r.paymentId }, { replace: true });
      } else window.location.assign(r.checkoutUrl);
    } catch (e) {
      setErreur(errorText(e));
    } finally {
      setEnvoi(false);
    }
  };

  const enLigne = prix.data?.available === true;
  const montant = choix && prix.data ? prix.data[choix][mois === 12 ? '12' : '1'] : null;
  const etat = suivi.data?.status;

  return (
    <Screen gap={16} width="page">
      <TopBar backTo="/pro" title={t('Mon abonnement')} />

      {paiementId && (
        <div className={`crd ${etat === 'paid' ? 'pay-ok' : etat && etat !== 'pending' ? 'pay-ko' : ''}`} role="status">
          <span className="text-[1rem] font-semibold">
            {etat === 'paid'
              ? t('Paiement reçu. Merci !')
              : etat && etat !== 'pending'
                ? t('Paiement non abouti. Aucun montant n’a été débité.')
                : retourEchec
                  ? t('Paiement interrompu.')
                  : t('Vérification du paiement…')}
          </span>
          {etat === 'paid' && suivi.data?.until && (
            <span className="text-[0.929rem] text-muted">
              {t('{offre} jusqu’au {date}', { offre: t(planById(suivi.data.plan as Offre).name), date: formatDateShortDZ(suivi.data.until) })}
            </span>
          )}
        </div>
      )}

      <div className="crd plan-now">
        <span className="min-w-0 flex-1">
          <span className="plan-now-l">{t('Votre offre')}</span>
          <span className="plan-now-n">{id ? t(planById(id).name) : '…'}</span>
          {plan.data?.until && <span className="block text-[0.929rem] text-muted">{t('Jusqu’au {date}', { date: formatDateShortDZ(plan.data.until) })}</span>}
        </span>
        <PlanTag plan={id} />
      </div>
      <PlanCards
        current={id}
        salonName={salon?.name}
        rail
        onPay={
          enLigne
            ? (o) => {
                setErreur(null);
                setMois(1);
                setChoix(o);
              }
            : undefined
        }
      />
      <SupportWhatsApp />

      {choix && prix.data && (
        <>
          <Dim onClose={() => !envoi && setChoix(null)} />
          <BottomSheet modal>
            <h2 className="text-[1.25rem] font-semibold">{t('Payer {offre}', { offre: t(planById(choix).name) })}</h2>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('Durée')}>
              {([1, 12] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mois === m}
                  className={`li w-full rounded-[var(--radius-btn)] border text-start ${mois === m ? 'border-ink' : 'border-line'}`}
                  onClick={() => setMois(m)}
                >
                  <span className="min-w-0">
                    <span className="block text-[1rem] font-semibold">{m === 12 ? t('12 mois') : t('1 mois')}</span>
                    {m === 12 && <span className="block text-[0.857rem] text-muted">{t('2 mois offerts')}</span>}
                  </span>
                  <b dir="ltr">{formatDA(prix.data[choix][m === 12 ? '12' : '1'])}</b>
                </button>
              ))}
            </div>
            {erreur && (
              <p className="text-[0.938rem] text-danger" role="alert">
                {erreur}
              </p>
            )}
            <Button icon={ICONE.payer} loading={envoi} onClick={() => void payer()}>
              {montant != null ? t('Payer {prix}', { prix: formatDA(montant) }) : t('Payer')}
            </Button>
            <p className="text-center text-[0.857rem] text-muted">{t('Carte CIB ou Edahabia · page sécurisée Chargily')}</p>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
