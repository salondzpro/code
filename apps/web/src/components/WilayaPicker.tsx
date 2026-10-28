/**
 * Choix d'une WILAYA (28 oct. 2026) : un champ qui affiche le choix, et une feuille avec une
 * recherche — 58 lignes ne se parcourent pas au doigt. On cherche sans accent, par le nom en
 * français ou en arabe, ou par le numéro (« 16 » trouve Alger).
 *
 * Feuille rendue par PORTAIL (comme `PickerSheet`) : un champ posé dans un `<label>` rouvrirait la
 * feuille au toucher du voile.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { WILAYAS } from '@salondz/constants';
import { aplatir } from '@/lib/places';
import { BottomSheet, Dim, I } from './ui';
import { t, useLocale } from '@/i18n';

export function WilayaPicker({
  value,
  onChange,
  invalid,
  id,
}: {
  value: number | null;
  onChange: (code: number) => void;
  invalid?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [locale] = useLocale();
  const w = WILAYAS.find((x) => x.code === value);
  const name = (x: (typeof WILAYAS)[number]) => (locale === 'ar' ? x.nameAr : x.name);
  return (
    <>
      <button
        id={id}
        type="button"
        className={`wlp ${invalid ? 'err' : ''} ${w ? 'on' : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {w ? (
          <>
            <span className="wlp-n mono">{String(w.code).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1 truncate text-start text-[1.143rem] font-semibold">{name(w)}</span>
          </>
        ) : (
          <span className="flex-1 text-start text-[1.143rem] text-subtle">{t('Choisir la wilaya')}</span>
        )}
        <I icon={ChevronDown} size={20} className="flex-none text-muted" />
      </button>
      {open && <WilayaSheet value={value} onClose={() => setOpen(false)} onPick={onChange} name={name} />}
    </>
  );
}

function WilayaSheet({
  value,
  onClose,
  onPick,
  name,
}: {
  value: number | null;
  onClose: () => void;
  onPick: (code: number) => void;
  name: (x: (typeof WILAYAS)[number]) => string;
}) {
  const [q, setQ] = useState('');
  const list = useRef<HTMLDivElement>(null);
  // La wilaya déjà choisie est amenée en vue à l'ouverture.
  useEffect(() => {
    list.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'center' });
  }, []);
  const needle = aplatir(q);
  const shown = WILAYAS.filter(
    (x) =>
      !needle ||
      aplatir(x.name).includes(needle) ||
      x.nameAr.includes(q.trim()) ||
      String(x.code) === needle ||
      String(x.code).padStart(2, '0') === needle,
  );
  return createPortal(
    <div onClick={(e) => e.stopPropagation()}>
      <Dim onClose={onClose} className="!z-[45]" />
      <BottomSheet modal className="wls !z-50">
        <div className="h2 text-center !text-[1.143rem]">{t('Votre wilaya')}</div>
        <label className="search !bg-fill">
          <I icon={Search} size={18} className="text-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Nom ou numéro (ex. 16)')}
            aria-label={t('Rechercher une wilaya')}
            autoComplete="off"
          />
        </label>
        <div ref={list} className="wls-l" role="radiogroup" aria-label={t('Votre wilaya')}>
          {shown.map((x) => {
            const on = x.code === value;
            return (
              <button
                key={x.code}
                type="button"
                role="radio"
                aria-checked={on}
                className={`wls-r ${on ? 'on' : ''}`}
                onClick={() => {
                  onPick(x.code);
                  onClose();
                }}
              >
                <span className="wlp-n mono">{String(x.code).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 text-start">
                  <span className="block truncate text-[1rem] font-semibold">{name(x)}</span>
                  <span className="block truncate text-[0.857rem] text-muted">
                    {name(x) === x.name ? x.nameAr : x.name}
                  </span>
                </span>
                {on && <I icon={Check} size={20} />}
              </button>
            );
          })}
          {!shown.length && <p className="p py-6 text-center">{t('Aucune wilaya ne correspond.')}</p>}
        </div>
      </BottomSheet>
    </div>,
    document.body,
  );
}
