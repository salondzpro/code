/**
 * Administration — ABONNEMENTS DES SALONS (20 nov. 2026, demande du propriétaire). Chaque salon avec
 * son offre (Free = Découverte, Pro, Salon) et son échéance ; le super admin (`owner`) change l'offre
 * après paiement (BaridiMob / CCP), avec une échéance et un motif — journal `salon_plan_set`.
 */
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminMe, useApi, type AdminPlanRow } from '@salondz/api-client';
import { PLANS, formatDA, formatDateShortDZ, type PlanId } from '@salondz/constants';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { BottomSheet, Button, Dim, Field, Input, PageHead, SearchBox, Segmented, Skeleton } from '@/components/ui';
import { PlanTag } from '@/components/Plans';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

type Filtre = 'all' | PlanId;

/** Échéance proposée : dans un mois, au format AAAA-MM-JJ. */
function dansUnMois(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function AdminPlans() {
  const { api } = useApi();
  const qc = useQueryClient();
  const owner = useAdminMe().data?.level === 'owner';
  const list = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api.admin.plans() });
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('all');
  const [edit, setEdit] = useState<AdminPlanRow | null>(null);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list.data?.items ?? []).filter(
      (x) => (filtre === 'all' || x.plan === filtre) && (!s || `${x.name} ${x.slug} ${x.city ?? ''}`.toLowerCase().includes(s)),
    );
  }, [list.data, q, filtre]);
  const compte = (p: PlanId) => (list.data?.items ?? []).filter((x) => x.plan === p).length;
  // Revenu mensuel attendu au tarif de lancement (approximation : un abonnement payé = son prix de lancement).
  const mensuel = (list.data?.items ?? []).reduce((n, x) => n + (PLANS.find((p) => p.id === x.plan)?.promo ?? 0), 0);

  return (
    <Screen gap={16} width="page">
      <PageHead title={t('Abonnements')} sub={`${compte('free')} Free · ${compte('pro')} Pro · ${compte('salon')} Salon · ${formatDA(mensuel)} ${t('/ mois')}`} />
      <SearchBox value={q} onChange={setQ} placeholder={t('Nom du salon, lien ou ville')} />
      <Segmented
        sm
        label={t('Offre')}
        value={filtre}
        onChange={setFiltre}
        options={[
          { value: 'all', label: t('Tous') },
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
          { value: 'salon', label: 'Salon' },
        ]}
      />
      {list.isError && <ErrorMessage error={list.error} retry={() => void list.refetch()} />}
      {list.isPending && <Skeleton className="h-[12rem] w-full !rounded-[var(--radius-card)]" />}
      {list.data && items.length === 0 && <p className="p">{t('Aucun salon.')}</p>}
      {items.length > 0 && (
        <div className="lst">
          {items.map((x) => (
            <button key={x.salonId} type="button" className="lst-r w-full text-start" disabled={!owner} onClick={() => setEdit(x)}>
              <span className="lst-t min-w-0 flex-1">
                {x.name}
                <small>
                  {[x.city, x.isPublished ? null : t('Non publié'), x.until ? t('jusqu’au {date}', { date: formatDateShortDZ(x.until) }) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </span>
              <PlanTag plan={x.plan} />
            </button>
          ))}
        </div>
      )}
      {edit &&
        createPortal(
          <ChangerOffre
            row={edit}
            onClose={() => setEdit(null)}
            onDone={() => {
              setEdit(null);
              void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
            }}
          />,
          document.body,
        )}
    </Screen>
  );
}

function ChangerOffre({ row, onClose, onDone }: { row: AdminPlanRow; onClose: () => void; onDone: () => void }) {
  const { api } = useApi();
  const [plan, setPlan] = useState<PlanId>(row.plan === 'free' ? 'pro' : row.plan);
  const [until, setUntil] = useState(row.until ?? dansUnMois());
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => api.admin.setPlan(row.salonId, { plan, until: plan === 'free' ? null : until || null, reason: reason.trim() }),
    onSuccess: onDone,
  });
  const ok = reason.trim().length >= 3 && (plan === 'free' || /^\d{4}-\d{2}-\d{2}$/.test(until));
  return (
    <>
      <Dim onClose={onClose} />
      <BottomSheet modal>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <b className="truncate text-[1.143rem]">{row.name}</b>
            <PlanTag plan={row.plan} />
          </div>
          <Segmented
            label={t('Offre')}
            value={plan}
            onChange={setPlan}
            options={PLANS.map((p) => ({ value: p.id, label: p.id === 'free' ? 'Free' : `${p.name} · ${formatDA(p.promo)}` }))}
          />
          {plan !== 'free' && (
            <Field label={t('Payé jusqu’au')} htmlFor="ad-plan-u">
              <Input id="ad-plan-u" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </Field>
          )}
          <Field label={t('Motif (paiement reçu, geste commercial…)')} htmlFor="ad-plan-r">
            <Input id="ad-plan-r" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Reçu CCP du 20/11, 790 DA')} />
          </Field>
          {save.isError && <ErrorMessage error={save.error} />}
          <Button icon={ICONE.publier} loading={save.isPending} disabled={!ok || save.isPending} onClick={() => save.mutate()}>
            {t('Enregistrer')}
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
