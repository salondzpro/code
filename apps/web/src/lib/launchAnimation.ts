/**
 * Animation d'ouverture de l'APPLICATION MOBILE : le logo Salon DZ apparaît sur fond d'encre, puis
 * l'écran se dissipe. Elle dure 1,6 s au total — l'utilisateur attend déjà le démarrage, on ne lui
 * ajoute pas de délai : elle couvre le temps de chargement au lieu de s'y ajouter, et disparaît dès
 * que l'application est prête si celle-ci arrive avant.
 *
 * Écrite en HTML et CSS bruts, injectée AVANT React : une animation qui attendrait le rendu de
 * l'application ne servirait à rien, puisque c'est précisément ce temps-là qu'elle doit masquer.
 *
 * Sans effet sur le site ouvert dans un navigateur : un visiteur du web n'attend pas un lancement
 * d'application, il attend une page.
 */
const INK = '#111214';
/** Le logo reste lisible ce temps-là, même si l'application est prête avant : sinon on voit un éclair. */
const MIN_VISIBLE_MS = 1200;
const FADE_MS = 400;

let startedAt = 0;
let overlay: HTMLElement | null = null;

export function startLaunchAnimation(): void {
  if (overlay) return;
  startedAt = Date.now();
  const el = document.createElement('div');
  el.id = 'sdz-launch';
  el.innerHTML = `
    <style>
      #sdz-launch{position:fixed;inset:0;z-index:9999;background:${INK};display:flex;align-items:center;
        justify-content:center;flex-direction:column;gap:.75rem;transition:opacity ${FADE_MS}ms ease}
      #sdz-launch.out{opacity:0}
      #sdz-launch .mark{font-family:Inter,system-ui,sans-serif;font-size:2.4rem;line-height:1;
        letter-spacing:-1px;color:#fff;opacity:0;transform:translateY(8px);
        animation:sdz-in .55s cubic-bezier(.2,.7,.3,1) .1s forwards}
      #sdz-launch .mark i{font-style:normal;font-weight:400;color:#9aa0a6;margin-inline-start:.16em}
      #sdz-launch .sub{font-family:Inter,system-ui,sans-serif;font-size:.72rem;letter-spacing:.26em;
        color:#6b7177;opacity:0;animation:sdz-in .5s ease .45s forwards}
      @keyframes sdz-in{to{opacity:1;transform:none}}
      @media (prefers-reduced-motion:reduce){
        #sdz-launch .mark,#sdz-launch .sub{animation-duration:1ms}
      }
    </style>
    <div class="mark"><b style="font-weight:600">Salon</b><i>DZ</i></div>
    <div class="sub">RÉSERVATION EN LIGNE</div>`;
  document.body.appendChild(el);
  overlay = el;
}

/** À appeler quand l'application est affichée : l'écran se dissipe, sans jamais clignoter. */
export function endLaunchAnimation(): void {
  if (!overlay) return;
  const el = overlay;
  overlay = null;
  const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), FADE_MS);
  }, wait);
}
