/**
 * VOCABULAIRE DES ICÔNES D'ACTION (13 nov. 2026, consigne du propriétaire : « une icône sur chaque
 * bouton, très précise »). UNE action = UNE icône, la même partout : reporter est toujours un
 * calendrier à horloge, annuler un rendez-vous toujours un calendrier barré. On choisit ici, jamais
 * au jugé dans un écran.
 *
 *   <Button icon={ICONE.reporter}>Reporter</Button>
 *
 * Bibliothèque : lucide-react (traits fins, comme le reste de l'application). Si aucune icône ne
 * dit exactement l'action, on en DESSINE une dans le même style (24 × 24, trait 1,6, bouts ronds)
 * et on l'ajoute ici — jamais une icône approximative.
 */
import {
  Archive,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  AtSign,
  Ban,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  CalendarSearch,
  CalendarX2,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  CalendarSync,
  IdCard,
  Eye,
  EyeOff,
  Images,
  House,
  KeyRound,
  LogIn,
  Mail,
  MapPin,
  Plus,
  RotateCw,
  Search,
  Send,
  Share,
  Star,
  Store,
  TimerOff,
  Trash2,
  Undo2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { UsersEchange } from './customIcons';

export const ICONE = {
  // Rendez-vous
  accepter: Check,
  refuser: X,
  confier: UsersEchange,
  terminer: UserCheck,
  absent: UserX,
  reporter: CalendarSync,
  validerReport: CalendarCheck,
  annulerRdv: CalendarX2,
  confirmerRdv: CalendarCheck,
  annulerRetard: TimerOff,
  garder: Undo2,
  reprendre: CalendarPlus,
  reserver: CalendarPlus,
  fiche: IdCard,
  agenda: CalendarDays,
  autreCreneau: CalendarClock,
  prochaineDispo: CalendarSearch,
  alerter: BellRing,
  fermer: CalendarOff,
  impossible: Ban,
  // Formulaires et fenêtres
  valider: Check,
  enregistrer: Check,
  ajouter: Plus,
  continuer: ArrowRight,
  retour: ArrowLeft,
  fermerFenetre: X,
  non: X,
  oui: Check,
  supprimer: Trash2,
  retablir: Undo2,
  classer: Archive,
  reessayer: RotateCw,
  accueil: House,
  plus: ChevronDown,
  // Partage
  partager: Share,
  copier: Copy,
  apercu: Eye,
  photos: Images,
  masquer: EyeOff,
  // Compte et accès
  seConnecter: LogIn,
  creerCompte: UserPlus,
  creerEspace: Store,
  motDePasse: KeyRound,
  recevoirLien: Mail,
  renvoyer: Send,
  envoyer: Send,
  autreAdresse: AtSign,
  retirerMembre: UserMinus,
  ajouterMembre: UserPlus,
  // Place de marché
  explorer: Search,
  lieu: MapPin,
  avis: Star,
  changer: ArrowLeftRight,
} satisfies Record<string, LucideIcon>;

export type ActionIcone = keyof typeof ICONE;
