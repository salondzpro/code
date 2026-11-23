/**
 * Administration — MARKETING (23 nov. 2026, demande du propriétaire : « tout ce dont tu as besoin
 * pour lancer le marketing sur les réseaux »). Une page, quatre blocs :
 *   1. Inscriptions par réseau et par campagne (`?src=` + `c=`, compteurs `acq_stats`) ;
 *   2. Liens de campagne à copier (un par réseau, clientes et pros) ;
 *   3. Textes à lire pour les vidéos UGC (`marketingScripts.ts`) et conseils de tournage ;
 *   4. Envoi des vidéos du propriétaire (seau privé `marketing`, 50 Mo par fichier) pour le montage.
 */
import { useRef, useState } from 'react';
import { Copy, Film, Upload } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminMe, useApi } from '@salondz/api-client';
import { STORAGE_BUCKETS } from '@salondz/constants';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { I, PageHead, Segmented, Skeleton } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { CONSEILS_TOURNAGE, SCRIPTS } from './marketingScripts';

const RESEAUX = ['instagram', 'tiktok', 'snapchat', 'facebook', 'whatsapp'] as const;

function copier(texte: string, fait: (v: string) => void, cle: string) {
  void navigator.clipboard
    .writeText(texte)
    .then(() => {
      fait(cle);
      window.setTimeout(() => fait(''), 1500);
    })
    .catch(() => undefined);
}

export function AdminMarketing() {
  const { api } = useApi();
  const qc = useQueryClient();
  const owner = useAdminMe().data?.level === 'owner';
  const stats = useQuery({ queryKey: ['admin', 'acq'], queryFn: () => api.admin.marketingStats() });
  const videos = useQuery({ queryKey: ['admin', 'rushes'], queryFn: () => api.admin.marketingVideos(), enabled: owner });
  const [cible, setCible] = useState<'clientes' | 'pros'>('clientes');
  const [copie, setCopie] = useState('');
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  const envoyer = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) {
        if (f.size > 50 * 1024 * 1024) throw new Error(`« ${f.name} » dépasse 50 Mo : coupe-la en plusieurs prises.`);
        setEnvoi(`Envoi de « ${f.name} »…`);
        const { path, token } = await api.admin.marketingUploadUrl(f.name);
        const up = await supabase.storage.from(STORAGE_BUCKETS.marketing).uploadToSignedUrl(path, token, f, { contentType: f.type || 'video/mp4' });
        if (up.error) throw up.error;
      }
    },
    onSuccess: () => {
      setEnvoi('Vidéos envoyées.');
      void qc.invalidateQueries({ queryKey: ['admin', 'rushes'] });
    },
    onError: (e) => {
      setEnvoi(null);
      setErreur(e instanceof Error ? e.message : 'Envoi impossible.');
    },
  });

  const lignes = Object.entries(stats.data?.stats ?? {})
    .map(([k, v]) => ({ src: k.split('|')[0]!, c: k.split('|')[1] || '—', ...v }))
    .sort((a, b) => b.client + b.pro - (a.client + a.pro));
  const scripts = SCRIPTS.filter((s) => (cible === 'pros' ? s.cible === 'pros' : s.cible !== 'pros'));
  const base = cible === 'pros' ? 'https://salondz.com/professionnels' : 'https://salondz.com/salons';

  return (
    <Screen gap={18} width="page">
      <PageHead title="Marketing" />

      {/* 1. Résultats */}
      <section className="mk-bloc">
        <h2>Inscriptions par réseau</h2>
        {stats.isPending && <Skeleton className="h-[5rem] w-full" />}
        {stats.isError && <ErrorMessage error={stats.error} retry={() => void stats.refetch()} />}
        {stats.data && lignes.length === 0 && <p className="p">Aucune inscription venue d’un lien de campagne pour l’instant.</p>}
        {lignes.length > 0 && (
          <div className="mk-table">
            <div className="mk-tr mk-th">
              <span>Réseau</span>
              <span>Campagne</span>
              <span>Clients</span>
              <span>Pros</span>
            </div>
            {lignes.map((l) => (
              <div key={`${l.src}|${l.c}`} className="mk-tr">
                <span>{l.src}</span>
                <span>{l.c}</span>
                <b>{l.client}</b>
                <b>{l.pro}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <Segmented
        label="Public"
        value={cible}
        onChange={setCible}
        options={[
          { value: 'clientes', label: 'Clients' },
          { value: 'pros', label: 'Professionnels' },
        ]}
      />

      {/* 2. Liens */}
      <section className="mk-bloc">
        <h2>Liens à mettre en bio et dans les publicités</h2>
        <div className="lst">
          {RESEAUX.map((r) => {
            const lien = `${base}?src=${r}`;
            return (
              <button key={r} type="button" className="lst-r w-full text-start" onClick={() => copier(lien, setCopie, lien)}>
                <span className="lst-t min-w-0 flex-1">
                  {r[0]!.toUpperCase() + r.slice(1)}
                  <small dir="ltr" className="block truncate">{lien}</small>
                </span>
                <span className="mk-copie">{copie === lien ? 'Copié' : <I icon={Copy} size={16} />}</span>
              </button>
            );
          })}
        </div>
        <p className="mk-note">Ajoute <code>&amp;c=nom-de-campagne</code> pour suivre une vidéo précise (ex. <code>&amp;c=aid</code>).</p>
      </section>

      {/* 3. Textes à lire */}
      <section className="mk-bloc">
        <h2>Textes à lire</h2>
        <div className="mk-scripts">
          {scripts.map((s) => {
            const texte = s.plans.filter((p) => p.dire).map((p) => p.dire).join('\n');
            return (
              <article key={s.id} className="mk-script">
                <div className="mk-script-hd">
                  <b>{s.titre}</b>
                  <span>{s.duree}</span>
                </div>
                <p className="mk-accroche">
                  <b>Accroche :</b> {s.accroche}
                </p>
                <ol>
                  {s.plans.map((p, i) => (
                    <li key={i} className={`mk-plan p${p.plan}`}>
                      <span className="mk-plan-l">{p.plan === 'A' ? 'Toi' : p.plan === 'B' ? 'Écran' : 'Fin'}</span>
                      <span className="min-w-0">
                        {p.dire && <b dir="auto">« {p.dire} »</b>}
                        {p.montrer && <span className="mk-montrer">{p.montrer}</span>}
                        {p.sousTitre && <small>Sous-titre : {p.sousTitre}</small>}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mk-actions">
                  <button type="button" className="btn g sm" onClick={() => copier(texte, setCopie, s.id)}>
                    <I icon={Copy} size={16} /> {copie === s.id ? 'Copié' : 'Copier le texte à lire'}
                  </button>
                  <button type="button" className="btn g sm" onClick={() => copier(`${s.legende}\n${s.lien}`, setCopie, `${s.id}-l`)}>
                    <I icon={Copy} size={16} /> {copie === `${s.id}-l` ? 'Copié' : 'Copier la légende'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <details className="mk-conseils">
          <summary>Conseils de tournage</summary>
          <ul>
            {CONSEILS_TOURNAGE.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      </section>

      {/* 4. Vidéos */}
      {owner && (
        <section className="mk-bloc">
          <h2>Tes vidéos (pour le montage)</h2>
          <input
            ref={fichier}
            type="file"
            accept="video/*,audio/*,image/*"
            multiple
            hidden
            onChange={(e) => {
              setErreur(null);
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              if (files.length) envoyer.mutate(files);
            }}
          />
          <button type="button" className="btn" disabled={envoyer.isPending} onClick={() => fichier.current?.click()}>
            <I icon={Upload} size={18} /> {envoyer.isPending ? 'Envoi…' : 'Envoyer des vidéos'}
          </button>
          {envoi && <p className="mk-note">{envoi}</p>}
          {erreur && <p className="text-[0.929rem] text-danger">{erreur}</p>}
          {videos.data && videos.data.items.length > 0 && (
            <div className="lst">
              {videos.data.items.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  className="lst-r w-full text-start"
                  onClick={() => void api.admin.marketingVideoUrl(v.name).then((r) => window.open(r.url, '_blank', 'noopener'))}
                >
                  <I icon={Film} size={18} />
                  <span className="lst-t min-w-0 flex-1">
                    <span className="block truncate">{v.name}</span>
                    <small>{(v.size / 1024 / 1024).toFixed(1)} Mo</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </Screen>
  );
}
