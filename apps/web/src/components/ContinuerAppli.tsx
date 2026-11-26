/**
 * « CONTINUER DANS L'APPLICATION » (26 nov. 2026, demande du propriétaire : « comme Uber Eats »).
 *
 * Sur le SITE ouvert dans un téléphone, la connexion se fait et reste sur le site : la personne entre
 * dans son espace. JUSTE APRÈS, une fenêtre propose l'application du bon portail — Salon DZ pour une
 * cliente, Salon DZ Pro pour un professionnel — avec deux choix : l'ouvrir, ou rester sur le site.
 *
 * « Ouvrir l'application » lui REMET LA SESSION (même passation que `lib/appHandoff.ts` : schéma
 * `salondz://` / `salondzpro://` sur iPhone, `intent://…;package=` sur Android) et l'ouvre sur la page
 * où l'on est. Application absente : le store du téléphone. Une fois l'application ouverte, le
 * navigateur OUBLIE sa copie de la session (sinon les deux la renouvelleraient et Supabase fermerait
 * celle de l'application). Proposée une seule fois par connexion (`demanderContinuerAppli`).
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { handoffUrl } from '@/lib/appHandoff';
import { estCheminPro } from '@/lib/portail';
import { APP_STORE_PRO_URL, APP_STORE_URL, PLAY_STORE_PRO_URL, PLAY_STORE_URL } from '@/lib/appLinks';
import { isNative } from '@/lib/native';
import { BottomSheet, Button, Dim } from './ui';
import { t } from '@/i18n';

const CLE = 'salondz:continuer-appli';

const telephone = (): 'ios' | 'android' | null => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
};

/** À appeler juste après une connexion réussie SUR LE SITE (retour de Google, mot de passe, lien). */
export function demanderContinuerAppli(portail: 'client' | 'pro'): void {
  if (isNative() || !telephone()) return;
  try {
    sessionStorage.setItem(CLE, portail);
  } catch {
    /* stockage indisponible : pas de proposition */
  }
}

export function ContinuerAppli() {
  const { pathname, search } = useLocation();
  const [portail, setPortail] = useState<'client' | 'pro' | null>(null);
  const [ouverture, setOuverture] = useState(false);

  // On attend d'être ARRIVÉ dans l'espace (pas sur l'écran de retour ni sur un écran de connexion).
  useEffect(() => {
    if (isNative() || pathname.startsWith('/connexion') || pathname.includes('/acces')) return;
    let v: string | null = null;
    try {
      v = sessionStorage.getItem(CLE);
    } catch {
      return;
    }
    if (v !== 'client' && v !== 'pro') return;
    // Le portail se confirme sur la page atteinte : un pro arrive sous /pro, une cliente ailleurs.
    setPortail(estCheminPro(pathname) ? 'pro' : 'client');
  }, [pathname]);

  const fermer = () => {
    try {
      sessionStorage.removeItem(CLE);
    } catch {
      /* rien */
    }
    setPortail(null);
  };

  if (!portail) return null;
  const os = telephone();
  if (!os) return null;
  const pro = portail === 'pro';
  const store = pro ? (os === 'ios' ? APP_STORE_PRO_URL : PLAY_STORE_PRO_URL) : os === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;

  const ouvrir = async () => {
    setOuverture(true);
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    const ici = `${pathname}${search}`;
    // Avec la session : l'application s'ouvre CONNECTÉE, sur la même page.
    const dest = s
      ? `/connexion/retour?next=${encodeURIComponent(ici)}&portail=${portail}#access_token=${encodeURIComponent(s.access_token)}&refresh_token=${encodeURIComponent(s.refresh_token)}&token_type=bearer&type=handoff`
      : ici;
    fermer();
    const oublier = () => {
      if (document.visibilityState !== 'hidden') return;
      document.removeEventListener('visibilitychange', oublier);
      // L'application a pris la main : le navigateur oublie sa copie (sans appel au serveur, qui fermerait aussi celle de l'application).
      try {
        localStorage.removeItem('salondz-auth');
      } catch {
        /* rien */
      }
    };
    document.addEventListener('visibilitychange', oublier);
    const t0 = Date.now();
    window.location.href = handoffUrl(navigator.userAgent, dest, store);
    // iPhone : rien ne s'est ouvert au bout de 1,6 s → l'application n'est pas installée → App Store.
    if (os === 'ios')
      window.setTimeout(() => {
        if (document.visibilityState !== 'hidden' && Date.now() - t0 < 4000) window.location.href = store;
        setOuverture(false);
      }, 1600);
  };

  return (
    <>
      <Dim onClose={fermer} />
      <BottomSheet modal>
        <div className="flex flex-col items-center gap-3 pt-1 text-center">
          <img src={pro ? '/logo/app-pro.png' : '/logo/app-client.png'} alt="" width={64} height={64} className="rounded-[16px]" />
          <h2 className="text-[1.25rem] font-semibold">{pro ? t('Continuez dans Salon DZ Pro') : t('Continuez dans l’application Salon DZ')}</h2>
          <p className="text-[0.938rem] text-muted">{pro ? t('Votre agenda et vos demandes, plus rapides, avec les notifications.') : t('Vos rendez-vous, rappels et notifications, plus rapides.')}</p>
        </div>
        <Button icon={Smartphone} loading={ouverture} onClick={() => void ouvrir()}>
          {t('Ouvrir l’application')}
        </Button>
        <button type="button" className="py-2 text-[1rem] text-muted underline" onClick={fermer}>
          {t('Continuer sur le site')}
        </button>
      </BottomSheet>
    </>
  );
}
