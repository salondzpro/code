/** PRO-F 04 — Étape 2 : nom public et lien de réservation (unique et définitif). */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApi } from '@salondz/api-client';
import { readProDraft, writeProDraft } from '@/lib/proDraft';
import { Badge, Field, Input } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, stepPath } from './Shared';

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
    const t = setTimeout(() => {
      api.pro
        .slugCheck(v)
        .then((r) => setCheck(r))
        .catch(() => setCheck(null))
        .finally(() => setChecking(false));
    }, 350);
    return () => clearTimeout(t);
  }, [name, api]);

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={2} backTo={stepPath(1)} />
      <h1 className="h1">Nom de votre salon</h1>
      <Field label="Nom public" htmlFor="salon-name">
        <Input id="salon-name" lg className={name ? 'f' : ''} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Sarah Beauty Studio" autoFocus />
      </Field>
      <div>
        <span className="lbl">Votre lien de réservation</span>
        <div className="flex items-center justify-between gap-3 rounded-[16px] bg-fill px-4 py-[18px] text-[19px]">
          <span className="truncate">
            {host}/s/{check?.slug || (name.trim() ? '…' : 'votre-salon')}
          </span>
          {check && (
            <Badge tone={check.available ? 'ok' : 'cn'} md>
              {checking ? 'Vérification…' : check.available ? 'Disponible' : 'Déjà pris'}
            </Badge>
          )}
        </div>
      </div>
      <p className="p">Ce lien est unique et définitif. C'est lui que vous partagerez sur WhatsApp et Instagram.</p>
      <StepSheet
        disabled={name.trim().length < 2}
        onClick={() => {
          writeProDraft({ name: name.trim() });
          navigate(stepPath(3));
        }}
      />
    </Screen>
  );
}
