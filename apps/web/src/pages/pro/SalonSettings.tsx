import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { CATEGORIES, GENDER_TARGETS, GENDER_TARGET_LABELS_FR, SALON_MAX_PHOTOS, SLOT_INTERVALS, WILAYAS, formatDZPhone, type CategoryId, type GenderTarget } from '@salondz/constants';
import { phoneDZ } from '@salondz/validation';
import { uploadSalonPhoto } from '@/lib/upload';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';

export function SalonSettings() {
  const { data } = useProSalon();
  const salon = data?.salon ?? null;
  const { updateSalon, setPhotos } = useProSalonMutations();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [wilayaCode, setWilayaCode] = useState(16);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [genderTarget, setGenderTarget] = useState<GenderTarget>('unisex');
  const [categoryIds, setCategoryIds] = useState<CategoryId[]>([]);
  const [slotInterval, setSlotInterval] = useState(15);
  const [leadTime, setLeadTime] = useState(60);
  const [horizon, setHorizon] = useState(30);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);

  useEffect(() => {
    if (!salon) return;
    setName(salon.name);
    setDescription(salon.description ?? '');
    setWilayaCode(salon.wilayaCode);
    setCity(salon.city);
    setAddress(salon.address ?? '');
    setPhone(salon.phone ? formatDZPhone(salon.phone) : '');
    setGenderTarget(salon.genderTarget);
    setCategoryIds(salon.categoryIds as CategoryId[]);
    setSlotInterval(salon.slotIntervalMinutes);
    setLeadTime(salon.bookingLeadTimeMinutes);
    setHorizon(salon.bookingHorizonDays);
    setAutoConfirm(salon.autoConfirm);
  }, [salon]);

  if (!salon) return <Spinner />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaved(false);
    let normalizedPhone: string | undefined;
    if (phone.trim()) {
      const parsed = phoneDZ.safeParse(phone);
      if (!parsed.success) return setFormError('Numéro algérien invalide.');
      normalizedPhone = parsed.data;
    }
    if (categoryIds.length === 0) return setFormError('Choisissez au moins une catégorie.');
    await updateSalon.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      wilayaCode,
      city: city.trim(),
      address: address.trim() || undefined,
      phone: normalizedPhone,
      genderTarget,
      categoryIds,
      slotIntervalMinutes: slotInterval,
      bookingLeadTimeMinutes: leadTime,
      bookingHorizonDays: horizon,
      autoConfirm,
    });
    setSaved(true);
  };

  const togglePublish = () => updateSalon.mutate({ isPublished: !salon.isPublished });

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setUploadError(null);
    setUploading(true);
    try {
      const room = SALON_MAX_PHOTOS - salon.photos.length;
      const urls: string[] = [];
      for (const f of files.slice(0, Math.max(0, room))) urls.push(await uploadSalonPhoto(salon.id, f));
      await setPhotos.mutateAsync([...salon.photos.map((p) => ({ url: p.url })), ...urls.map((url) => ({ url }))]);
    } catch (err) {
      setUploadError(err);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (url: string) => setPhotos.mutate(salon.photos.filter((p) => p.url !== url).map((p) => ({ url: p.url })));
  const publicUrl = `${window.location.origin}/s/${salon.slug}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Mon salon</h1>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${salon.isPublished ? 'text-success' : 'text-warning'}`}>{salon.isPublished ? 'Publié' : 'Non publié'}</span>
          <button type="button" className={salon.isPublished ? 'btn-ghost' : 'btn-primary'} onClick={togglePublish} disabled={updateSalon.isPending}>
            {salon.isPublished ? 'Dépublier' : 'Publier'}
          </button>
        </div>
      </header>
      <ErrorMessage error={updateSalon.error} />

      <section className="card flex flex-col gap-2 p-4">
        <h2 className="font-semibold">Lien public</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <code className="rounded bg-bg px-2 py-1">{publicUrl}</code>
          <button type="button" className="btn-ghost px-3 py-1 text-sm" onClick={() => navigator.clipboard.writeText(publicUrl)}>
            Copier
          </button>
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <h2 className="font-semibold">Photos ({salon.photos.length}/{SALON_MAX_PHOTOS})</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {salon.photos.map((p, i) => (
            <div key={p.id} className="relative">
              <img src={p.url} alt="" className="aspect-square w-full rounded-xl object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-surface/90 px-1 text-xs">Couverture</span>}
              <button type="button" className="absolute right-1 top-1 rounded bg-surface/90 px-1 text-xs" onClick={() => removePhoto(p.url)} aria-label="Supprimer la photo">
                ✕
              </button>
            </div>
          ))}
        </div>
        <label className="btn-ghost w-fit cursor-pointer">
          {uploading ? 'Envoi…' : 'Ajouter des photos'}
          <input type="file" accept="image/*" multiple hidden onChange={onFiles} disabled={uploading || salon.photos.length >= SALON_MAX_PHOTOS} />
        </label>
        <p className="text-xs text-muted">Compressées automatiquement (max 1600 px) pour un chargement rapide en 4G.</p>
        <ErrorMessage error={uploadError ?? setPhotos.error} />
      </section>

      <form onSubmit={submit} className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Informations</h2>
        <Field label="Nom" required>{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}</Field>
        <Field label="Téléphone">{(id) => <input id={id} className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05 51 23 45 67" />}</Field>
        <Field label="Wilaya" required>
          {(id) => (
            <select id={id} className="input" value={wilayaCode} onChange={(e) => setWilayaCode(Number(e.target.value))}>
              {WILAYAS.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.code} – {w.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Commune / quartier" required>{(id) => <input id={id} className="input" value={city} onChange={(e) => setCity(e.target.value)} />}</Field>
        <Field label="Adresse">{(id) => <input id={id} className="input" value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>
        <Field label="Clientèle">
          {(id) => (
            <div id={id} className="flex gap-2">
              {GENDER_TARGETS.map((g) => (
                <button key={g} type="button" className={genderTarget === g ? 'chip-active' : 'chip'} onClick={() => setGenderTarget(g)}>
                  {GENDER_TARGET_LABELS_FR[g]}
                </button>
              ))}
            </div>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">{(id) => <textarea id={id} className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1500} />}</Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Catégories (1 à 4)" required>
            {(id) => (
              <div id={id} className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={categoryIds.includes(c.id) ? 'chip-active' : 'chip'}
                    onClick={() => setCategoryIds((prev) => (prev.includes(c.id) ? prev.filter((x) => x !== c.id) : prev.length < 4 ? [...prev, c.id] : prev))}
                  >
                    {c.labelFr}
                  </button>
                ))}
              </div>
            )}
          </Field>
        </div>

        <h2 className="mt-2 font-semibold sm:col-span-2">Réservation en ligne</h2>
        <Field label="Pas des créneaux" hint="Granularité des horaires proposés.">
          {(id) => (
            <select id={id} className="input" value={slotInterval} onChange={(e) => setSlotInterval(Number(e.target.value))}>
              {SLOT_INTERVALS.map((v) => (
                <option key={v} value={v}>
                  {v} min
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Délai minimum (minutes)" hint="Temps minimum avant un rendez-vous pris en ligne.">
          {(id) => <input id={id} className="input" type="number" min={0} max={10080} step={15} value={leadTime} onChange={(e) => setLeadTime(Number(e.target.value))} />}
        </Field>
        <Field label="Horizon (jours)" hint="Jusqu'à combien de jours à l'avance.">
          {(id) => <input id={id} className="input" type="number" min={1} max={90} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} />}
        </Field>
        <Field label="Confirmation">
          {(id) => (
            <label id={id} className="flex items-center gap-2 py-2 text-sm">
              <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} />
              Confirmer automatiquement les réservations en ligne
            </label>
          )}
        </Field>
        {formError && <p className="text-sm text-danger sm:col-span-2">{formError}</p>}
        {saved && <p className="text-sm text-success sm:col-span-2">Modifications enregistrées.</p>}
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={updateSalon.isPending}>
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
