/**
 * Pages légales et aide : CGU (clients et professionnels), politique de confidentialité, mentions légales,
 * aide et contact. Textes de départ rédigés pour Salon DZ (loi algérienne 18-07 sur les données personnelles) :
 * À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE avant l'ouverture au public, puis à dater.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Mail, MessageCircle, Store } from 'lucide-react';
import { TopBar } from '@/components/ui';
import { Screen } from '@/components/AppFrame';
import { BrandFooter } from '@/components/BrandFooter';

const UPDATED = '16 septembre 2026';

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen className="min-h-dvh" gap={16}>
      <TopBar backTo="/" />
      <h1 className="h1">{title}</h1>
      <p className="p -mt-2 text-[0.857rem]">Dernière mise à jour : {UPDATED}</p>
      <div className="flex flex-col gap-5 text-[1rem] leading-[1.55] [&_h2]:mt-2 [&_h2]:text-[1.143rem] [&_h2]:font-semibold [&_p]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1">{children}</div>
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

export function Terms() {
  return (
    <Doc title="Conditions générales d'utilisation">
      <h2>1. Le service</h2>
      <p>
        Salon DZ est une plateforme de mise en relation entre des clients et des salons de coiffure, barbiers et instituts de beauté
        en Algérie. Elle permet de consulter des salons, de réserver un rendez-vous et, pour les professionnels, de gérer leur agenda
        et leur page publique. Salon DZ n'est pas partie au contrat de prestation conclu entre le client et le salon.
      </p>
      <h2>2. Compte</h2>
      <p>
        Un compte est nécessaire pour réserver ou proposer des prestations. Vous vous engagez à fournir des informations exactes (nom,
        numéro de téléphone algérien, adresse e-mail) et à garder vos identifiants confidentiels. Le service est réservé aux personnes
        de 16 ans et plus.
      </p>
      <h2>3. Réservations</h2>
      <ul>
        <li>Une réservation est un engagement : présentez-vous à l'heure ou annulez dans le délai affiché par le salon.</li>
        <li>Le prix affiché est indicatif et se règle sur place, auprès du salon, sauf mention contraire.</li>
        <li>Chaque salon fixe ses règles (délai d'annulation, report, validation manuelle) ; elles sont affichées avant confirmation.</li>
        <li>
          Les annulations tardives répétées et les absences sans prévenir peuvent suspendre temporairement la réservation en ligne, et un
          salon peut refuser un client.
        </li>
        <li>
          Réserver pour une autre personne engage votre responsabilité : vous devez avoir son accord et lui transmettre les informations du
          rendez-vous.
        </li>
      </ul>
      <h2>4. Professionnels</h2>
      <ul>
        <li>Vous garantissez l'exactitude de votre page (nom, adresse, prestations, prix, horaires) et détenez les droits sur les photos publiées.</li>
        <li>Vous honorez les rendez-vous confirmés ou prévenez le client sans délai en cas d'empêchement.</li>
        <li>Les données de vos clients (noms, numéros, notes) ne servent qu'à la gestion de vos rendez-vous, jamais à de la prospection non sollicitée.</li>
        <li>Salon DZ peut suspendre ou retirer une page en cas de contenu trompeur, illicite ou de plaintes répétées.</li>
      </ul>
      <h2>5. Avis</h2>
      <p>
        Seule la personne ayant effectué le rendez-vous peut laisser un avis, une fois le rendez-vous terminé. Les avis doivent rester
        factuels et respectueux. Salon DZ peut retirer un avis manifestement abusif.
      </p>
      <h2>6. Responsabilité</h2>
      <p>
        Salon DZ met tout en œuvre pour assurer la disponibilité du service mais ne garantit pas son fonctionnement ininterrompu. Salon DZ
        n'est pas responsable de la qualité des prestations réalisées par les salons ni des litiges entre clients et professionnels.
      </p>
      <h2>7. Modifications</h2>
      <p>Ces conditions peuvent évoluer ; la date de mise à jour figure en tête. L'usage du service après modification vaut acceptation.</p>
      <h2>8. Droit applicable</h2>
      <p>Ces conditions sont régies par le droit algérien. Tout litige relève des juridictions compétentes d'Alger.</p>
    </Doc>
  );
}

export function Privacy() {
  return (
    <Doc title="Politique de confidentialité">
      <h2>Responsable du traitement</h2>
      <p>
        Salon DZ, joignable à <a href="mailto:support@salondz.com">support@salondz.com</a>. Le traitement des données personnelles respecte la
        loi algérienne n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère
        personnel.
      </p>
      <h2>Données collectées</h2>
      <ul>
        <li>Compte : adresse e-mail, nom, numéro de téléphone, langue, marché préféré.</li>
        <li>Rendez-vous : salon, prestation, date et heure, statut, notes que vous laissez au salon.</li>
        <li>Avis : note et commentaire publiés sous votre prénom et l'initiale de votre nom.</li>
        <li>Position : uniquement si vous l'autorisez, pour afficher les salons proches ; elle n'est pas conservée par nos serveurs.</li>
        <li>Technique : jetons de notification, journaux techniques (sans contenu personnel), diagnostic d'erreurs.</li>
      </ul>
      <h2>Pourquoi</h2>
      <ul>
        <li>Prendre, confirmer, rappeler et gérer vos rendez-vous (exécution du service).</li>
        <li>Permettre au salon de vous reconnaître et de tenir son agenda.</li>
        <li>Appliquer les règles anti-abus (annulations tardives, absences).</li>
        <li>Vous envoyer les e-mails et notifications liés à votre compte et à vos rendez-vous. Aucune prospection sans votre accord.</li>
      </ul>
      <h2>Qui y accède</h2>
      <p>
        Le salon où vous réservez voit votre nom, votre numéro et l'historique de vos rendez-vous chez lui. Nos prestataires techniques
        (hébergement Supabase et Render en Europe, envoi d'e-mails Resend, notifications Expo et navigateur, cartes OpenStreetMap) ne
        traitent les données que pour notre compte. Aucune vente de données.
      </p>
      <h2>Durée de conservation</h2>
      <p>
        Tant que votre compte existe. Les notifications sont effacées après 30 jours. À la suppression du compte, vos rendez-vous passés
        sont anonymisés dans l'historique des salons et le reste est supprimé.
      </p>
      <h2>Vos droits</h2>
      <p>
        Accès, rectification, opposition, effacement et portabilité. Depuis l'application : Réglages → Mes données (télécharger) et
        Supprimer mon compte. Par e-mail : <a href="mailto:support@salondz.com">support@salondz.com</a>. Réponse sous 30 jours. Vous pouvez
        saisir l'Autorité nationale de protection des données à caractère personnel (ANPDP).
      </p>
      <h2>Sécurité</h2>
      <p>
        Connexions chiffrées, accès à la base de données limité à nos serveurs, mots de passe jamais stockés en clair, journaux sans
        données personnelles.
      </p>
    </Doc>
  );
}

export function LegalNotice() {
  return (
    <Doc title="Mentions légales">
      <h2>Éditeur</h2>
      <p>
        Salon DZ — [dénomination sociale, forme juridique, registre de commerce et NIF à compléter], Alger, Algérie.
        Contact : <a href="mailto:contact@salondz.com">contact@salondz.com</a>.
      </p>
      <h2>Hébergement</h2>
      <p>Render Services, Inc. (San Francisco, États-Unis ; serveurs en Europe) et Supabase, Inc. (Singapour ; base de données en Europe).</p>
      <h2>Propriété intellectuelle</h2>
      <p>
        La marque, le logo et l'interface Salon DZ sont protégés. Les photos des salons appartiennent aux professionnels qui les publient.
        Fond de carte © les contributeurs OpenStreetMap.
      </p>
    </Doc>
  );
}

export function Help() {
  return (
    <Doc title="Aide et contact">
      <div className="crd !gap-0 !py-1">
        <a className="li" href="mailto:support@salondz.com">
          <span className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill"><Mail size={18} /></span>
            <span>
              <span className="block font-semibold">Support</span>
              <span className="p block text-[0.857rem]">support@salondz.com · réponse sous 48 h</span>
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
        <a className="li" href="mailto:contact@salondz.com">
          <span className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fill"><MessageCircle size={18} /></span>
            <span>
              <span className="block font-semibold">Autre demande</span>
              <span className="p block text-[0.857rem]">contact@salondz.com</span>
            </span>
          </span>
        </a>
      </div>
      <h2>Questions fréquentes</h2>
      <p><strong>Je n'ai pas reçu l'e-mail de confirmation.</strong> Regardez dans les courriers indésirables ; le lien reste valable une heure. Sinon, demandez-en un nouveau depuis l'écran de connexion.</p>
      <p><strong>Comment annuler ou déplacer un rendez-vous ?</strong> Depuis Rendez-vous → le rendez-vous → Annuler ou Reporter, dans le délai fixé par le salon.</p>
      <p><strong>Ma réservation en ligne est suspendue.</strong> Plusieurs annulations tardives ou absences déclenchent une suspension temporaire. Vous pouvez toujours appeler le salon.</p>
      <p><strong>Supprimer mon compte.</strong> Réglages → Supprimer mon compte. Vos rendez-vous passés sont anonymisés, le reste est effacé.</p>
      <p><strong>Professionnel : ma page n'apparaît pas.</strong> Elle doit être publiée (Compte → Page publiée) avec au moins une prestation, des horaires et un membre actif.</p>
    </Doc>
  );
}
