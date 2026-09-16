/** AUTH 16 / PRO-F 01 — Bienvenue professionnel : photo, promesse, trois garanties, « Créer mon espace pro ». */
import { Link, useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES, writeAuthFlow } from '@/lib/authFlow';
import { Button, I } from '@/components/ui';
import { t } from '@/i18n';

const PROMISES = ['Réservations en ligne 24 h/24', 'Page publique partageable', 'Rappels automatiques à vos clients'];

export function ProWelcome() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const start = () => {
    writeAuthFlow({ role: 'pro', next: '/pro' });
    navigate(session ? '/pro' : '/connexion?role=pro');
  };
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative h-[18rem] flex-none overflow-hidden">
        <img src={DESIGN_IMAGES.pro.src} alt="" className="h-full w-full object-cover" />
        <div className="ovl" />
        <div className="ovl-t">
          <div className="h3 mb-2 !text-white/70">{t("Espace professionnel")}</div>
          <div className="text-[1.714rem] font-bold leading-[1.1] tracking-[-0.8px]">
            {t("Votre agenda,")}
            <br />
            {t("votre page, votre lien.")}
          </div>
        </div>
        <span className="absolute left-3 top-3 rounded-[var(--radius-card-sm)] bg-black/45 px-1.5 py-0.5 text-[0.857rem] text-white/80">{DESIGN_IMAGES.pro.credit}</span>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-10 pt-4">
        <ul className="flex flex-col">
          {PROMISES.map((p) => (
            <li key={p} className="li text-[0.857rem]">
              <span>{p}</span>
              <I icon={Check} size={20} className="text-ok-fg" />
            </li>
          ))}
        </ul>
        <Button onClick={start}>{t("Créer mon espace pro")}</Button>
        <Link to="/connexion?role=pro" className="p text-center">
          {t("Déjà inscrit ? Se connecter")}
        </Link>
      </div>
    </div>
  );
}
