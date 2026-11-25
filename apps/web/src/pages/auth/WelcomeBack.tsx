/**
 * AUTH 14 — Retour dans l'app : relais sans écran. La session (lien e-mail, connexion, compte déjà
 * ouvert) est lue, puis on entre directement : profil incomplet → création, marché manquant → choix,
 * sinon la page visée. L'ancien « Bon retour, Inès · Continuer » n'apportait rien (16 sept. 2026).
 */
import { estCheminPro } from '@/lib/portail';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useApi, useMe } from '@salondz/api-client';
import { useAuth } from '@/lib/auth';
import { readAuthFlow } from '@/lib/authFlow';
import { supabase } from '@/lib/supabase';
import { PageLoading } from '@/components/PageLoading';
import { APPLI, MARCHE } from '@/lib/flavor';
import { CompteRefuse, estRefusCompte } from '@/components/CompteRefuse';
import { finConnexionExterne } from '@/lib/connexionExterne';
import { trace } from '@/lib/traceConnexion';

/**
 * Jetons arrivés par une PASSATION depuis le navigateur (`lib/appHandoff.ts`). Supabase ne lit le
 * fragment qu'au démarrage du client, en regardant l'adresse de la page : ici on arrive par une
 * navigation INTERNE du routeur, qu'il ne voit pas. Sans ce relais, l'application s'ouvrirait bien
 * mais resterait déconnectée — c'est-à-dire tout ce que la passation devait éviter.
 */
function useSessionDepuisFragment(session: unknown): 'inutile' | 'en-cours' | 'fini' {
  /**
   * « en-cours » DÈS LE PREMIER RENDU quand le fragment porte des jetons (24 nov. 2026). L'état
   * partait de « inutile » et n'était corrigé que par l'effet ci-dessous : au premier rendu, sans
   * session, la page rendait `<Navigate to="/connexion">`, dont l'effet passe AVANT celui du parent —
   * les jetons étaient perdus et l'application retombait sur son écran d'ouverture (« Commencer »)
   * au retour de Google, sur iPhone comme sur Android.
   */
  const [etat, setEtat] = useState<'inutile' | 'en-cours' | 'fini'>(() =>
    !session && /(^|[#&])refresh_token=/.test(window.location.hash) ? 'en-cours' : 'inutile',
  );
  useEffect(() => {
    if (session) return;
    const f = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const access_token = f.get('access_token');
    const refresh_token = f.get('refresh_token');
    if (!access_token || !refresh_token) return;
    setEtat('en-cours');
    trace('setSession');
    void supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ data, error }) => trace('setSession-fin', { ok: !!data.session, err: error?.message }))
      .catch((e) => trace('setSession-exc', { m: String((e as Error)?.message ?? e) }))
      .finally(() => {
        finConnexionExterne();
        // Les jetons ne doivent pas rester dans la barre d'adresse ni dans l'historique.
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        setEtat('fini');
      });
  }, [session]);
  return etat;
}

export function WelcomeBack() {
  const [params] = useSearchParams();
  const { session, loading } = useAuth();
  const me = useMe(!!session);
  // Page d'atterrissage des liens e-mail : la session arrive dans l'URL et met un instant à
  // être lue. Rediriger avant la fin du chargement renvoyait sur la connexion à chaque lien.
  // Lien expiré ou déjà utilisé : Supabase le dit dans le fragment de l'URL. On le traduit
  // sur l'écran de connexion plutôt que d'y arriver sans explication.
  const reprise = useSessionDepuisFragment(session);
  trace('retour-rendu', { reprise, session: !!session, loading, jetons: /refresh_token/.test(window.location.hash), me: me.status, err: (me.error as { code?: string } | null)?.code, next: params.get('next') });
  const hashErr = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  // Session en cours d'installation depuis les jetons : on attend, sinon on repartirait sur la
  // connexion alors que tout est là.
  if (reprise === 'en-cours') return <PageLoading />;
  if (!session && (hashErr.get('error') || hashErr.get('error_code')))
    return <Navigate to={`/connexion?erreur=${encodeURIComponent(hashErr.get('error_code') ?? hashErr.get('error') ?? 'lien')}`} replace />;
  if (loading) return <PageLoading />;
  if (!session) return <Navigate to="/connexion" replace />;
  // L'application connaît son portail ; sur le site : `portail=` de l'adresse, sinon la destination.
  const portailParam = params.get('portail');
  const nextBrut = params.get('next') ?? readAuthFlow()?.next ?? '';
  const attendu = APPLI ?? (portailParam === 'pro' || portailParam === 'client' ? portailParam : estCheminPro(nextBrut) ? 'pro' : 'client');
  // Retour de Google / Apple (25 nov. 2026) : d'abord le compte DU PORTAIL emprunté, jamais celui de
  // l'autre côté que Supabase a ouvert parce qu'il porte la même adresse.
  if (params.get('oauth') === '1' || params.get('google') === '1') return <ComptePortail portail={attendu} />;
  // Profil injoignable (réseau) : on entre quand même, les gardes des pages feront le reste.
  if (!me.data && !me.isError) return <PageLoading />;

  const profile = me.data?.profile;
  const next = params.get('next') ?? readAuthFlow()?.next ?? (profile?.role === 'pro' ? '/pro' : MARCHE);
  const q = `?next=${encodeURIComponent(next)}`;
  // SÉPARATION STRICTE (16 nov. 2026) : un lien ne fait entrer que dans le portail de SON type —
  // celui de l'application, sinon celui de la destination. Sinon : session fermée, message de refus.
  const refuse = estRefusCompte(me.error);
  if (refuse) return <CompteRefuse cote={refuse} />;
  if (!next.startsWith('/admin') && profile && (profile.role === 'pro') !== (attendu === 'pro')) return <CompteRefuse cote={attendu} />;
  // Sans profil (erreur réseau), on ne sait rien de la personne : la renvoyer sur « créer son profil »
  // montrait un formulaire vide à un compte existant. On entre, et le garde de la page tranchera.
  if (me.isError) return <Navigate to={next} replace />;
  // Le nom, le numéro et le marché servent à RÉSERVER. Qui entre dans l'administration ne réserve
  // rien : on ne lui réclame pas de quoi être rappelé pour un rendez-vous qu'il ne prendra pas.
  // Rien à contourner ici — c'est `requireAdmin`, côté serveur, qui ouvre ou non la porte.
  if (!next.startsWith('/admin')) {
    // Nom et numéro exigés de tous (17 nov. 2026).
    if (!profile?.fullName || !profile.phone) return <Navigate to={`/profil/creer${q}`} replace />;
    if (profile.role !== 'pro' && !profile.market) return <Navigate to={`/marche${q}`} replace />;
  }
  return <Navigate to={next} replace />;
}

/**
 * Retour de Google / Apple : le serveur rend le compte DU PORTAIL emprunté (`POST /auth/oauth-portail`)
 * — le même s'il est du bon type, sinon celui de la même adresse de ce côté-ci (créé au besoin), avec
 * une nouvelle session. Puis on relit tout, sans `oauth=1` dans l'adresse.
 */
function ComptePortail({ portail }: { portail: 'client' | 'pro' }) {
  const { api } = useApi();
  const qc = useQueryClient();
  const [refus, setRefus] = useState(false);
  const navigate = useNavigate();
  const lance = useRef(false);
  useEffect(() => {
    if (lance.current) return;
    lance.current = true;
    void (async () => {
      try {
        const r = await api.auth.oauthPortail({ portail });
        if (r.switched) {
          const { error } = await supabase.auth.setSession({ access_token: r.accessToken, refresh_token: r.refreshToken });
          if (error) throw error;
        }
        trace('oauth-portail', { portail, switched: r.switched });
        qc.clear();
        const u = new URL(window.location.href);
        u.searchParams.delete('google');
        u.searchParams.delete('oauth');
        // Le routeur doit voir l'adresse sans `oauth=1` : navigation interne, état conservé.
        navigate(u.pathname + u.search, { replace: true });
      } catch (e) {
        trace('oauth-portail-refus', { portail, m: String((e as Error)?.message ?? e) });
        setRefus(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (refus) return <CompteRefuse cote={portail} />;
  return <PageLoading />;
}
