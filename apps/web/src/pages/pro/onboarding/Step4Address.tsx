/**
 * PRO-F 06 — Étape 4 : « Où se trouve votre salon ? ». Refonte du 28 oct. 2026, en trois temps
 * numérotés, chacun validé avant le suivant :
 *
 *   1. la WILAYA, choisie dans une liste (recherche par nom ou numéro). La carte se cadre aussitôt
 *      sur elle, et les suggestions d'adresses ne viennent plus que d'elle ;
 *   2. l'ADRESSE, avec autocomplétion : communes de la wilaya (embarquées, sans réseau), puis rues
 *      et lieux d'OpenStreetMap limités à la wilaya. On peut aussi partir de sa position GPS ;
 *   3. l'EMPLACEMENT EXACT, sur la carte : l'épingle est au centre, on glisse la carte dessous,
 *      puis on CONFIRME. Sans confirmation, pas de suite — un salon mal placé envoie ses clients
 *      dans la mauvaise rue.
 *
 * Le QUARTIER n'est plus saisi à la main : il est lu sur l'adresse choisie ou sur la position
 * (géocodage inverse), à défaut c'est la commune la plus proche dans la wilaya. Ce qui part en
 * base : `wilayaCode`, `city` (commune), `zone` (quartier), `address`, `lat`, `lng`.
 *
 * Crée le salon. En mode `settings` (Profil → Adresse et localisation) : modifie le salon
 * existant, avec le téléphone du salon ; l'emplacement déjà enregistré compte comme confirmé.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Check, CheckCircle2, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useProSalon, useProSalonMutations } from '@salondz/api-client';
import { WILAYAS, categoriesForMarket, formatDZPhone, wilayaName, type CategoryId, type GeoBBox } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { useAuth } from '@/lib/auth';
import { clearProDraft, draftFiles, readProDraft, writeProDraft } from '@/lib/proDraft';
import { uploadSalonPhoto } from '@/lib/upload';
import { errorText } from '@/components/ErrorMessage';
import { I, Toggle } from '@/components/ui';
import { PlacePicker, type LatLng, type PlaceSource, type ReversePlace } from '@/components/PlacePicker';
import { PlaceSuggestions } from '@/components/PlaceSuggestions';
import { WilayaPicker } from '@/components/WilayaPicker';
import { useDebounced } from '@/lib/useDebounced';
import { aplatir, communeProche, dansZone, prechargerLieux, useLieux, zoneWilaya, type Lieu } from '@/lib/places';
import { positionPrecise } from '@/lib/position';
import { Screen, SHEET_PAD } from '@/components/AppFrame';
import { StepBar, StepSheet, StepTitle, stepPath } from './Shared';
import { t } from '@/i18n';

type Errors = Partial<Record<'wilaya' | 'address' | 'pos' | 'phone' | 'form', string>>;

export function Step4Address({ settings }: { settings?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useAuth();
  const salon = useProSalon().data?.salon ?? null;
  const { createSalon, updateSalon, setPhotos } = useProSalonMutations();
  const draft = readProDraft();
  const initial = settings ? salon : draft;

  const [wilaya, setWilaya] = useState<number | null>((settings ? salon?.wilayaCode : draft.wilayaCode) ?? null);
  const [box, setBox] = useState<GeoBBox | null>(null);
  const [address, setAddress] = useState((settings ? salon?.address : draft.address) ?? '');
  const [quartier, setQuartier] = useState((settings ? (salon?.zone ?? salon?.city) : draft.zone) ?? '');
  const [commune, setCommune] = useState((settings ? salon?.city : draft.city) ?? '');
  const [pos, setPos] = useState<LatLng | null>(initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  /** L'emplacement a été posé par la personne (doigt, GPS, adresse choisie) — pas un simple cadrage. */
  const [placed, setPlaced] = useState(!!pos);
  /** Emplacement confirmé : en réglages, celui déjà enregistré l'est d'office. */
  const [confirmed, setConfirmed] = useState(!!settings && !!pos);
  /** L'adresse a été écrite par le géocodage inverse : on peut la remplacer sans rien perdre. */
  const [addressAuto, setAddressAuto] = useState(false);
  const [home, setHome] = useState((settings ? salon?.homeService : draft.homeService) ?? false);
  const [phone, setPhone] = useState(settings && salon?.phone ? formatDZPhone(salon.phone) : '');
  const [searching, setSearching] = useState(false);
  const [gps, setGps] = useState<'idle' | 'asking' | 'denied'>('idle');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  // Zone de la wilaya (centre + rectangle) : cadrage de la carte et limite des suggestions.
  useEffect(() => {
    if (!wilaya) return setBox(null);
    let vivant = true;
    void zoneWilaya(wilaya).then((z) => vivant && setBox(z?.bbox ?? null));
    return () => {
      vivant = false;
    };
  }, [wilaya]);

  const saisie = useDebounced(searching ? address.trim() : '', 250);
  const lieux = useLieux(saisie, { wilaya, bbox: box });
  // Le rectangle d'une wilaya déborde sur ses voisines : une adresse qui NOMME une autre wilaya est écartée.
  const autres = wilaya ? WILAYAS.filter((x) => x.code !== wilaya).map((x) => aplatir(x.name)) : [];
  const adressesZone = lieux.adresses.filter((a) => {
    const d = aplatir(a.detail);
    return !d.includes(aplatir(wilayaName(wilaya ?? 0))) ? !autres.some((n) => d.includes(n)) : true;
  });

  if (!settings && (!draft.market || !draft.name)) return <Navigate to={stepPath(1)} replace />;
  if (!session) return <Navigate to="/connexion?role=pro" replace />;

  const wName = wilaya ? wilayaName(wilaya) : '';
  const outside = !!pos && !!box && !dansZone(pos, box);
  const step = !wilaya ? 1 : !address.trim() && !placed ? 2 : 3;

  const clearErr = (k: keyof Errors) => setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));

  /* ------------------------------------------------------------- 1. wilaya */
  const chooseWilaya = (code: number) => {
    clearErr('wilaya');
    if (code === wilaya) return;
    setWilaya(code);
    // Une autre wilaya : ce qui avait été placé ailleurs ne vaut plus.
    setAddress('');
    setQuartier('');
    setCommune('');
    setPos(null);
    setPlaced(false);
    setConfirmed(false);
  };

  /* ------------------------------------------------------------- 2. adresse */
  const pickLieu = (l: Lieu) => {
    setSearching(false);
    clearErr('address');
    clearErr('pos');
    if (l.kind === 'wilaya') return chooseWilaya(l.wilaya);
    setConfirmed(false);
    setPlaced(true);
    setPos({ lat: l.lat, lng: l.lng });
    if (l.kind === 'commune') {
      // Une commune n'est pas une adresse : on y amène la carte, la rue reste à préciser.
      setCommune(l.label);
      setQuartier(l.label);
      setAddress('');
      setAddressAuto(false);
      return;
    }
    setAddress(l.label);
    setAddressAuto(false);
    setQuartier(l.quartier ?? l.commune ?? quartier);
    setCommune(l.commune ?? commune);
  };

  const fromGps = () => {
    setGps('asking');
    positionPrecise(
      (m) => {
        setGps('idle');
        setPos({ lat: m.lat, lng: m.lng });
        setPlaced(true);
        setConfirmed(false);
        clearErr('pos');
      },
      () => setGps('denied'),
      { precisionM: 30 },
    );
  };

  /* ------------------------------------------------------------- 3. carte */
  const onMap = (p: LatLng, place: ReversePlace | null, source: PlaceSource) => {
    // Un cadrage du programme (wilaya choisie) n'est pas un emplacement : le centre d'une wilaya
    // n'est le salon de personne.
    if (source === 'program' && !placed) return;
    setPos(p);
    if (source !== 'program') {
      setPlaced(true);
      setConfirmed(false);
      clearErr('pos');
    }
    if (!place?.inDZ) return;
    if (place.quartier || place.commune) setQuartier(place.quartier ?? place.commune ?? '');
    if (place.commune) setCommune(place.commune);
    // L'adresse suit l'épingle tant qu'elle n'a pas été choisie ou tapée par la personne.
    if (addressAuto || !address.trim()) {
      const auto = [place.rue, place.quartier].filter(Boolean).join(', ') || place.label;
      setAddress(auto);
      setAddressAuto(true);
      clearErr('address');
    }
  };

  const confirmer = () => {
    if (!pos || !placed) return setErrors((e) => ({ ...e, pos: t('Placez l’épingle sur votre salon avant de confirmer.') }));
    if (outside)
      return setErrors((e) => ({ ...e, pos: t('L’épingle est en dehors de la wilaya de {w}. Déplacez la carte, ou changez de wilaya.', { w: wName }) }));
    clearErr('pos');
    setConfirmed(true);
  };

  /* ------------------------------------------------------------- validation et envoi */
  const validate = (): Errors => {
    const e: Errors = {};
    if (!wilaya) e.wilaya = t('Choisissez la wilaya de votre salon.');
    if (address.trim().length < 3) e.address = t('Indiquez l’adresse du salon (rue, numéro ou lieu proche).');
    if (!pos || !placed) e.pos = t('Placez l’épingle sur votre salon.');
    else if (outside) e.pos = t('L’épingle est en dehors de la wilaya de {w}. Déplacez la carte, ou changez de wilaya.', { w: wName });
    else if (!confirmed) e.pos = t('Confirmez l’emplacement de votre salon sur la carte.');
    if (settings && phone.trim() && !phoneDZ.safeParse(phone).success) e.phone = t('Numéro algérien invalide.');
    return e;
  };

  const submit = async (ev?: FormEvent) => {
    ev?.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.querySelector('[data-err="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setBusy(true);
    try {
      // Commune et quartier : déduits ; à défaut, la commune la plus proche dans la wilaya.
      const city = (commune || quartier || (await communeProche(pos!, wilaya!)) || wName).slice(0, 80);
      const zone = (quartier || city).slice(0, 80);
      const fields = { wilayaCode: wilaya!, city, zone, address: address.trim().slice(0, 200), lat: pos!.lat, lng: pos!.lng };
      if (settings) {
        const normalizedPhone = phone.trim() ? phoneDZ.parse(phone) : undefined;
        await updateSalon.mutateAsync({ ...fields, homeService: home, phone: normalizedPhone });
        navigate('/pro/mon-salon');
        return;
      }
      writeProDraft({ ...fields, homeService: home });
      const market = draft.market!;
      const created = await createSalon.mutateAsync({
        name: draft.name!,
        ...fields,
        genderTarget: market,
        // Spécialités choisies à l'étape 1 (au plus 6) ; à défaut la première catégorie du marché.
        categoryIds: (draft.categoryIds?.length ? draft.categoryIds.slice(0, 6) : [categoriesForMarket(market)[0]!.id]) as CategoryId[],
      });
      const files = draftFiles.get();
      const [coverUrl, logoUrl] = await Promise.all([files.cover ? uploadSalonPhoto(created.id, files.cover) : null, files.logo ? uploadSalonPhoto(created.id, files.logo) : null]);
      if (coverUrl) await setPhotos.mutateAsync([{ url: coverUrl }]);
      await updateSalon.mutateAsync({ logoUrl: logoUrl ?? undefined, homeService: home });
      clearProDraft();
      qc.invalidateQueries({ queryKey: queryKeys.pro.all });
      navigate(stepPath(6), { replace: true });
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={SHEET_PAD} gap={16}>
      <StepBar step={4} backTo={settings ? '/pro/mon-salon' : stepPath(3)} right={settings ? t('Adresse') : undefined} />
      <StepTitle icon={settings ? undefined : MapPin} sub={settings ? undefined : t('Wilaya, adresse, emplacement.')}>
        {t('Où se trouve votre salon ?')}
      </StepTitle>

      <form id="address" onSubmit={submit} className="adr" noValidate>
        {/* ---------------------------------------------------------------- 1 */}
        <AdrStep n={1} title={t('Wilaya')} done={!!wilaya} active={step === 1} error={errors.wilaya}>
          <WilayaPicker id="adr-wilaya" value={wilaya} onChange={chooseWilaya} invalid={!!errors.wilaya} />
        </AdrStep>

        {/* ---------------------------------------------------------------- 2 */}
        <AdrStep
          n={2}
          title={t('Adresse')}
          done={address.trim().length >= 3}
          active={step === 2}
          locked={!wilaya}
          error={errors.address}
          hint={wilaya ? undefined : t('Choisissez d’abord la wilaya.')}
        >
          <div className="relative">
            <label className={`adr-in ${errors.address ? 'err' : ''}`}>
              <I icon={Search} size={19} className="flex-none text-subtle" />
              <input
                value={address}
                disabled={!wilaya}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setAddressAuto(false);
                  setSearching(true);
                  setConfirmed(false);
                  clearErr('address');
                }}
                onFocus={() => {
                  setSearching(true);
                  prechargerLieux();
                }}
                onBlur={() => setTimeout(() => setSearching(false), 200)}
                placeholder={t('12 rue des Frères Bouadou, Hydra')}
                aria-label={t('Adresse')}
                maxLength={200}
                autoComplete="off"
                enterKeyHint="search"
              />
              {!!address && wilaya && (
                <button
                  type="button"
                  className="adr-x"
                  aria-label={t('Effacer')}
                  onClick={() => {
                    setAddress('');
                    setAddressAuto(false);
                    setConfirmed(false);
                  }}
                >
                  <I icon={X} size={16} />
                </button>
              )}
            </label>
            {searching && !!saisie && (
              <div
                className="absolute inset-x-0 top-full z-[500] mt-1 max-w-[calc(100vw-2rem)] shadow-card"
                // Le champ perd le focus avant que le clic n'aboutisse : sans cela la liste se
                // refermerait sous le doigt et le choix serait perdu.
                onMouseDown={(e) => e.preventDefault()}
              >
                <PlaceSuggestions
                  lieux={lieux.locaux}
                  adresses={adressesZone}
                  geocodage={lieux.geocodage}
                  onPick={pickLieu}
                  vide={t('Aucune adresse de ce nom à {w}. Placez l’épingle sur la carte.', { w: wName })}
                />
              </div>
            )}
          </div>
          {wilaya && (
            <button type="button" className="adr-gps" onClick={fromGps} disabled={gps === 'asking'}>
              <I icon={LocateFixed} size={17} />
              {gps === 'asking' ? t('Recherche de votre position…') : t('Utiliser ma position')}
            </button>
          )}
          {gps === 'denied' && (
            <p className="text-[0.857rem] text-danger" role="alert">
              {t('Position refusée : autorisez la localisation, ou placez l’épingle à la main.')}
            </p>
          )}
        </AdrStep>

        {/* ---------------------------------------------------------------- 3 */}
        <AdrStep
          n={3}
          title={t('Emplacement exact')}
          done={confirmed}
          active={step === 3}
          locked={!wilaya}
          error={errors.pos}
          hint={undefined}
        >
          <PlacePicker value={pos} onChange={onMap} zone={box} confirmed={confirmed} />
          {/* Récapitulatif : ce qui sera enregistré, et la confirmation. */}
          <div className={`adr-sum ${confirmed ? 'ok' : ''}`}>
            <span className="adr-sum-i">
              <I icon={confirmed ? CheckCircle2 : MapPin} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[1rem] font-semibold">{address.trim() || t('Adresse à préciser')}</span>
              <span className="block truncate text-[0.857rem] text-muted">
                {[quartier, commune !== quartier ? commune : null, wName].filter(Boolean).join(' · ') || t('Placez l’épingle sur votre salon')}
              </span>
              {pos && placed && (
                <span className="mono block text-[0.75rem] text-subtle" dir="ltr">
                  {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
                </span>
              )}
            </span>
          </div>
          {confirmed ? (
            <button type="button" className="adr-ok" onClick={() => setConfirmed(false)}>
              <I icon={Check} size={17} /> {t('Emplacement confirmé')} · <u>{t('Modifier')}</u>
            </button>
          ) : (
            <button type="button" className="btn" onClick={confirmer} disabled={!pos || !placed}>
              <I icon={MapPin} size={18} /> {t('Confirmer cet emplacement')}
            </button>
          )}
        </AdrStep>

        {/* ---------------------------------------------------------------- options */}
        <div className="crd !gap-0 !py-1">
          {settings && (
            <label className="li" data-err={!!errors.phone || undefined}>
              <span className="text-[1rem] font-semibold">{t('Téléphone')}</span>
              <input
                type="tel"
                inputMode="tel"
                className="max-w-[55%] bg-transparent text-end text-[1rem] outline-none placeholder:text-subtle"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearErr('phone');
                }}
                placeholder="05 51 23 45 67"
                aria-label={t('Téléphone du salon')}
              />
            </label>
          )}
          <div className="li">
            <span>
              <span className="block text-[1rem] font-semibold">{t('Se déplacer à domicile')}</span>
              <span className="p block text-[1rem]">{t('Prestations hors salon')}</span>
            </span>
            <Toggle on={home} onChange={setHome} label={t('Se déplacer à domicile')} />
          </div>
        </div>
        {errors.phone && (
          <p className="-mt-2 text-[0.857rem] text-danger" role="alert">
            {errors.phone}
          </p>
        )}
        {errors.form && (
          <p className="text-[1rem] text-danger" role="alert">
            {errors.form}
          </p>
        )}
      </form>
      <StepSheet label={settings ? t('Enregistrer') : t('Continuer')} onClick={() => void submit()} busy={busy} />
    </Screen>
  );
}

/** Une étape numérotée : pastille (chiffre, puis coche), titre, contenu, aide ou erreur. */
function AdrStep({
  n,
  title,
  done,
  active,
  locked,
  hint,
  error,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  active: boolean;
  locked?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`adr-s ${done ? 'done' : ''} ${active ? 'on' : ''} ${locked ? 'off' : ''} ${error ? 'err' : ''}`}
      data-err={!!error || undefined}
      aria-label={title}
    >
      <div className="adr-h">
        <span className="adr-n">{done ? <I icon={Check} size={15} strokeWidth={2.6} /> : n}</span>
        <span className="text-[1.143rem] font-semibold">{title}</span>
      </div>
      <div className="adr-b">
        {children}
        {error ? (
          <p className="text-[0.857rem] font-medium text-danger" role="alert">
            {error}
          </p>
        ) : (
          hint && <p className="text-[0.857rem] text-muted">{hint}</p>
        )}
      </div>
    </section>
  );
}
