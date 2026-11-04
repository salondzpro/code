/**
 * Clavier du téléphone : le champ en cours de saisie doit rester visible.
 *
 * Selon le système, le clavier réduit la fenêtre (Android) ou passe par-dessus (iPhone). Dans les deux
 * cas `visualViewport` dit ce qu'il reste à l'écran. On publie :
 *   - `--kb` : la hauteur que le clavier recouvre (0 quand la fenêtre a rétréci) ;
 *   - `html[data-kb]` : un clavier est ouvert, la barre du bas et les barres d'action s'effacent.
 * Le champ touché est ensuite ramené dans la zone visible. Rien ne prend le focus ici.
 */
const OPEN_MIN_PX = 120;
const KEYBOARD_DELAY_MS = 320;

const editable = (el: EventTarget | null): el is HTMLElement =>
  el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable);

export function watchKeyboard(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  let tallest = vv.height;

  /** Centre le champ dans ce qui reste visible, s'il en sort. Dans une feuille, c'est elle qui défile. */
  const reveal = () => {
    const el = document.activeElement;
    if (!editable(el)) return;
    const box = el.getBoundingClientRect();
    const top = vv.offsetTop + 8;
    const bottom = vv.offsetTop + vv.height - 8;
    if (box.top >= top && box.bottom <= bottom) return;
    if (el.closest('.sheet.modal, .h11-sheet')) el.scrollIntoView({ block: 'nearest' });
    else window.scrollBy({ top: box.top + box.height / 2 - (top + bottom) / 2 });
  };

  let wasOpen = false;
  const apply = () => {
    tallest = Math.max(tallest, vv.height);
    const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    const open = editable(document.activeElement) && tallest - vv.height > OPEN_MIN_PX;
    root.style.setProperty('--kb', open ? `${covered}px` : '0px');
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
