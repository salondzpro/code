/**
 * LIEN D'E-MAIL → TOUJOURS L'APPLICATION (20 nov. 2026, demande du propriétaire), client comme pro,
 * quel que soit l'e-mail (confirmation d'inscription, lien de connexion, mot de passe oublié).
 *
 * Un seul point d'entrée : l'API écrit dans l'e-mail `https://salondz.com/pro/lien?…` (compte pro) ou
 * `https://salondz.com/rendez-vous/lien?…` (compte client) — deux adresses que l'application
 * concernée RÉCLAME déjà (liens universels iOS, App Links Android) : le système ouvre l'application
 * directement, sans navigateur. Le jeton n'est pas encore consommé : c'est la page qui le vérifie
 * (`verifyOtp`), là où elle s'ouvre.
 *   1. Dans l'application → vérification, puis la suite (`r`, ex. `/connexion/retour?next=/pro`).
 *   2. Dans le navigateur d'un TÉLÉPHONE (lien ouvert par Gmail, Outlook…) → on réveille
 *      l'application avec la même adresse (`handoffUrl` : `intent://` Android avec repli, schéma
 *      iOS) ; si la page est encore à l'écran 1,6 s plus tard, l'application n'est pas là : on
 *      vérifie dans le navigateur et l'on continue sur le site.
 *   3. Sur ordinateur → vérification et suite sur le site.
 * Un jeton ne sert qu'UNE fois : il n'est jamais vérifié à deux endroits.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { handoffUrl } from '@/lib/appHandoff';
import { PageLoading } from '@/components/PageLoading';
import { Clock } from 'lucide-react';
import { EmptyState, LinkButton } from '@/components/ui';
import { ICONE } from '@/lib/actionIcons';
import { t } from '@/i18n';

const TYPES: EmailOtpType[] = ['signup', 'magiclink', 'recovery', 'invite', 'email_change', 'email'];

const dansLApplication = (): boolean =>
  Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
const surMobile = (): boolean => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

export function EmailLink() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fait = useRef(false);
  const [echec, setEchec] = useState(false);
  const pro = window.location.pathname.startsWith('/pro');

  useEffect(() => {
    if (fait.current) return;
    fait.current = true;
    const token = params.get('t') ?? '';
    const type = (TYPES.includes(params.get('type') as EmailOtpType) ? params.get('type') : 'magiclink') as EmailOtpType;
    // La suite : un chemin de NOTRE site, jamais une adresse extérieure.
    const r = params.get('r') ?? '';
    const suite = r.startsWith('/') && !r.startsWith('//') ? r : pro ? '/connexion/retour?next=%2Fpro' : '/connexion/retour?next=%2F';
    if (!token) return setEchec(true);

    const verifier = async () => {
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type });
      if (error) return setEchec(true);
      navigate(suite, { replace: true });
    };

    if (dansLApplication() || !surMobile() || params.get('web') === '1') {
      void verifier();
      return;
    }
    // Navigateur d'un téléphone : l'application d'abord.
    const ici = `${window.location.pathname}${window.location.search}`;
    const repli = new URL(window.location.href);
    repli.searchParams.set('web', '1');
    window.location.href = handoffUrl(navigator.userAgent, ici, repli.toString());
    const minuterie = window.setTimeout(() => {
      // Toujours là : pas d'application (iPhone sans l'appli, ou ouverture refusée) → le site.
      if (document.visibilityState === 'visible') void verifier();
    }, 1600);
    return () => window.clearTimeout(minuterie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (echec)
    return (
      <div className="h-app flex items-center justify-center px-4">
        <EmptyState
          icon={Clock}
          title={t('Ce lien a expiré ou a déjà servi')}
          description={t('Connectez-vous avec votre adresse e-mail et votre mot de passe, ou demandez un nouveau lien.')}
          action={
            <LinkButton to={pro ? '/pro/acces' : '/acces'} icon={ICONE.seConnecter}>
              {t('Se connecter')}
            </LinkButton>
          }
        />
      </div>
    );
  return <PageLoading />;
}
