/** AUTH 02 — Introduction : photo plein cadre, accroche, « Commencer » / « Je suis professionnel ». */
import { Link } from 'react-router';
import { DESIGN_IMAGES } from '@/lib/authFlow';
import { LinkButton } from '@/components/ui';

export function Intro() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="relative h-[470px] flex-none overflow-hidden">
        <img src={DESIGN_IMAGES.intro.src} alt="" className="h-full w-full object-cover" />
        <div className="ovl" />
        <div className="ovl-t">
          <div className="text-[30px] font-bold leading-[1.1] tracking-[-0.8px]">
            Réservez votre
            <br />
            rendez-vous beauté.
          </div>
        </div>
        <span className="absolute bottom-2 left-3 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] text-white/80">{DESIGN_IMAGES.intro.credit}</span>
      </div>
      <div className="flex flex-col gap-3.5 px-5 pb-10 pt-5">
        <p className="p">Barbiers, coiffure, ongles, cils, soins et laser — près de vous, avec les disponibilités en temps réel.</p>
        <div className="flex items-center justify-center gap-1.5 py-1" aria-hidden>
          <span className="h-1.5 w-5 rounded-full bg-ink" />
          <span className="h-1.5 w-1.5 rounded-full bg-line" />
          <span className="h-1.5 w-1.5 rounded-full bg-line" />
        </div>
        <LinkButton to="/bienvenue">Commencer</LinkButton>
        <Link to="/pro/bienvenue" className="btn g">
          Je suis professionnel
        </Link>
      </div>
    </div>
  );
}
