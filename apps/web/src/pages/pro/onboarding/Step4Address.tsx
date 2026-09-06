/**
 * PRO-F 06 — Étape 4 : « Où vous trouver ? » — adresse, ville, quartier, domicile. Crée le salon.
 * En mode `settings` (Profil → Adresse et zone) : modifie le salon existant, avec le téléphone du salon.
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { MapPin, Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { WILAYAS, categoriesForMarket, formatDZPhone, wilayaName } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { clearProDraft, draftFiles, readProDraft, writeProDraft } from '@/lib/proDraft';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { I, Toggle } from '@/components/ui';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, stepPath } from './Shared';

export function Step4Address({ settings }: { settings?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useAuth();
  const salon = useProSalon().data?.salon ?? null;
  const { createSalon, updateSalon, setPhotos } = useProSalonMutations();
  const draft = readProDraft();
  const [address, setAddress] = useState((settings ? salon?.address : draft.address) ?? '');
  const [wilaya, setWilaya] = useState((settings ? salon?.wilayaCode : draft.wilayaCode) ?? 16);
  const [zone, setZone] = useState((settings ? (salon?.zone ?? salon?.city) : draft.zone) ?? '');
  const [home, setHome] = useState((settings ? salon?.homeService : draft.homeService) ?? false);
  const [phone, setPhone] = useState(settings && salon?.phone ? formatDZPhone(salon.phone) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!settings && (!draft.market || !draft.name)) return <Navigate to={stepPath(1)} replace />;
  if (!session) return <Navigate to="/connexion?role=pro" replace />;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (zone.trim().length < 2) return setError('Indiquez votre quartier.');
    setError(null);
    setBusy(true);
    try {
      if (settings) {
        let normalizedPhone: string | undefined;
        if (phone.trim()) {
          const parsed = phoneDZ.safeParse(phone);
          if (!parsed.success) return setError('Numéro algérien invalide.');
          normalizedPhone = parsed.data;
        }
        await updateSalon.mutateAsync({ wilayaCode: wilaya, city: zone.trim(), zone: zone.trim(), address: address.trim() || undefined, homeService: home, phone: normalizedPhone });
        navigate('/pro/profil');
        return;
      }
      writeProDraft({ address: address.trim(), wilayaCode: wilaya, zone: zone.trim(), homeService: home });
      const market = draft.market!;
      const created = await createSalon.mutateAsync({
        name: draft.name!,
        wilayaCode: wilaya,
        city: zone.trim(),
        zone: zone.trim(),
        address: address.trim() || undefined,
        genderTarget: market,
        categoryIds: [categoriesForMarket(market)[0]!.id],
      });
      const files = draftFiles.get();
      const [coverUrl, logoUrl] = await Promise.all([files.cover ? uploadSalonPhoto(created.id, files.cover) : null, files.logo ? uploadSalonPhoto(created.id, files.logo) : null]);
      if (coverUrl) await setPhotos.mutateAsync([{ url: coverUrl }]);
      await updateSalon.mutateAsync({ logoUrl: logoUrl ?? undefined, homeService: home });
      clearProDraft();
      qc.invalidateQueries({ queryKey: queryKeys.pro.all });
      navigate(stepPath(5), { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={4} backTo={settings ? '/pro/profil' : stepPath(3)} right={settings ? 'Adresse' : undefined} />
      <h1 className="h1">Où vous trouver ?</h1>
      <form id="address" onSubmit={submit} className="flex flex-col gap-4">
        <label className="search !border-[1.5px] !border-ink !bg-surface">
          <I icon={Search} size={20} className="text-subtle" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue des Frères Bouadou, Hydra" aria-label="Adresse" maxLength={200} />
        </label>
        <div className="relative h-[220px] overflow-hidden rounded-[20px] border border-line bg-fill">
          <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(#e6e7e9 2px, transparent 2px), linear-gradient(90deg, #e6e7e9 2px, transparent 2px)', backgroundSize: '110px 80px' }} />
          <span className="absolute left-1/2 top-1/2 flex h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-white shadow-fab">
            <I icon={MapPin} size={26} />
          </span>
          <span className="absolute bottom-4 left-6 max-w-[80%] truncate rounded-full bg-surface px-4 py-2 text-[16px] font-semibold shadow-card">{address.trim() ? `${address.trim()}${zone ? `, ${zone}` : ''}` : zone || wilayaName(wilaya)}</span>
        </div>
        <div className="crd !gap-0 !py-1">
          <label className="li !py-4">
            <span className="text-[19px]">Ville</span>
            <select className="max-w-[55%] bg-transparent text-right text-[19px] text-muted outline-none" value={wilaya} onChange={(e) => setWilaya(Number(e.target.value))} aria-label="Ville">
              {WILAYAS.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="li !py-4">
            <span className="text-[19px]">Quartier</span>
            <input className="max-w-[55%] bg-transparent text-right text-[19px] outline-none placeholder:text-subtle" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Hydra" aria-label="Quartier" maxLength={80} />
          </label>
          {settings && (
            <label className="li !py-4">
              <span className="text-[19px]">Téléphone</span>
              <input type="tel" inputMode="tel" className="max-w-[55%] bg-transparent text-right text-[19px] outline-none placeholder:text-subtle" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05 51 23 45 67" aria-label="Téléphone du salon" />
            </label>
          )}
          <div className="li !py-4">
            <span>
              <span className="block text-[19px]">Se déplacer à domicile</span>
              <span className="p block text-[15px]">Prestations hors salon</span>
            </span>
            <Toggle on={home} onChange={setHome} label="Se déplacer à domicile" />
          </div>
        </div>
        {error && (
          <p className="text-[14px] text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
      <StepSheet label={settings ? 'Enregistrer' : 'Continuer'} onClick={() => void submit()} busy={busy} />
    </Screen>
  );
}
