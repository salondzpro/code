/** AUTH 16 / PRO-F 01 — Bienvenue professionnel : photo, promesse, trois garanties, « Créer mon espace pro ». */
import { Link, useNavigate } from 'react-router';
import { Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DESIGN_IMAGES, writeAuthFlow } from '@/lib/authFlow';
import { Button, I } from '@/components/ui';

const PROMISES = ['Réservations en ligne 24 h/24', 'Page publique partageable', 'Rappels WhatsApp automatiques'];

export function ProWelcome() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const start = () => {
    writeAuthFlow({ role: 'pro', next: '/pro' });
    navigate(session ? '/pro' : '/connexion?role=pro');
  };
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative h-[420px] flex-none overflow-hidden">
        <img src={DESIGN_IMAGES.pro.src} alt="" className="h-full w-full object-cover" />
        <div className="ovl" />
        <div className="ovl-t">
          <div className="h3 mb-2 !text-white/70">Espace professionnel</div>
          <div className="text-[30px] font-bold leading-[1.1] tracking-[-0.8px]">
            Votre agenda,
            <br />
            votre page, votre lien.
          </div>
        </div>
        <span className="absolute bottom-2 left-3 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] text-white/80">{DESIGN_IMAGES.pro.credit}</span>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-10 pt-4">
        <ul className="flex flex-col">
          {PROMISES.map((p) => (
            <li key={p} className="li text-[17px]">
              <span>{p}</span>
              <I icon={Check} size={20} className="text-ok-fg" />
            </li>
          ))}
        </ul>
        <Button onClick={start}>Créer mon espace pro</Button>
        <Link to="/connexion?role=pro" className="p text-center">
          Déjà inscrit ? Se connecter
        </Link>
      </div>
    </div>
  );
}
