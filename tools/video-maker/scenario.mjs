/**
 * Le scénario : ce qu'on dit et ce qu'on touche. Les boutons sont trouvés par leur rôle et leur texte, à
 * l'écran, jamais par leur position : si un écran change de forme, la vidéo suit toute seule. Si un bouton
 * disparaît ou change de nom, l'outil s'arrête et dit lequel, au lieu de sortir une vidéo fausse.
 */
export const PROFILES = {
  hommes: { slug: 'karim-barber-club', handle: 'karimbarberclub', name: 'Karim Barber Club', job: 'Barbier', city: 'Alger-Centre', client: 'Yacine Mansouri', confirmed: true, photos: ['cover-hommes', 'h-coupe-barbe', 'h-barbe', 'h-coupe', 'h-tracage', 'h-coupe-mariage'] },
  femmes: { slug: 'yasmine-beauty-studio', handle: 'yasminebeautystudio', name: 'Yasmine Beauty Studio', job: 'Institut de beauté', city: 'Hydra', client: 'Sarah Benali', confirmed: false, photos: ['cover-femmes', 'f-brushing', 'f-coloration', 'f-pose-gel', 'f-nail-art', 'f-coupe'] },
};

/** Le texte dit par la voix off, scène par scène. */
export const narration = (p) => ({
  bio: `Pour réserver chez ${p.name}, c'est simple. Touchez le lien dans la bio.`,
  page: 'La page du salon s\'ouvre, avec les prestations et les prix.',
  service: 'Choisissez votre prestation.',
  slot: 'Puis le jour, et l\'heure qui vous arrange.',
  who: 'Laissez votre nom et votre numéro.',
  done: p.confirmed ? "Et voilà, c'est réservé. Vous recevrez un rappel avant votre rendez-vous." : 'Et voilà. Le salon confirme votre rendez-vous.',
  end: `${p.name}. Réservez en trente secondes, le lien est dans la bio.`,
});

export const TITLES = {
  bio: (p) => ({ note: `instagram · @${p.handle}`, a: 'Réserver chez', b: '', c: `${p.name} ?` }),
  page: (p) => ({ note: `salondz.com/${p.slug}`, a: 'Le lien de', b: 'notre', c: 'bio.' }),
  service: () => ({ note: 'étape 1 sur 3', a: 'Choisissez', b: 'votre', c: 'prestation.' }),
  slot: () => ({ note: 'étape 2 sur 3', a: 'Le jour,', b: 'puis l’', c: 'heure.' }),
  who: () => ({ note: 'étape 3 sur 3', a: 'Votre nom,', b: 'votre', c: 'numéro.' }),
  done: (p) => (p.confirmed ? { note: 'rendez-vous confirmé', a: 'Et voilà.', b: 'C’est', c: 'réservé.' } : { note: 'demande envoyée', a: 'Et voilà.', b: 'On vous', c: 'confirme.' }),
};

/** Le parcours, sur le vrai site. `s` donne les gestes filmés : scene, tap, type, scroll, pause. */
export async function play(s, page) {
  await s.scene('bio');
  await s.pause(1200);
  await s.tap(page.locator('a#bio-link'), 'le lien de la bio');
  await page.waitForURL(/\/s\//, { timeout: 15000 });
  await page.getByRole('button', { name: 'Choisir' }).first().waitFor({ timeout: 15000 });

  await s.scene('page');
  await s.pause(900);

  await s.scene('service');
  await s.scroll(page.getByRole('button', { name: 'Choisir' }).first());
  await s.pause(700);
  await s.tap(page.getByRole('button', { name: 'Choisir' }).first(), '« Choisir »');
  await page.waitForURL(/reserver\/quand/, { timeout: 15000 });
  await page.locator('button').filter({ hasText: /^\d\d:\d\d$/ }).first().waitFor({ timeout: 15000 });

  await s.scene('slot');
  await s.pause(900);
  await s.tap(page.locator('button').filter({ hasText: /^\d\d:\d\d$/ }).nth(3), 'une heure');
  await s.pause(800);
  await s.tap(page.getByRole('button', { name: /^Continuer/ }), '« Continuer »');
  await page.waitForURL(/reserver\/coordonnees/, { timeout: 15000 });

  await s.scene('who');
  await s.pause(600);
  await s.tap(page.getByText(/quelqu.un d.autre/i), '« Pour quelqu’un d’autre »');
  await s.pause(400);
  await s.type(page.getByRole('textbox').nth(0), s.profile.client, 'le nom');
  await s.type(page.getByRole('textbox').nth(1), '555000000', 'le numéro');
  await s.pause(500);
  await s.tap(page.getByRole('button', { name: /^Vérifier/ }), '« Vérifier »');
  await s.pause(1200);
  await s.tap(page.getByRole('button', { name: /^Confirmer/ }).last(), '« Confirmer »');

  await s.scene('done');
  await page.getByText(/Rendez-vous confirmé|Demande envoyée/).first().waitFor({ timeout: 15000 });
  await s.pause(1500);
}
