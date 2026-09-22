/**
 * Pages légales et aide : CGU (clients et professionnels), politique de confidentialité, mentions légales,
 * aide et contact. Rédigées pour l'Algérie : loi 18-07 (données personnelles, ANPDP), loi 18-05 (commerce
 * électronique), loi 09-03 (protection du consommateur), loi 04-02 (pratiques commerciales, prix en DA),
 * ordonnance 03-05 (droits d'auteur), code civil. Aucune information technique ou confidentielle du projet
 * n'y figure : les prestataires sont décrits par catégorie. Identité de l'éditeur (dénomination, RC, NIF,
 * adresse) à compléter par le propriétaire ; relecture par un conseil recommandée avant l'ouverture.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Mail, MessageCircle, Store } from 'lucide-react';
import { TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { BrandFooter } from '@/components/BrandFooter';

const UPDATED = '18 septembre 2026';
const SUPPORT = 'support@salondz.com';
const CONTACT = 'contact@salondz.com';

/** Identité de l'éditeur : à renseigner par le propriétaire (registre de commerce, NIF, adresse). */
const EDITOR = {
  name: 'Salon DZ',
  legal: '[dénomination sociale et forme juridique à compléter]',
  rc: '[numéro de registre de commerce à compléter]',
  nif: '[numéro d’identification fiscale à compléter]',
  address: '[adresse du siège à compléter], Alger, Algérie',
};

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/" />
      <h1 className="h1">{title}</h1>
      <p className="p -mt-2 text-[0.857rem]">Dernière mise à jour : {UPDATED}</p>
      <div className="flex flex-col gap-5 text-[1rem] leading-[1.55] [&_h2]:mt-2 [&_h2]:text-[1.143rem] [&_h2]:font-semibold [&_h3]:mt-1 [&_h3]:font-semibold [&_p]:text-ink [&_ul]:list-disc [&_ul]:ps-5 [&_li]:mb-1">
        {children}
      </div>
      <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[0.857rem] text-muted">
        <Link to="/cgu">CGU</Link>
        <Link to="/confidentialite">Confidentialité</Link>
        <Link to="/mentions-legales">Mentions légales</Link>
        <Link to="/aide">Aide et contact</Link>
      </nav>
      <BrandFooter />
    </Screen>
  );
}

const Mailto = ({ to }: { to: string }) => <a href={`mailto:${to}`}>{to}</a>;

export function Terms() {
  return (
    <Doc title="Conditions générales d'utilisation">
      <h2>1. Objet et acceptation</h2>
      <p>
        Les présentes conditions générales d'utilisation (« CGU ») régissent l'accès et l'usage de la plateforme Salon DZ, accessible sur
        salondz.com et, le cas échéant, par ses applications mobiles (la « Plateforme »), éditée par {EDITOR.name} (l'« Éditeur »). En
        créant un compte ou en utilisant la Plateforme, vous acceptez ces CGU sans réserve. Si vous ne les acceptez pas, n'utilisez pas la
        Plateforme.
      </p>
      <h2>2. Définitions</h2>
      <ul>
        <li>« Client » : toute personne qui consulte des salons ou réserve une prestation par la Plateforme.</li>
        <li>« Professionnel » : tout salon de coiffure, barbier, institut de beauté ou prestataire assimilé qui présente ses prestations et gère ses rendez-vous sur la Plateforme.</li>
        <li>« Réservation » : demande de rendez-vous adressée par un Client à un Professionnel par la Plateforme, confirmée automatiquement ou manuellement selon les règles du Professionnel.</li>
      </ul>
      <h2>3. Nature du service</h2>
      <p>
        Salon DZ est un service de mise en relation. La Plateforme permet aux Clients de trouver un Professionnel, de consulter ses
        prestations, ses prix et ses disponibilités, et de réserver un rendez-vous ; elle permet aux Professionnels de tenir leur agenda,
        leur clientèle et leur page publique. La prestation elle-même (coupe, soin, etc.) est réalisée par le Professionnel, dans son
        établissement, sous sa seule responsabilité : le contrat de prestation se forme entre le Client et le Professionnel, l'Éditeur n'y
        est pas partie.
      </p>
      <p>
        Aucun paiement n'est encaissé par la Plateforme. Les prix sont affichés par les Professionnels en dinars algériens, toutes taxes
        comprises, conformément à la loi n° 04-02 relative aux pratiques commerciales, et se règlent directement auprès du Professionnel,
        sur place. Le prix affiché au moment de la Réservation est celui qui s'applique, sauf prestation complémentaire demandée sur place
        et acceptée par le Client.
      </p>
      <h2>4. Compte</h2>
      <ul>
        <li>Un compte est nécessaire pour réserver ou proposer des prestations. Il est personnel : une personne, un compte.</li>
        <li>Vous fournissez des informations exactes et à jour : nom, adresse e-mail valide et numéro de téléphone algérien. Le numéro sert à identifier le Client auprès du Professionnel et ne peut plus être modifié librement dès qu'un rendez-vous existe (contactez le support).</li>
        <li>Vous gardez vos identifiants confidentiels et êtes responsable de toute utilisation de votre compte. Prévenez sans délai le support en cas d'usage non autorisé.</li>
        <li>Un compte Client peut être créé à partir de 16 ans, avec l'accord du représentant légal pour les mineurs. Un compte Professionnel est réservé aux personnes majeures agissant pour une activité légalement établie en Algérie.</li>
      </ul>
      <h2>5. Réservations</h2>
      <ul>
        <li>Une Réservation est un engagement : le Client se présente à l'heure convenue ou annule dans le délai fixé par le Professionnel. Les règles de chaque salon (délai d'annulation, possibilité de report, validation manuelle, horizon de réservation) sont affichées avant la confirmation.</li>
        <li>Lorsqu'un Professionnel valide manuellement ses demandes, la Réservation reste « en attente » jusqu'à sa réponse ; le créneau est réservé au Client pendant ce temps. Sans réponse dans le délai indiqué, la demande expire et le Client en est informé.</li>
        <li>Le Client peut annuler ou déplacer un rendez-vous depuis la Plateforme dans les limites fixées par le Professionnel. Le Professionnel peut, de son côté, annuler un rendez-vous en cas d'empêchement ; le Client en est immédiatement informé.</li>
        <li>Les annulations tardives répétées et les absences sans prévenir nuisent aux Professionnels. Elles peuvent entraîner une suspension temporaire de la réservation en ligne ; un Professionnel peut aussi refuser un Client. Les seuils et durées sont indiqués dans l'application.</li>
        <li>Réserver pour une autre personne engage votre responsabilité : vous devez avoir son accord, lui transmettre les informations du rendez-vous et l'informer de la présente politique. Le rendez-vous appartient à la personne concernée.</li>
        <li>Les rappels de rendez-vous sont envoyés par notification (application ou navigateur) à titre de commodité ; leur absence ne dispense pas le Client de son engagement.</li>
      </ul>
      <h2>6. Obligations des Professionnels</h2>
      <ul>
        <li>Vous exercez une activité légalement établie (registre de commerce ou carte d'artisan, selon le cas) et respectez la réglementation applicable à votre profession, notamment en matière d'hygiène, de sécurité et d'affichage des prix.</li>
        <li>Vous garantissez l'exactitude et la mise à jour de votre page : nom, adresse, prestations, durées, prix en dinars, horaires, équipe. Une information trompeuse engage votre responsabilité vis-à-vis des Clients (loi n° 09-03 relative à la protection du consommateur).</li>
        <li>Vous honorez les rendez-vous confirmés ou prévenez le Client sans délai en cas d'empêchement, et vous traitez les demandes en attente dans le délai indiqué.</li>
        <li>Vous détenez les droits sur les photos et textes que vous publiez et vous obtenez l'accord des personnes reconnaissables. Aucun contenu illicite, trompeur ou portant atteinte aux bonnes mœurs.</li>
        <li>Les données de vos Clients accessibles sur la Plateforme (noms, numéros, historique, notes) ne servent qu'à la gestion de vos rendez-vous et à la relation avec votre clientèle. Toute prospection non sollicitée, cession ou usage étranger à cette finalité est interdit et engage votre responsabilité au titre de la loi n° 18-07.</li>
        <li>Vous répondez seul des prestations réalisées, de leur qualité, de leur prix et des litiges avec vos Clients.</li>
      </ul>
      <h2>7. Avis</h2>
      <p>
        Seule la personne ayant effectué le rendez-vous peut laisser un avis, une fois le rendez-vous terminé. Les avis reflètent une
        expérience réelle et restent factuels et respectueux ; ils sont publiés sous le prénom et l'initiale du nom. L'Éditeur peut retirer
        un avis manifestement abusif, injurieux, discriminatoire ou sans rapport avec la prestation, et suspendre l'auteur d'avis frauduleux.
      </p>
      <h2>8. Propriété intellectuelle</h2>
      <p>
        La marque, le nom, le logo, l'interface et les contenus propres de Salon DZ sont protégés par l'ordonnance n° 03-05 relative aux
        droits d'auteur et droits voisins et par le droit des marques. Toute reproduction ou extraction non autorisée est interdite. Les
        contenus publiés par les Professionnels (photos, descriptions) restent leur propriété ; ils accordent à l'Éditeur le droit de les
        afficher sur la Plateforme et dans ses aperçus de partage, pour la durée de leur présence sur la Plateforme.
      </p>
      <h2>9. Disponibilité et responsabilité</h2>
      <ul>
        <li>L'Éditeur met tout en œuvre pour assurer un accès continu à la Plateforme, sans garantir l'absence d'interruption (maintenance, incident, réseau). L'accès peut être suspendu pour maintenance.</li>
        <li>L'Éditeur n'est pas responsable de la qualité, de la conformité ou du résultat des prestations réalisées par les Professionnels, ni des dommages résultant d'un rendez-vous manqué, annulé ou déplacé par l'une des parties.</li>
        <li>L'Éditeur n'est pas responsable des informations publiées par les Professionnels ni des avis publiés par les Clients ; il retire les contenus illicites qui lui sont signalés à <Mailto to={SUPPORT} />.</li>
        <li>Les Clients et les Professionnels s'abstiennent de tout usage abusif de la Plateforme : réservations fictives, contournement des règles, collecte automatisée de données, atteinte à la sécurité.</li>
      </ul>
      <h2>10. Suspension et résiliation</h2>
      <p>
        Vous pouvez supprimer votre compte à tout moment depuis les Réglages. L'Éditeur peut suspendre ou fermer un compte, ou retirer une
        page, en cas de manquement aux présentes CGU, de contenu illicite, de fraude ou de plaintes répétées, après information de la
        personne concernée sauf urgence. Les rendez-vous en cours sont alors annulés et les personnes concernées prévenues.
      </p>
      <h2>11. Données personnelles</h2>
      <p>
        Le traitement des données personnelles est décrit dans la <Link to="/confidentialite">politique de confidentialité</Link>, qui fait
        partie des présentes CGU.
      </p>
      <h2>12. Modifications</h2>
      <p>
        Les CGU peuvent évoluer pour suivre le service ou la réglementation ; la date de mise à jour figure en tête et les changements
        importants sont annoncés dans l'application. L'usage de la Plateforme après modification vaut acceptation.
      </p>
      <h2>13. Droit applicable et litiges</h2>
      <p>
        Les présentes CGU sont régies par le droit algérien, notamment la loi n° 18-05 relative au commerce électronique, la loi n° 09-03
        relative à la protection du consommateur et à la répression des fraudes et le code civil. En cas de difficulté, contactez d'abord
        le support (<Mailto to={SUPPORT} />) : nous cherchons une solution amiable sous 30 jours. À défaut, le litige relève des
        juridictions algériennes compétentes ; le consommateur conserve la possibilité de saisir les services de la protection du
        consommateur de sa wilaya ou une association agréée.
      </p>
    </Doc>
  );
}

export function Privacy() {
  return (
    <Doc title="Politique de confidentialité">
      <p>
        Cette politique explique quelles données Salon DZ collecte, pourquoi, avec qui elles sont partagées et quels sont vos droits, en
        application de la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à
        caractère personnel.
      </p>
      <h2>Responsable du traitement</h2>
      <p>
        {EDITOR.name} ({EDITOR.legal}), {EDITOR.address}. Pour toute question sur vos données : <Mailto to={SUPPORT} />.
      </p>
      <h2>Données collectées</h2>
      <ul>
        <li>Compte : adresse e-mail, nom et prénom, numéro de téléphone, langue, catalogue préféré, photo de profil si vous en ajoutez une.</li>
        <li>Rendez-vous : salon, prestation, membre de l'équipe, date et heure, statut, notes que vous laissez au salon, personne concernée si vous réservez pour quelqu'un d'autre.</li>
        <li>Avis : note et commentaire, publiés sous votre prénom et l'initiale de votre nom.</li>
        <li>Position : uniquement si vous l'autorisez, pour afficher les salons proches ou situer un salon ; elle n'est pas conservée par nos serveurs.</li>
        <li>Professionnels : informations de l'établissement (nom, adresse, coordonnées, prestations, prix, horaires, équipe, photos) et données de gestion (clientèle, rendez-vous, chiffre d'affaires calculé à partir des rendez-vous).</li>
        <li>Technique : identifiants de notification de votre appareil, journaux de fonctionnement et rapports d'erreur, sans contenu personnel.</li>
      </ul>
      <h2>Finalités et fondements</h2>
      <ul>
        <li>Exécuter le service que vous demandez : créer votre compte, prendre, confirmer, rappeler, déplacer et annuler vos rendez-vous, tenir l'agenda et la clientèle des Professionnels.</li>
        <li>Permettre au Professionnel de vous reconnaître et de vous joindre au sujet d'un rendez-vous.</li>
        <li>Faire respecter les règles d'usage (annulations tardives, absences, réservations abusives) — intérêt légitime de la Plateforme et des Professionnels.</li>
        <li>Vous envoyer les e-mails et notifications liés à votre compte et à vos rendez-vous. Aucune prospection commerciale sans votre accord préalable.</li>
        <li>Assurer la sécurité et le bon fonctionnement de la Plateforme et respecter nos obligations légales.</li>
      </ul>
      <h2>Destinataires</h2>
      <ul>
        <li>Le Professionnel chez qui vous réservez voit votre nom, votre numéro de téléphone, vos notes et l'historique de vos rendez-vous dans son établissement — jamais vos rendez-vous ailleurs.</li>
        <li>Nos prestataires techniques (hébergement et base de données, envoi d'e-mails, notifications, fonds de carte) traitent les données uniquement pour notre compte et selon nos instructions. Certains serveurs sont situés hors d'Algérie, dans l'Union européenne, avec un niveau de protection adéquat ; ce transfert est encadré par la loi n° 18-07.</li>
        <li>Les autorités, lorsque la loi l'exige.</li>
        <li>Aucune vente ni location de vos données, à personne.</li>
      </ul>
      <h2>Durée de conservation</h2>
      <ul>
        <li>Données du compte : tant que le compte existe.</li>
        <li>Rendez-vous : conservés dans votre historique et celui du Professionnel tant que le compte existe ; à la suppression du compte, les rendez-vous passés sont anonymisés dans l'historique des salons (la trace comptable subsiste sans votre identité) et le reste est effacé.</li>
        <li>Notifications : effacées automatiquement après 30 jours.</li>
        <li>Journaux techniques : quelques semaines au plus.</li>
      </ul>
      <h2>Vos droits</h2>
      <p>
        Conformément aux articles 32 à 36 de la loi n° 18-07, vous disposez d'un droit d'information, d'accès, de rectification,
        d'opposition et d'effacement, ainsi que du droit de retirer votre consentement. Depuis l'application : Réglages → Mes données
        (télécharger une copie) et Supprimer mon compte. Par e-mail : <Mailto to={SUPPORT} />, réponse sous 30 jours. Vous pouvez saisir
        l'Autorité nationale de protection des données à caractère personnel (ANPDP) si vous estimez que vos droits ne sont pas respectés.
      </p>
      <h2>Sécurité</h2>
      <p>
        Connexions chiffrées, accès aux données limité au strict nécessaire, mots de passe jamais conservés en clair, journaux sans
        données personnelles, revue régulière des accès. Aucun système n'est infaillible : signalez tout incident à <Mailto to={SUPPORT} />.
      </p>
      <h2>Cookies et stockage local</h2>
      <p>
        La Plateforme n'utilise ni cookies publicitaires ni traceurs tiers. Votre navigateur conserve seulement ce qui fait fonctionner le
        service : votre session, votre langue et vos préférences d'affichage.
      </p>
      <h2>Mineurs</h2>
      <p>
        Le service s'adresse aux personnes de 16 ans et plus ; pour un mineur, le représentant légal consent au traitement. Un compte créé
        en violation de cette règle est supprimé sur demande.
      </p>
      <h2>Modifications</h2>
      <p>
        Cette politique peut évoluer ; la date de mise à jour figure en tête et tout changement important vous est signalé dans
        l'application.
      </p>
    </Doc>
  );
}

export function LegalNotice() {
  return (
    <Doc title="Mentions légales">
      <h2>Éditeur</h2>
      <p>
        {EDITOR.name} — {EDITOR.legal}. Registre de commerce : {EDITOR.rc}. NIF : {EDITOR.nif}. Siège : {EDITOR.address}.
        Contact : <Mailto to={CONTACT} />.
      </p>
      <h2>Directeur de la publication</h2>
      <p>Le représentant légal de l'Éditeur.</p>
      <h2>Hébergement</h2>
      <p>
        La Plateforme et ses données sont hébergées par des prestataires professionnels d'hébergement sur des serveurs sécurisés situés
        dans l'Union européenne. Leurs coordonnées sont communiquées sur demande à <Mailto to={CONTACT} />.
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom, la marque, le logo et l'interface Salon DZ sont protégés (ordonnance n° 03-05 relative aux droits d'auteur et droits
        voisins). Les photos et descriptions des salons appartiennent aux Professionnels qui les publient. Fond de carte © les
        contributeurs OpenStreetMap, sous licence ODbL.
      </p>
      <h2>Signaler un contenu</h2>
      <p>
        Pour signaler un contenu illicite ou une atteinte à vos droits : <Mailto to={SUPPORT} />, en précisant l'adresse de la page et le
        motif. Nous accusons réception et traitons le signalement dans les meilleurs délais.
      </p>
      <h2>Commerce électronique</h2>
      <p>
        Conformément à la loi n° 18-05 relative au commerce électronique, l'Éditeur agit comme intermédiaire de mise en relation ; aucune
        vente ni aucun paiement n'est réalisé sur la Plateforme. Les prestations sont vendues et réglées auprès de chaque Professionnel, dans
        son établissement, aux prix affichés en dinars algériens.
      </p>
    </Doc>
  );
}

export function DeleteAccount() {
  return (
    <Doc title="Supprimer mon compte">
      <p>
        Vous pouvez supprimer votre compte Salon DZ (client ou professionnel) à tout moment, directement depuis l'application ou le site,
        sans avoir besoin de contacter le support.
      </p>
      <h2>Depuis l'application ou le site</h2>
      <ul>
        <li><strong>Client :</strong> Réglages → « Supprimer mon compte », en bas de l'écran.</li>
        <li><strong>Professionnel :</strong> Compte → « Supprimer mon compte et mon salon », en bas de l'écran.</li>
      </ul>
      <p>La suppression est immédiate et définitive : elle ne peut pas être annulée.</p>
      <h2>Sans l'application</h2>
      <p>
        Vous pouvez aussi demander la suppression par e-mail à <Mailto to={SUPPORT} />, depuis l'adresse liée à votre compte. Elle est
        traitée sous 30 jours au plus tard.
      </p>
      <h2>Ce qui est supprimé</h2>
      <ul>
        <li>Votre compte : nom, e-mail, numéro de téléphone, photo de profil, préférences.</li>
        <li>Pour un professionnel qui supprime aussi son salon : la page du salon, ses prestations, son équipe et ses photos.</li>
        <li>Vos rendez-vous à venir sont annulés et les personnes concernées sont prévenues avant la suppression.</li>
        <li>Vos notifications, favoris et notes personnelles.</li>
      </ul>
      <h2>Ce qui est conservé</h2>
      <p>
        Vos rendez-vous passés restent dans l'historique du salon concerné, mais anonymisés : votre nom, votre e-mail et votre numéro en
        sont retirés, seule la trace de la prestation (date, durée, montant) subsiste à des fins comptables. Aucune autre donnée personnelle
        n'est conservée après la suppression.
      </p>
      <p>
        Voir aussi la <Link to="/confidentialite">politique de confidentialité</Link> complète.
      </p>
    </Doc>
  );
}

export function Help() {
  return (
    <Doc title="Aide et contact">
      <div className="crd !gap-0 !py-1">
        <a className="li" href={`mailto:${SUPPORT}`}>
          <span className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill"><Mail size={18} /></span>
            <span>
              <span className="block font-semibold">Support</span>
              <span className="p block text-[0.857rem]">{SUPPORT} · réponse sous 48 h</span>
            </span>
          </span>
        </a>
        <a className="li" href="mailto:pro@salondz.com">
          <span className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill"><Store size={18} /></span>
            <span>
              <span className="block font-semibold">Vous êtes professionnel</span>
              <span className="p block text-[0.857rem]">pro@salondz.com · ouverture de salon, accompagnement</span>
            </span>
          </span>
        </a>
        <a className="li" href={`mailto:${CONTACT}`}>
          <span className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill"><MessageCircle size={18} /></span>
            <span>
              <span className="block font-semibold">Autre demande</span>
              <span className="p block text-[0.857rem]">{CONTACT}</span>
            </span>
          </span>
        </a>
      </div>
      <h2>Questions fréquentes</h2>
      <p><strong>Je n'ai pas reçu l'e-mail de confirmation.</strong> Regardez dans les courriers indésirables ; le lien reste valable une heure. Sinon, demandez-en un nouveau depuis l'écran de connexion.</p>
      <p><strong>Comment annuler ou déplacer un rendez-vous ?</strong> Depuis Rendez-vous → le rendez-vous → Annuler ou Reporter, dans le délai fixé par le salon.</p>
      <p><strong>Je ne reçois pas les rappels.</strong> Ils arrivent sur l'application Salon DZ si elle est installée, sinon par le navigateur : activez « Notifications sur cet appareil » dans les Réglages. Ils restent visibles dans l'application dans tous les cas.</p>
      <p><strong>Ma réservation en ligne est suspendue.</strong> Plusieurs annulations tardives ou absences déclenchent une suspension temporaire, dont la fin est affichée. Vous pouvez toujours contacter le salon directement.</p>
      <p><strong>Modifier mon numéro de téléphone.</strong> Il identifie vos rendez-vous auprès des salons : écrivez au support pour le changer une fois un rendez-vous pris.</p>
      <p><strong>Supprimer mon compte.</strong> Réglages → Supprimer mon compte. Vos rendez-vous passés sont anonymisés, le reste est effacé.</p>
      <p><strong>Professionnel : ma page n'apparaît pas.</strong> Elle doit être publiée (Compte → Page publiée) avec au moins une prestation, des horaires et un membre actif.</p>
      <p><strong>Professionnel : je ne reçois pas les nouvelles demandes.</strong> Activez « Notifications sur cet appareil » dans Compte, ou installez l'application mobile : elle est prévenue en priorité.</p>
    </Doc>
  );
}
