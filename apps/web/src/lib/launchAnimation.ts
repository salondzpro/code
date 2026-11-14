/**
 * OUVERTURE DE L'APPLICATION MOBILE (refaite le 14 nov. 2026, « premium, façon Apple et Uber »),
 * Salon DZ comme Salon DZ Pro.
 *
 * Le fil, en ~1,8 s, sur l'encre de l'écran natif de démarrage :
 *   1. la marque est DÉJÀ là, à la place exacte où l'écran natif l'a posée — aucun saut entre le natif
 *      et la page, on enchaîne au lieu de recommencer ;
 *   2. un halo de lumière chaude s'éveille derrière elle et respire lentement ;
 *   3. un reflet traverse le logo, une fois ;
 *   4. le badge PRO (application professionnelle) se pose, puis la phrase, dans la langue choisie ;
 *   5. un trait fin se remplit en bas, au-dessus de l'indicateur d'accueil ;
 *   6. sortie : le contenu s'avance vers soi en se dissipant, le fond s'efface — l'application est là.
 *
 * Écrite en HTML et CSS bruts, injectée AVANT React : elle couvre le temps de chargement au lieu de
 * s'y ajouter, et part dès que l'application est prête (après un minimum, pour ne jamais clignoter).
 * Plein écran, derrière la barre d'état (texte de la barre en BLANC pendant l'ouverture, remis en
 * sombre à la sortie). Uniquement `transform`, `opacity` et `filter`. `prefers-reduced-motion` :
 * apparition simple, sans mouvement. Sans effet sur le site ouvert dans un navigateur.
 */
import { PRO_ONLY } from './flavor';

const INK = '#111214';
/** Le temps de lire la marque et la phrase, même si l'application est prête avant. */
const MIN_VISIBLE_MS = 1700;
const SORTIE_MS = 560;

const PHRASES: Record<string, { client: string; pro: string; dir: 'ltr' | 'rtl' }> = {
  fr: { client: 'Votre salon, réservé en quelques secondes', pro: 'Votre salon, au bout des doigts', dir: 'ltr' },
  ar: { client: 'صالونك، محجوز في ثوانٍ', pro: 'صالونك بين يديك', dir: 'rtl' },
  en: { client: 'Your salon, booked in seconds', pro: 'Your salon, at your fingertips', dir: 'ltr' },
};

let startedAt = 0;
let overlay: HTMLElement | null = null;

function langue(): keyof typeof PHRASES {
  try {
    const l = localStorage.getItem('salondz:locale');
    if (l === 'ar' || l === 'en' || l === 'fr') return l;
  } catch {
    /* stockage indisponible */
  }
  const n = (navigator.language || 'fr').toLowerCase();
  return n.startsWith('ar') ? 'ar' : n.startsWith('en') ? 'en' : 'fr';
}

/** Texte de la barre d'état : blanc sur l'encre pendant l'ouverture, sombre ensuite. */
function barreEtat(clair: boolean): void {
  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: clair ? Style.Dark : Style.Light }))
    .catch(() => undefined);
}

export function startLaunchAnimation(): void {
  if (overlay) return;
  startedAt = Date.now();
  const p = PHRASES[langue()]!;
  const el = document.createElement('div');
  el.id = 'sdz-launch';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <style>
      @font-face{font-family:SdzJak;font-weight:200 800;font-display:block;src:url(/fonts/jakarta-latin.woff2) format('woff2')}
      @font-face{font-family:SdzInter;font-weight:600;font-display:block;src:url(/fonts/inter-600.woff2) format('woff2')}
      @font-face{font-family:SdzInter;font-weight:400;font-display:block;src:url(/fonts/inter-400.woff2) format('woff2')}
      @font-face{font-family:SdzCairo;font-display:block;src:url(/fonts/cairo-arabic.woff2) format('woff2')}
      #sdz-launch{position:fixed;inset:0;z-index:2147483000;background:${INK};overflow:hidden;
        font-family:SdzJak,Inter,-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased;
        transition:opacity ${SORTIE_MS}ms cubic-bezier(.4,0,.2,1)}
      #sdz-launch .scene{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        transition:transform ${SORTIE_MS}ms cubic-bezier(.4,0,.2,1),filter ${SORTIE_MS}ms ease,opacity ${SORTIE_MS}ms ease}
      /* Halo : lumière chaude et froide qui s'éveillent derrière la marque, puis respirent. */
      #sdz-launch .halo{position:absolute;left:50%;top:50%;width:150vmin;height:150vmin;margin:-75vmin 0 0 -75vmin;
        background:radial-gradient(closest-side,rgba(236,220,200,.20),rgba(236,220,200,.06) 45%,transparent 70%),
          conic-gradient(from 0deg,rgba(255,255,255,0),rgba(214,224,240,.10),rgba(255,255,255,0) 40%,rgba(236,220,200,.10) 70%,rgba(255,255,255,0));
        filter:blur(30px);opacity:0;transform:scale(.6);
        animation:sdz-halo-in 1.1s cubic-bezier(.2,.8,.2,1) .05s forwards,sdz-halo-tourne 9s linear 1.1s infinite}
      #sdz-launch .bloc{position:relative;display:flex;flex-direction:column;align-items:center}
      #sdz-launch .mark{position:relative;font-family:SdzInter,Inter,-apple-system,system-ui,sans-serif;font-size:2.4rem;line-height:1;letter-spacing:-.045em;color:#fff;white-space:nowrap}
      #sdz-launch .mark b{font-weight:600}
      #sdz-launch .mark i{font-style:normal;font-weight:400;color:#9aa0a6;margin-inline-start:.18em}
      /* Reflet : une bande de lumière traverse le logo, une seule fois. */
      #sdz-launch .mark::after{content:'';position:absolute;inset:-20% -30%;
        background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.55) 50%,transparent 62%);
        mix-blend-mode:overlay;transform:translateX(-120%);animation:sdz-reflet 1.1s cubic-bezier(.5,0,.2,1) .35s forwards}
      #sdz-launch .pro{position:absolute;top:50%;left:100%;margin:-.62rem 0 0 .55rem;padding:.28rem .55rem;border-radius:999px;
        background:#fff;color:${INK};font-size:.72rem;font-weight:700;letter-spacing:.04em;opacity:0;transform:scale(.6);
        animation:sdz-pop .5s cubic-bezier(.3,1.4,.5,1) .55s forwards}
      #sdz-launch .sub{position:absolute;top:calc(100% + 1.1rem);left:50%;width:max-content;max-width:80vw;
        transform:translate(-50%,10px);font-size:.95rem;font-weight:500;letter-spacing:-.01em;color:rgba(255,255,255,.62);
        opacity:0;filter:blur(6px);animation:sdz-sub .7s cubic-bezier(.2,.8,.2,1) .7s forwards}
      #sdz-launch .sub[dir=rtl]{font-family:SdzCairo,sans-serif;font-size:1.02rem}
      /* Trait de chargement, au-dessus de l'indicateur d'accueil. */
      #sdz-launch .ligne{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 104px);width:44px;height:2px;
        margin-left:-22px;border-radius:999px;background:rgba(255,255,255,.12);overflow:hidden;opacity:0;animation:sdz-fade .4s ease .8s forwards}
      #sdz-launch .ligne i{position:absolute;inset:0;border-radius:inherit;background:rgba(255,255,255,.85);
        transform:translateX(-100%);animation:sdz-charge 1.2s cubic-bezier(.6,0,.2,1) .85s forwards}
      /* Sortie : le contenu s'avance et se dissipe, le fond s'efface. */
      #sdz-launch.out{opacity:0}
      #sdz-launch.out .scene{transform:scale(1.12);filter:blur(10px);opacity:0}
      @keyframes sdz-halo-in{to{opacity:1;transform:scale(1)}}
      @keyframes sdz-halo-tourne{to{transform:rotate(360deg)}}
      @keyframes sdz-reflet{to{transform:translateX(120%)}}
      @keyframes sdz-pop{to{opacity:1;transform:none}}
      @keyframes sdz-sub{to{opacity:1;filter:none;transform:translate(-50%,0)}}
      @keyframes sdz-fade{to{opacity:1}}
      @keyframes sdz-charge{to{transform:none}}
      @media (prefers-reduced-motion:reduce){
        #sdz-launch .halo,#sdz-launch .mark::after,#sdz-launch .ligne i{animation:none}
        #sdz-launch .halo{opacity:1;transform:none}
        #sdz-launch .pro,#sdz-launch .sub,#sdz-launch .ligne{animation:sdz-fade .01ms forwards}
        #sdz-launch .sub{filter:none;transform:translate(-50%,0)}
        #sdz-launch.out .scene{transform:none;filter:none}
      }
    </style>
    <div class="scene">
      <span class="halo"></span>
      <div class="bloc">
        <div class="mark" dir="ltr"><b>Salon</b><i>DZ</i>${PRO_ONLY ? '<span class="pro">PRO</span>' : ''}</div>
        <div class="sub" dir="${p.dir}">${PRO_ONLY ? p.pro : p.client}</div>
      </div>
    </div>
    <span class="ligne"><i></i></span>`;
  document.body.appendChild(el);
  overlay = el;
  barreEtat(true);
}

/** À appeler quand l'application est affichée : l'écran se dissipe, sans jamais clignoter. */
export function endLaunchAnimation(): void {
  if (!overlay) return;
  const el = overlay;
  overlay = null;
  const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
  setTimeout(() => {
    el.classList.add('out');
    barreEtat(false);
    setTimeout(() => el.remove(), SORTIE_MS + 40);
  }, wait);
}

/** Vrai tant que l'ouverture est à l'écran (la barre d'état doit alors rester claire). */
export function launchVisible(): boolean {
  return !!document.getElementById('sdz-launch') && !document.getElementById('sdz-launch')!.classList.contains('out');
}
