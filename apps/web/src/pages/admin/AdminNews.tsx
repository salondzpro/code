/**
 * Administration — CONSEILS & NOUVEAUTÉS pour les professionnels (20 nov. 2026, demande du propriétaire).
 *
 * Une publication s'affiche EN TÊTE du rond « Conseil » de l'accueil pro, et peut prévenir tous les
 * professionnels par une notification 📣 « Nouveauté Salon DZ » qui ouvre ce Conseil. Niveau `owner`
 * pour publier ou retirer ; chaque geste est au journal (`pro_news_publish` / `pro_news_delete`).
 */
import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminMe, useApi } from '@salondz/api-client';
import { formatDateShortDZ } from '@salondz/constants';
import { Screen } from '@/components/AppFrame';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Button, Field, I, Input, PageHead, Skeleton, Textarea, Toggle } from '@/components/ui';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

export function AdminNews() {
  const { api } = useApi();
  const qc = useQueryClient();
  const me = useAdminMe();
  const owner = me.data?.level === 'owner';
  const list = useQuery({ queryKey: ['admin', 'news'], queryFn: () => api.admin.news() });
  const [titre, setTitre] = useState('');
  const [texte, setTexte] = useState('');
  const [lien, setLien] = useState('');
  const [bouton, setBouton] = useState('');
  const [prevenir, setPrevenir] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const publier = useMutation({
    mutationFn: () => api.admin.publishNews({ title: titre, body: texte, url: lien.trim() || undefined, action: bouton.trim() || undefined, notify: prevenir }),
    onSuccess: (r) => {
      setTitre('');
      setTexte('');
      setLien('');
      setBouton('');
      setMsg(r.notified ? t('Publié · {n} professionnels prévenus', { n: r.notified }) : t('Publié'));
      void qc.invalidateQueries({ queryKey: ['admin', 'news'] });
    },
  });
  const retirer = useMutation({
    mutationFn: (id: string) => api.admin.deleteNews(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'news'] }),
  });

  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (titre.trim().length < 3 || texte.trim().length < 3) return setMsg(t('Un titre et un texte, 3 caractères au moins.'));
    publier.mutate();
  };

  return (
    <Screen gap={16} width="page">
      <PageHead title={t('Conseils & nouveautés')} sub={t('Affichés en tête du rond « Conseil » de l’accueil des professionnels.')} />

      {owner && (
        <form onSubmit={envoyer} className="crd !gap-3" noValidate>
          <Field label={t('Titre')} htmlFor="ad-news-t">
            <Input id="ad-news-t" maxLength={80} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={t('Nouveau : les promotions')} />
          </Field>
          <Field label={t('Texte')} htmlFor="ad-news-b">
            <Textarea id="ad-news-b" maxLength={600} rows={4} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t('Ce que les professionnels doivent savoir, en quelques phrases.')} />
          </Field>
          <Field label={t('Lien (facultatif)')} htmlFor="ad-news-u">
            <Input id="ad-news-u" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="/pro/promotions" autoCapitalize="none" spellCheck={false} />
          </Field>
          {lien.trim() && (
            <Field label={t('Texte du bouton')} htmlFor="ad-news-a">
              <Input id="ad-news-a" maxLength={40} value={bouton} onChange={(e) => setBouton(e.target.value)} placeholder={t('Essayer')} />
            </Field>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[1rem]">{t('Prévenir les professionnels (notification)')}</span>
            <Toggle on={prevenir} onChange={setPrevenir} label={t('Prévenir les professionnels')} />
          </div>
          {publier.isError && <ErrorMessage error={publier.error} />}
          {msg && <p className="text-[1rem] font-medium">{msg}</p>}
          <Button icon={ICONE.publier} type="submit" loading={publier.isPending} disabled={publier.isPending}>
            {t('Publier')}
          </Button>
        </form>
      )}

      {list.isError && <ErrorMessage error={list.error} retry={() => void list.refetch()} />}
      {list.isPending && <Skeleton className="h-[8rem] w-full !rounded-[var(--radius-card)]" />}
      {list.data && list.data.items.length === 0 && <p className="p">{t('Aucune publication pour le moment.')}</p>}
      {list.data && list.data.items.length > 0 && (
        <div className="lst">
          {list.data.items.map((n) => (
            <div key={n.id} className="lst-r !items-start">
              <span className="lst-t">
                {n.title}
                <small>
                  {formatDateShortDZ(n.createdAt)} · {n.body}
                  {n.url ? ` · ${n.url}` : ''}
                </small>
              </span>
              {owner && (
                <button type="button" className="ad-ic" aria-label={t('Retirer')} disabled={retirer.isPending} onClick={() => retirer.mutate(n.id)}>
                  <I icon={Trash2} size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
