/**
 * `/pro/abonnement` — MON ABONNEMENT (20 nov. 2026, demande du propriétaire) : l'offre du salon
 * (tag « Free » pour Gratuit), les trois offres avec le tarif de lancement, et le contact
 * WhatsApp. Le pro choisit sur WhatsApp ; le super admin pose l'offre après paiement.
 */
import { useProSalon } from '@salondz/api-client';
import { formatDateShortDZ, planById } from '@salondz/constants';
import { Screen } from '@/components/AppFrame';
import { TopBar } from '@/components/ui';
import { PlanCards, PlanTag, SupportWhatsApp, usePlan } from '@/components/Plans';
import { t } from '@/i18n';

export function ProPlan() {
  const salon = useProSalon().data?.salon ?? null;
  const plan = usePlan(!!salon);
  const id = plan.data?.plan;
  return (
    <Screen gap={16} width="page">
      <TopBar backTo="/pro" title={t('Mon abonnement')} />
      <div className="crd plan-now">
        <span className="min-w-0 flex-1">
          <span className="block text-[1rem] font-semibold">{id ? t(planById(id).name) : '…'}</span>
          {plan.data?.until && <span className="block text-[0.929rem] text-muted">{t('Jusqu’au {date}', { date: formatDateShortDZ(plan.data.until) })}</span>}
        </span>
        <PlanTag plan={id} />
      </div>
      <PlanCards current={id} salonName={salon?.name} />
      <SupportWhatsApp />
    </Screen>
  );
}
