/**
 * Clavier du téléphone : le champ en cours de saisie, et ce qui l'accompagne, doivent rester VISIBLES.
 *
 * Selon le système, le clavier réduit la fenêtre (Android) ou passe par-dessus (iPhone). Dans les deux
 * cas `visualViewport` dit ce qu'il reste à l'écran. On publie sur `<html>` :
 *   - `html[data-kb]` : un clavier est ouvert, la barre du bas et les barres d'action s'effacent ;
 *   - `--kb` : la hauteur que le clavier recouvre (0 quand la fenêtre a rétréci), barre d'iOS comprise ;
 *   - `--vv-top` / `--vv-h` : le haut et la hauteur de la zone RÉELLEMENT visible.
 *
 * RÈGLE (13 nov. 2026, après une capture du propriétaire) : une fenêtre du bas (`.sheet.modal`) ne
 * reste PAS collée au clavier. Sur iPhone, iOS pose au-dessus du clavier sa barre flottante
 * (« ↑ ↓ ✓ ») que `visualViewport` ne retranche pas : une fenêtre accrochée au bas se retrouvait
 * dessous, son champ de recherche caché. Clavier ouvert, la fenêtre se place EN HAUT de la zone
 * visible (CSS, bloc « Clavier ouvert » de `index.css`), et l'on garde une marge pour cette barre.
 * Le champ touché est ensuite ramené dans la zone visible. Rien ne prend le focus ici.
 */
const OPEN_MIN_PX = 120;
const KEYBOARD_DELAY_MS = 320;
/** Barre flottante d'iOS au-dessus du clavier (flèches et « OK »), absente des mesures du navigateur. */
const IOS_ACCESSORY_PX = 56;

const editable = (el: EventTarget | null): el is HTMLElement =>
  el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable);

const estIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function watchKeyboard(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const barre = estIOS() ? IOS_ACCESSORY_PX : 0;
  let tallest = vv.height;

  /** Ramène le champ dans ce qui reste visible (barre d'iOS déduite). Dans une feuille, c'est elle qui défile. */
  const reveal = () => {
    const el = document.activeElement;
    if (!editable(el)) return;
    const box = el.getBoundingClientRect();
    const top = vv.offsetTop + 8;
    const bottom = vv.offsetTop + vv.height - barre - 8;
    if (box.top >= top && box.bottom <= bottom) return;
    const feuille = el.closest<HTMLElement>('.sheet.modal, .h11-sheet');
    if (feuille) {
      const f = feuille.getBoundingClientRect();
      feuille.scrollBy({ top: box.top - f.top - 72 });
    } else window.scrollBy({ top: box.top + box.height / 2 - (top + bottom) / 2 });
  };

  let wasOpen = false;
  const apply = () => {
    tallest = Math.max(tallest, vv.height);
    const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    const open = editable(document.activeElement) && tallest - vv.height > OPEN_MIN_PX;
    root.style.setProperty('--kb', open ? `${covered + barre}px` : '0px');
    root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
    root.style.setProperty('--vv-h', `${Math.round(vv.height - (open ? barre : 0))}px`);
    root.toggleAttribute('data-kb', open);
    // Le clavier arrive quand il veut : c'est son arrivée qui déclenche, avec un temps pour la mise en page.
    if (open && !wasOpen) window.setTimeout(reveal, 60);
    wasOpen = open;
  };

  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  // Rotation de l'écran : la hauteur de référence change.
  window.addEventListener('orientationchange', () => {
    tallest = 0;
    window.setTimeout(apply, 400);
  });
  // Clavier déjà ouvert : on passe d'un champ à l'autre.
  document.addEventListener('focusin', (e) => {
    if (!editable(e.target)) return;
    window.setTimeout(() => {
      apply();
      reveal();
    }, KEYBOARD_DELAY_MS);
  });
  // Plus de champ actif = plus de clavier : la barre du bas revient quoi qu'il arrive.
  document.addEventListener('focusout', () => {
    window.setTimeout(apply, 100);
    window.setTimeout(apply, 500);
  });
}
