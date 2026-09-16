/** PRO-F 04 — Étape 2 : « Comment s'appelle votre salon ? » — nom public et lien de réservation (unique et définitif). */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Link2 } from 'lucide-react';
import { useApi } from '@salondz/api-client';
import { readProDraft, writeProDraft } from '@/lib/proDraft';
import { Badge, Field, I, Input } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, StepTitle, stepPath } from './Shared';
import { t } from '@/i18n';

export function Step2Name() {
  const navigate = useNavigate();
  const { api } = useApi();
  const [name, setName] = useState(readProDraft().name ?? '');
  const [check, setCheck] = useState<{ slug: string; available: boolean } | null>(null);
  const [checking, setChecking] = useState(false);
  const host = window.location.host.replace(/^www\./, '');

  useEffect(() => {
    const v = name.trim();
    if (v.length < 2) return setCheck(null);
    setChecking(true);
    const timer = setTimeout(() => {
      api.pro
        .slugCheck(v)
        .then((r) => setCheck(r))
        .catch(() => setCheck(null))
        .finally(() => setChecking(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [name, api]);

  const slug = check?.slug || (name.trim() ? '…' : 'votre-salon');
  const taken = !!check && !check.available && !checking;

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={2} backTo={stepPath(1)} />
      <StepTitle sub={t("C'est le nom que vos clients verront sur Salon DZ et sur votre page.")}>
        {t("Comment s'appelle votre salon ?")}
      </StepTitle>
      <Field label={t("Nom du salon")} htmlFor="salon-name">
        <Input id="salon-name" lg className={name ? 'f' : ''} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t("Salon Sarah")} autoFocus />
      </Field>
      <div className="crd !gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
            <I icon={Link2} size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.857rem] text-muted">{t("Votre lien de réservation")}</span>
            <span className="block truncate text-[1rem] font-semibold" dir="ltr">
              {host}/s/{slug}
            </span>
          </span>
          {check && (
            <Badge tone={taken ? 'cn' : 'ok'} md>
              {checking ? t('Vérification…') : taken ? t('Déjà pris') : t('Disponible')}
            </Badge>
          )}
        </div>
        <p className="p text-[0.857rem]">{t("Ce lien est unique et définitif. C'est lui que vous partagerez sur WhatsApp et Instagram.")}</p>
      </div>
      <StepSheet
        disabled={name.trim().length < 2 || taken}
        onClick={() => {
          writeProDraft({ name: name.trim() });
          navigate(stepPath(3));
        }}
      />
    </Screen>
  );
}
