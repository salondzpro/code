/**
 * PRO-F 06 — Étape 4 : « Où vous trouver ? » — adresse (recherche OpenStreetMap avec suggestions),
 * position sur une vraie carte (épingle au centre, « Ma position » GPS), ville, quartier, domicile.
 * Crée le salon. En mode `settings` (Profil → Adresse et localisation) : modifie le salon existant,
 * avec le téléphone du salon.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { MapPin, Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { WILAYAS, categoriesForMarket, formatDZPhone, type CategoryId, type GeoPlace } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { clearProDraft, draftFiles, readProDraft, writeProDraft } from '@/lib/proDraft';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { I, Toggle } from '@/components/ui';
import { PickerField } from '@/components/Picker';
import { PlacePicker, type LatLng } from '@/components/PlacePicker';
import { PlaceSuggestions } from '@/components/PlaceSuggestions';
import { useDebounced } from '@/lib/useDebounced';
import { prechargerLieux, useLieux, type Lieu } from '@/lib/places';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, StepTitle, stepPath } from './Shared';
import { t } from '@/i18n';

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** « Hydra, Alger » → wilaya dont le nom figure dans le libellé, sinon null. */
const wilayaFromLabel = (label: string): number | null => {
  const n = normalize(label);
  return WILAYAS.find((w) => n.includes(normalize(w.name)))?.code ?? null;
};

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
  const initial = settings ? salon : draft;
  const [pos, setPos] = useState<LatLng | null>(initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Suggestions : les mêmes qu'ailleurs dans le produit (`lib/places.ts`) — wilayas et communes
   * d'Algérie en mémoire, dès la première lettre, puis les adresses fines d'OpenStreetMap. Ce champ
   * n'interrogeait que le géocodeur, donc ne proposait rien tant qu'on n'avait pas tapé trois
   * lettres, et rien du tout quand le réseau faisait défaut.
   */
  const saisie = useDebounced(searching ? address.trim() : '', 250);
  const lieux = useLieux(saisie);

  if (!settings && (!draft.market || !draft.name)) return <Navigate to={stepPath(1)} replace />;
  if (!session) return <Navigate to="/connexion?role=pro" replace />;

  /** Une suggestion partagée (wilaya, commune ou adresse) se ramène à la forme locale. */
  const pickLieu = (l: Lieu) => {
    if (l.kind === 'wilaya') {
      setWilaya(l.wilaya);
      setSearching(false);
      return;
    }
    pick({ label: l.label, detail: l.detail, lat: l.lat, lng: l.lng });
  };

  const pick = (p: GeoPlace) => {
    setAddress(p.label);
    setPos({ lat: p.lat, lng: p.lng });
    setSearching(false);
    const w = wilayaFromLabel(`${p.label} ${p.detail}`);
    if (w) setWilaya(w);
    if (!zone.trim()) setZone(p.detail.split(',')[0]?.trim() ?? '');
  };
  // Position venue de la carte (glissement ou GPS) : on complète quartier et wilaya s'ils manquent.
  // La ville suit la position : wilaya reconnue dans le libellé ou la région ; quartier complété s'il manque.
  const onMap = (p: LatLng, place: { label: string; region: string | null; inDZ: boolean } | null) => {
    setPos(p);
    if (!place) return;
    const w = wilayaFromLabel(`${place.label} ${place.region ?? ''}`);
    if (w) setWilaya(w);
    if (!zone.trim() && place.inDZ) setZone(place.label.split(',')[0]?.trim() ?? '');
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (zone.trim().length < 2) return setError(t("Indiquez votre quartier."));
    setError(null);
    setBusy(true);
    const coords = pos ? { lat: pos.lat, lng: pos.lng } : {};
    try {
      if (settings) {
        let normalizedPhone: string | undefined;
        if (phone.trim()) {
          const parsed = phoneDZ.safeParse(phone);
          if (!parsed.success) return setError(t("Numéro algérien invalide."));
          normalizedPhone = parsed.data;
        }
        await updateSalon.mutateAsync({ wilayaCode: wilaya, city: zone.trim(), zone: zone.trim(), address: address.trim() || undefined, homeService: home, phone: normalizedPhone, ...coords });
        navigate('/pro/mon-salon');
        return;
      }
      writeProDraft({ address: address.trim(), wilayaCode: wilaya, zone: zone.trim(), homeService: home, lat: pos?.lat ?? null, lng: pos?.lng ?? null });
      const market = draft.market!;
      const created = await createSalon.mutateAsync({
        name: draft.name!,
        wilayaCode: wilaya,
        city: zone.trim(),
        zone: zone.trim(),
        address: address.trim() || undefined,
        genderTarget: market,
        // Spécialités choisies à l'étape 1 (au plus 6) ; à défaut la première catégorie du marché.
        categoryIds: (draft.categoryIds?.length ? draft.categoryIds.slice(0, 6) : [categoriesForMarket(market)[0]!.id]) as CategoryId[],
        ...coords,
      });
      const files = draftFiles.get();
      const [coverUrl, logoUrl] = await Promise.all([files.cover ? uploadSalonPhoto(created.id, files.cover) : null, files.logo ? uploadSalonPhoto(created.id, files.logo) : null]);
      if (coverUrl) await setPhotos.mutateAsync([{ url: coverUrl }]);
      await updateSalon.mutateAsync({ logoUrl: logoUrl ?? undefined, homeService: home });
      clearProDraft();
      qc.invalidateQueries({ queryKey: queryKeys.pro.all });
      navigate(stepPath(6), { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={4} backTo={settings ? '/pro/mon-salon' : stepPath(3)} right={settings ? t('Adresse') : undefined} />
      <StepTitle sub={settings ? undefined : t("Vos clients vous trouvent sur la carte et par quartier.")}>{t("Où vous trouver ?")}</StepTitle>
      <form id="address" onSubmit={submit} className="flex flex-col gap-4">
        <div className="relative">
          <label className="search !border-[1.5px] !border-ink !bg-surface">
            <I icon={Search} size={20} className="text-subtle" />
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setSearching(true);
              }}
              onFocus={() => {
                setSearching(true);
                prechargerLieux();
              }}
              onBlur={() => setTimeout(() => setSearching(false), 200)}
              placeholder={t("12 rue des Frères Bouadou, Hydra")}
              aria-label={t("Adresse")}
              maxLength={200}
              autoComplete="off"
            />
          </label>
          {searching && !!saisie && (
            <div
              className="absolute start-0 end-0 top-full z-[500] mt-1 shadow-card"
              // Le champ perd le focus avant que le clic n'aboutisse : sans cela la liste se
              // refermerait sous le doigt et le choix serait perdu.
              onMouseDown={(e) => e.preventDefault()}
            >
              <PlaceSuggestions
                lieux={lieux.locaux}
                adresses={lieux.adresses}
                geocodage={lieux.geocodage}
                onPick={pickLieu}
                vide={t("Aucune adresse de ce nom. Placez l’épingle sur la carte.")}
              />
            </div>
          )}
        </div>
        <PlacePicker value={pos} onChange={onMap} autoLocate={!settings && !pos} />
        <p className="p -mt-2 text-[0.857rem]">{t("Déplacez la carte pour placer l'épingle sur votre salon, ou touchez « Ma position ».")}</p>
        <div className="crd !gap-0 !py-1">
          <label className="li">
            <span className="text-[1rem] font-semibold">{t("Ville")}</span>
            <PickerField inline label={t("Ville")} title={t("Wilaya")} value={wilaya} onChange={setWilaya} options={WILAYAS.map((w) => ({ value: w.code, label: w.name, hint: `Wilaya ${String(w.code).padStart(2, '0')}` }))} />
          </label>
          <label className="li">
            <span className="text-[1rem] font-semibold">{t("Quartier")}</span>
            <input className="max-w-[55%] bg-transparent text-end text-[1rem] outline-none placeholder:text-subtle" value={zone} onChange={(e) => setZone(e.target.value)} placeholder={t("Hydra")} aria-label={t("Quartier")} maxLength={80} />
          </label>
          {settings && (
            <label className="li">
              <span className="text-[1rem] font-semibold">{t("Téléphone")}</span>
              <input type="tel" inputMode="tel" className="max-w-[55%] bg-transparent text-end text-[1rem] outline-none placeholder:text-subtle" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05 51 23 45 67" aria-label={t("Téléphone du salon")} />
            </label>
          )}
          <div className="li">
            <span>
              <span className="block text-[1rem] font-semibold">{t("Se déplacer à domicile")}</span>
              <span className="p block text-[1rem]">{t("Prestations hors salon")}</span>
            </span>
            <Toggle on={home} onChange={setHome} label={t("Se déplacer à domicile")} />
          </div>
        </div>
        {error && (
          <p className="text-[1rem] text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
      <StepSheet label={settings ? t('Enregistrer') : t('Continuer')} onClick={() => void submit()} busy={busy} />
    </Screen>
  );
}
