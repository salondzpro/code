/**
 * Mon salon (refonte du 13 nov. 2026, demande du propriétaire : « l'essentiel et le plus utile d'abord,
 * et comprendre ce qu'on modifie ») — charte `docs/CHARTE.md`.
 *
 *   1. Le salon TEL QUE LE VOIENT LES CLIENTES : photo de couverture, logo, nom, adresse — un aperçu
 *      qui dit immédiatement ce qui manque (pas de photo, pas de logo).
 *   2. « Ce que voient vos clientes », dans l'ordre d'importance : nom et description, photos et logo,
 *      adresse, réalisations. Chaque ligne dit CE QU'ELLE MODIFIE et sa valeur actuelle.
 *   3. « Votre activité » : clientèle et spécialités.
 *
 * Nom et description s'éditent dans une FENÊTRE dédiée (titre, champs nommés, compteur, Enregistrer) ;
 * avant, la zone de texte s'ouvrait sans titre sous la carte, loin de la ligne touchée.
 */
import { ICONE } from '@/lib/actionIcons';
import { useState } from 'react';
import { Camera, FileText, Images, MapPin, Sparkles, Store, Users, type LucideIcon } from 'lucide-react';
import { useProSalon, useProSalonMutations } from '@salondz/api-client';
import { MARKET_LABELS_FR, categoryLabel, wilayaName, type GenderTarget } from '@salondz/constants';
import { PickerField } from '@/components/Picker';
import { errorText } from '@/components/ErrorMessage';
import { Avatar, BottomSheet, Button, Dim, Field, I, Input, ListRow, SectionLabel, Textarea, TopBar } from '@/components/ui';
import { Screen, NAV_PAD } from '@/components/AppFrame';
import { PageLoading } from '@/components/PageLoading';
import { Link } from 'react-router';
import { t } from '@/i18n';

export function RowText({ icon, title, sub, alerte }: { icon: LucideIcon; title: string; sub?: string; alerte?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-3.5">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-fill">
        <I icon={icon} size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[1rem] font-semibold">{title}</span>
        {sub && <span className={`block truncate text-[0.929rem] ${alerte ? 'text-[#c76a00]' : 'text-muted'}`}>{sub}</span>}
      </span>
    </span>
  );
}

const DESC_MAX = 1500;

export function MonSalon() {
  const salon = useProSalon().data?.salon ?? null;
  const { updateSalon } = useProSalonMutations();
  /** Fenêtre « Nom et description » : brouillon ouvert, ou `null`. */
  const [edit, setEdit] = useState<{ name: string; description: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!salon) return <PageLoading />;
  const place = [salon.address, salon.zone ?? salon.city, wilayaName(salon.wilayaCode)].filter(Boolean).join(', ');
  const cover = salon.photos[0]?.url ?? salon.coverUrl ?? null;
  const nPhotos = salon.photos.length;
  const nWorks = salon.works.length;

  const enregistrer = async () => {
    if (!edit) return;
    const name = edit.name.trim();
    if (name.length < 2) return setError(t('Indiquez le nom du salon.'));
    setError(null);
    try {
      await updateSalon.mutateAsync({ name, description: edit.description.trim() || undefined });
      setEdit(null);
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Screen bottom={NAV_PAD} gap={16}>
      <TopBar backTo="/pro/parametres" title={t('Mon salon')} />

      {/* 1. L'aperçu : ce que voit une cliente en arrivant sur la page du salon. */}
      <Link to="/pro/photos" className="ms-apercu" aria-label={t('Photos et logo')}>
        <span className="ms-couv">
          {cover ? <img src={cover} alt="" /> : <span className="ms-couv-vide"><I icon={Camera} size={22} /> {t('Ajouter une photo de couverture')}</span>}
        </span>
        <span className="ms-id">
          <span className="ms-logo">
            <Avatar src={salon.logoUrl ?? undefined} name={salon.name} size={64} />
          </span>
          <span className="min-w-0">
            <b className="block truncate text-[1.143rem] font-semibold">{salon.name}</b>
            <span className="block truncate text-[0.857rem] text-muted">{place || t('Adresse à compléter')}</span>
          </span>
        </span>
      </Link>

      {/* 2. Ce que voient les clientes, dans l'ordre d'importance. */}
      <SectionLabel>{t('Ce que voient vos clientes')}</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <button
          type="button"
          className="li w-full text-start"
          onClick={() => {
            setError(null);
            setEdit({ name: salon.name, description: salon.description ?? '' });
          }}
        >
          <RowText
            icon={FileText}
            title={t('Nom et description')}
            sub={salon.description || t('Ajoutez une description : ce qui rend votre salon unique')}
            alerte={!salon.description}
          />
          <I icon={ICONE.modifier} size={18} className="flex-none text-muted" />
        </button>
        <ListRow to="/pro/photos">
          <RowText
            icon={Images}
            title={t('Photos et logo')}
            sub={
              nPhotos || salon.logoUrl
                ? `${salon.logoUrl ? t('Logo') : t('Sans logo')} · ${t(nPhotos > 1 ? '{n} photos de couverture' : '{n} photo de couverture', { n: nPhotos })}`
                : t('Ajoutez un logo et des photos')
            }
            alerte={!nPhotos || !salon.logoUrl}
          />
        </ListRow>
        <ListRow to="/pro/salon">
          <RowText icon={MapPin} title={t('Adresse')} sub={place || t('Adresse à compléter')} alerte={!place} />
        </ListRow>
        <ListRow to="/pro/realisations">
          <RowText
            icon={Sparkles}
            title={t('Réalisations')}
            sub={nWorks ? t(nWorks > 1 ? '{n} photos de votre travail' : '{n} photo de votre travail', { n: nWorks }) : t('Montrez votre travail en photos')}
            alerte={!nWorks}
          />
        </ListRow>
      </div>

      {/* 3. Votre activité. */}
      <SectionLabel>{t('Votre activité')}</SectionLabel>
      <div className="crd !gap-0 !py-1">
        <div className="li !py-3">
          <RowText icon={Users} title={t('Clientèle')} />
          <PickerField
            label={t('Clientèle')}
            title={t('Votre clientèle')}
            inline
            value={salon.genderTarget}
            onChange={(v: GenderTarget) => updateSalon.mutate({ genderTarget: v }, { onError: (e) => setError(errorText(e)) })}
            options={[
              { value: 'men', label: t(MARKET_LABELS_FR.men), hint: t('Barbier, coiffure homme') },
              { value: 'women', label: t(MARKET_LABELS_FR.women), hint: t('Coiffure, ongles, cils, soins') },
              { value: 'unisex', label: t('Mixte'), hint: t('Hommes et femmes · les deux catalogues') },
            ]}
          />
        </div>
        <ListRow to="/pro/specialites">
          <RowText
            icon={Store}
            title={t('Spécialités')}
            sub={salon.categoryIds.length ? salon.categoryIds.map((id) => categoryLabel(id)).join(' · ') : t('Choisissez vos spécialités')}
            alerte={!salon.categoryIds.length}
          />
        </ListRow>
      </div>
      {error && !edit && (
        <p className="text-[1rem] text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Fenêtre « Nom et description » : on sait ce qu'on modifie, et où cela s'affiche. */}
      {edit && (
        <>
          <Dim onClose={() => setEdit(null)} />
          <BottomSheet modal>
            <div className="h2 !text-[1.286rem]">{t('Nom et description')}</div>
            <p className="-mt-2 text-[0.929rem] text-muted">{t('Affichés en haut de votre page, sous vos photos.')}</p>
            <Field label={t('Nom du salon')} htmlFor="ms-nom">
              <Input id="ms-nom" value={edit.name} maxLength={80} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field
              label={t('Description')}
              htmlFor="ms-desc"
              hint={t('{n} caractères sur {max}', { n: edit.description.length, max: DESC_MAX })}
            >
              <Textarea
                id="ms-desc"
                rows={5}
                value={edit.description}
                maxLength={DESC_MAX}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                placeholder={t('Salon calme, produits sans parabène…')}
              />
            </Field>
            {error && (
              <p className="text-[0.929rem] text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="g2 mt-auto">
              <Button icon={ICONE.fermerFenetre} variant="g" onClick={() => setEdit(null)}>
                {t('Annuler')}
              </Button>
              <Button icon={ICONE.enregistrer} loading={updateSalon.isPending} onClick={() => void enregistrer()}>
                {t('Enregistrer')}
              </Button>
            </div>
          </BottomSheet>
        </>
      )}
    </Screen>
  );
}
