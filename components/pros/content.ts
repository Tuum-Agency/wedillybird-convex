/**
 * Contenu de la page Pros (`/pros`) — agences & wedding planners.
 *
 * Source de vérité produit : `.context/livrables-wedillybird/Grille-Tarifaire-Pro-v3.md`
 * (mapping forfaits) + `_agencyTax.json` (taxonomie des 11 piliers). Les montants
 * restent pilotés par `lib/payments/subscriptions.ts` (grille canonique) ; ce
 * module ne réécrit jamais les prix, il décrit les fonctionnalités.
 *
 * Strings FR en dur : cohérent avec la zone landing (`components/landing/
 * section-nav.tsx` hardcode déjà ses libellés). On n'ajoute donc AUCUNE clé
 * next-intl ici — la parité 7 locales (CI `i18n:validate`) reste intacte. Le
 * pricing réutilise le composant `LandingPricingPros` (déjà traduit).
 */

import {
  LayoutDashboard,
  Users,
  CalendarClock,
  Wallet,
  FileSignature,
  Sparkles,
  Palette,
  ShieldCheck,
  Cable,
  CreditCard,
  SlidersHorizontal,
  MessageCircle,
  ScanFace,
  CheckCircle2,
  Armchair,
  type LucideIcon,
} from 'lucide-react';

/** Disponibilité d'une fonctionnalité selon le forfait (grille v3). */
export type Tier = 'all' | 'business' | 'agency' | 'addon';

export const TIER_LABEL: Record<Tier, string> = {
  all: 'Tous les forfaits',
  business: 'Business',
  agency: 'Agency',
  addon: 'Option',
};

/** Libellé court porté par le badge d'une feature gatée. */
export const TIER_BADGE: Record<Exclude<Tier, 'all'>, string> = {
  business: 'Business+',
  agency: 'Agency',
  addon: 'Option',
};

export interface Feature {
  name: string;
  detail: string;
  tier: Tier;
}

export interface Pillar {
  id: string;
  number: string;
  icon: LucideIcon;
  name: string;
  summary: string;
  features: readonly Feature[];
}

/* -------------------------------------------------------------------------- */
/*  Les 11 piliers fonctionnels                                               */
/* -------------------------------------------------------------------------- */

export const PILLARS: readonly Pillar[] = [
  {
    id: 'cockpit',
    number: '01',
    icon: LayoutDashboard,
    name: 'Pilotage & cockpit',
    summary:
      'Un tableau de bord unique qui agrège mariages, RSVP, deadlines, pipeline, quotas et chiffre d’affaires — la coquille commune à tout le back-office.',
    features: [
      {
        name: 'Cockpit agrégé',
        detail:
          'KPI, prochains mariages, deadlines du jour, mini-funnel commercial, CA du mois et activité récente sur un seul écran.',
        tier: 'all',
      },
      {
        name: 'KPI à tendances',
        detail:
          'Mariages actifs, RSVP en attente, deadlines, CA — chacun avec sa mini-courbe et sa flèche de tendance.',
        tier: 'all',
      },
      {
        name: 'Jauges de quotas',
        detail:
          'Événements, messages WhatsApp et stockage suivis en direct, avec alertes de seuil 80 % / 100 %.',
        tier: 'all',
      },
      {
        name: 'Recherche globale ⌘K',
        detail:
          'Recherche cross-entités (clients, mariages, invités) accessible partout au clavier.',
        tier: 'all',
      },
      {
        name: 'Flux d’activité typé',
        detail:
          'Timeline horodatée : RSVP reçus, acomptes encaissés, photos déposées, nouveaux leads, factures réglées.',
        tier: 'all',
      },
      {
        name: 'Analytics multi-events',
        detail:
          'Cockpit consolidé : CA agrégé, taux de réservation, RSVP et deadlines à l’échelle du portefeuille.',
        tier: 'agency',
      },
    ],
  },
  {
    id: 'crm',
    number: '02',
    icon: Users,
    name: 'Acquisition & CRM',
    summary:
      'Du lead entrant au mariage livré : fiches couples, pipeline kanban à 6 étapes, sources d’acquisition et conversion du lead en mariage facturable.',
    features: [
      {
        name: 'Fiches clients',
        detail:
          'Coordonnées, mariage lié, notes, statut et timeline d’activité typée — le CRM en mode liste, inclus partout.',
        tier: 'all',
      },
      {
        name: 'Pipeline kanban 6 étapes',
        detail:
          'Lead → Contacté → Devis → Réservé → En cours → Livré, en kanban drag & drop et table dense.',
        tier: 'business',
      },
      {
        name: 'Actions groupées',
        detail: 'Changement de statut, assignation et suppression en masse (avec annulation).',
        tier: 'business',
      },
      {
        name: 'Sources de lead & filtres',
        detail:
          'Origine catégorisée (recommandation, Instagram, salon, site…), base de l’analyse d’acquisition.',
        tier: 'business',
      },
      {
        name: 'Conversion lead → mariage',
        detail:
          'Un clic crée l’événement, le rattache et active rétroplanning, RSVP et galerie. Le pivot de l’économie par mariage.',
        tier: 'business',
      },
      {
        name: 'Assignation à l’équipe',
        detail: 'Chaque couple assigné à un·e collaborateur·rice, individuellement ou en masse.',
        tier: 'business',
      },
    ],
  },
  {
    id: 'planning',
    number: '03',
    icon: CalendarClock,
    name: 'Planification & ressources',
    summary:
      'Rétroplanning multi-mariages ancré au jour J et annuaire mutualisé de prestataires que l’on note, contacte et rattache à chaque mariage.',
    features: [
      {
        name: 'Rétroplanning par phases',
        detail:
          '7 phases calculées en offset depuis la date du mariage, mini-barres de progression et anneau d’avancement.',
        tier: 'all',
      },
      {
        name: 'Trois vues',
        detail:
          'Par phase et Frise chronologique dès Starter ; vue Kanban (À faire / En cours / Fait) à partir de Business.',
        tier: 'all',
      },
      {
        name: 'Modèles réutilisables',
        detail:
          'Bibliothèque (Mariage classique, Mariage intime) qui génère toutes les tâches ancrées à la date.',
        tier: 'all',
      },
      {
        name: 'Assignation & sous-tâches',
        detail:
          'Statuts, priorités, échéances J−XX, checklists et assignation des tâches à l’équipe.',
        tier: 'business',
      },
      {
        name: 'Annuaire prestataires',
        detail:
          'Lieux, traiteurs, photographes réutilisables : note privée 1–5★, tags, documents, contact multi-canal.',
        tier: 'all',
      },
      {
        name: 'Rattachement + ligne budget',
        detail:
          'Prestataires illimités, rattachés à un mariage avec statut d’engagement et création auto de la ligne budget.',
        tier: 'business',
      },
    ],
  },
  {
    id: 'budget',
    number: '04',
    icon: Wallet,
    name: 'Budget par mariage',
    summary:
      'Le budget de chaque mariage, du suivi à l’édition fine, présentable au couple et exportable pour la comptabilité.',
    features: [
      {
        name: 'Suivi budget',
        detail:
          'Donut de répartition, totaux prévu / payé / reste, alertes de dépassement — en lecture dès Starter.',
        tier: 'all',
      },
      {
        name: 'Édition des lignes',
        detail: 'Ajout et édition de postes, statuts de paiement, enveloppe globale ajustable.',
        tier: 'business',
      },
      {
        name: 'Prestataire → budget',
        detail: 'Rattacher un prestataire crée automatiquement sa ligne budget au montant prévu.',
        tier: 'business',
      },
      {
        name: 'Export PDF couple',
        detail: 'Un budget présentable, à la marque de l’agence, partageable au couple.',
        tier: 'business',
      },
      {
        name: 'Export CSV comptable',
        detail: 'Relevé prêt pour le comptable ou le logiciel de compta — inclus dès Starter.',
        tier: 'all',
      },
    ],
  },
  {
    id: 'finance',
    number: '05',
    icon: FileSignature,
    name: 'Devis, factures & contrats',
    summary:
      'La chaîne commerciale brandée de bout en bout : devis → contrat signé électroniquement → facture → encaissement, chaînés dans un dossier de réservation.',
    features: [
      {
        name: 'Devis & factures à la marque',
        detail:
          'Éditeur (lignes, remise, TVA), aperçu papeterie live, envoi et conversion devis → facture.',
        tier: 'business',
      },
      {
        name: 'Échéanciers',
        detail: 'Acompte à la signature + solde J−30, barre payé / restant par facture.',
        tier: 'business',
      },
      {
        name: 'Contrats e-sign',
        detail:
          'Signature électronique eIDAS / ESIGN-UETA, contre-signature agence, piste d’audit horodatée et certificat.',
        tier: 'business',
      },
      {
        name: 'Dossier de réservation',
        detail:
          'Pipeline visuel devis → contrat → acompte → réservé, qui chaîne tous les documents.',
        tier: 'business',
      },
      {
        name: 'Suivi & relances',
        detail: 'Timeline créé / envoyé / vu / accepté / payé, tracking d’ouverture et relances.',
        tier: 'business',
      },
      {
        name: 'Encaissement via votre Stripe',
        detail:
          'Connectez votre propre compte Stripe : liens de paiement WhatsApp/email, échéanciers reliés aux factures, réconciliation automatique. L’argent va directement chez vous — 0 commission Wedillybird.',
        tier: 'addon',
      },
    ],
  },
  {
    id: 'execution',
    number: '06',
    icon: Sparkles,
    name: 'Exécution du mariage & jour J',
    summary:
      'Notre différenciateur : l’écran unique d’où l’agence gère un mariage — invitation WhatsApp, RSVP, check-in hors-ligne, plan de table et galerie. Inclus dans tous les forfaits.',
    features: [
      {
        name: 'Hub mariage à onglets',
        detail:
          'Aperçu, Invités, Messaging, Check-in, Plan de table, Galerie, Facture — un seul écran.',
        tier: 'all',
      },
      {
        name: 'Invitation cinématique',
        detail:
          'Page publique avec ouverture animée (Motion / GSAP), sceau et parallaxe, respect du reduced-motion.',
        tier: 'all',
      },
      {
        name: 'RSVP & messaging WhatsApp',
        detail:
          '5 styles d’invitation, aperçu live, relances automatiques J−7 / J−1, table de livraison WhatsApp/SMS.',
        tier: 'all',
      },
      {
        name: 'Check-in jour J hors-ligne',
        detail:
          'Scanner QR, file de synchro hors-ligne et feed des arrivées attribué au staff (multi-agent).',
        tier: 'all',
      },
      {
        name: 'Plan de table',
        detail:
          'Canvas drag & drop, auto-placement, contraintes garder-ensemble / séparer, export PDF et cartons de placement.',
        tier: 'all',
      },
      {
        name: 'Galerie reconnaissance faciale',
        detail:
          'Chaque invité retrouve ses photos par selfie, modération IA, upload contributeurs et export ZIP.',
        tier: 'all',
      },
    ],
  },
  {
    id: 'whitelabel',
    number: '07',
    icon: Palette,
    name: 'Marque blanche & portail couple',
    summary:
      'L’expérience client sous l’identité de l’agence : portail couple privé, personnalisation multi-tenant et marque blanche graduée jusqu’au retrait total de la mention Wedillybird.',
    features: [
      {
        name: 'Couleur de marque',
        detail:
          'Override multi-tenant (luminance bornée AA) qui re-teinte portail, galerie, documents et page de paiement.',
        tier: 'all',
      },
      {
        name: 'Sous-domaine + logo',
        detail:
          'slug.wedillybird.com à votre logo et votre couleur — niveau 1, inclus dès Starter.',
        tier: 'all',
      },
      {
        name: 'Portail couple marque blanche',
        detail:
          'Espace privé du couple : rétroplanning, budget en lecture, documents à signer, messagerie planner.',
        tier: 'business',
      },
      {
        name: 'Signature côté couple',
        detail:
          'Le couple signe contrats et devis en ligne, suit les statuts et télécharge ses documents.',
        tier: 'business',
      },
      {
        name: 'Domaine & email white-label',
        detail:
          'Domaine propre (portail.mon-agence.fr) et adresse d’envoi personnalisée — niveau 3.',
        tier: 'agency',
      },
      {
        name: 'Retrait « Propulsé par Wedillybird »',
        detail:
          'Marque blanche totale : la mention disparaît du portail, des emails, des documents et du paiement.',
        tier: 'agency',
      },
    ],
  },
  {
    id: 'team',
    number: '08',
    icon: ShieldCheck,
    name: 'Équipe & gouvernance',
    summary:
      'Inviter, attribuer des rôles, gérer les sièges et verrouiller les actions sensibles, avec un modèle RBAC à 4 rôles hiérarchiques.',
    features: [
      {
        name: 'RBAC 4 rôles',
        detail: 'Propriétaire / Admin / Planner / Lecture, hiérarchiques, un seul rôle par membre.',
        tier: 'all',
      },
      {
        name: 'Matrice de permissions',
        detail:
          'Tableau croisé 7 capacités × 4 rôles : qui peut voir, créer, gérer, facturer, supprimer.',
        tier: 'all',
      },
      {
        name: 'Invitations email / WhatsApp',
        detail: 'Inviter par email ou WhatsApp, page d’acceptation brandée, validité 7 jours.',
        tier: 'all',
      },
      {
        name: 'Sièges inclus',
        detail:
          '2 sièges en Starter, 8 en Business, illimités en Agency — siège supplémentaire à 19 €/mois.',
        tier: 'all',
      },
      {
        name: 'Transfert de propriété',
        detail:
          'Désigner un autre membre propriétaire et accéder à la zone de danger de l’organisation.',
        tier: 'agency',
      },
    ],
  },
  {
    id: 'integrations',
    number: '09',
    icon: Cable,
    name: 'Intégrations',
    summary:
      'Brancher le CRM existant et les outils de l’agence en synchro à sens unique avec write-backs ciblés — sans jamais perdre une agence déjà équipée.',
    features: [
      {
        name: 'Import CSV',
        detail:
          'Assistant d’import invités et clients (mapping colonnes, doublons), concédé dès Business.',
        tier: 'business',
      },
      {
        name: 'Connecteur HoneyBook',
        detail: 'Connexion OAuth en lecture seule (clients, étapes, montants, événements de deal).',
        tier: 'agency',
      },
      {
        name: 'Zapier / Make',
        detail:
          'Clé API et webhook entrant pour relier n’importe quel CRM via un Zap ou un scénario Make.',
        tier: 'agency',
      },
      {
        name: 'API & Webhooks',
        detail:
          'Clés prod/test, événements sortants signés HMAC (client.created, payment.received, wedding.delivered…), doc dev.',
        tier: 'agency',
      },
      {
        name: 'Source de vérité par champ',
        detail:
          'Un maître par donnée (CRM maître clients/montants, Wedillybird maître exécution) + write-backs.',
        tier: 'agency',
      },
      {
        name: 'Mode « mon propre CRM »',
        detail:
          'Masque le pipeline natif et réduit la fiche client au rattachement pour les agences déjà équipées.',
        tier: 'agency',
      },
    ],
  },
  {
    id: 'billing',
    number: '10',
    icon: CreditCard,
    name: 'Abonnement & facturation',
    summary:
      'L’espace de gestion du forfait Wedillybird : cycle, quotas, dépassements, crédits pay-as-you-go et export comptable — distinct de ce que l’agence facture à ses couples.',
    features: [
      {
        name: 'Gestion de l’abonnement',
        detail:
          'Forfait, statut, cycle, échéance et moyen de paiement, avec bandeaux d’état contextuels.',
        tier: 'all',
      },
      {
        name: 'Changer de formule',
        detail:
          'Upgrade / downgrade, bascule mensuel ↔ annuel (−20 %), prorata immédiat, comparatif des quotas.',
        tier: 'all',
      },
      {
        name: 'Suivi des dépassements',
        detail:
          'Jauges events / messages / stockage, projection de fin de mois et alertes avant facturation.',
        tier: 'all',
      },
      {
        name: 'Crédits pay-as-you-go',
        detail: '79 €/crédit = 1 mariage hors quota, non affecté par la résiliation.',
        tier: 'addon',
      },
      {
        name: 'Export comptable mensuel',
        detail: 'Relevé CSV/PDF (abonnement + dépassements + crédits) prêt pour la comptabilité.',
        tier: 'all',
      },
      {
        name: 'Portail Stripe & résiliation',
        detail:
          'Mise à jour de carte, reçus, résiliation et réactivation — Wedillybird ne stocke jamais les numéros de carte.',
        tier: 'all',
      },
    ],
  },
  {
    id: 'settings',
    number: '11',
    icon: SlidersHorizontal,
    name: 'Réglages & sécurité',
    summary:
      'Le hub de configuration de l’organisation : profil régional, branding, intégrations, messagerie, notifications, sécurité et zone de danger.',
    features: [
      {
        name: 'Profil & préférences régionales',
        detail:
          'Logo, coordonnées, langue, devise et fuseau qui pilotent le format des montants et des dates.',
        tier: 'all',
      },
      {
        name: 'Branding & marque blanche',
        detail: 'Palette couleurs avec aperçu live du portail couple, gatée par forfait.',
        tier: 'all',
      },
      {
        name: 'Messagerie & templates',
        detail:
          'Canal d’envoi par défaut, nom d’expéditeur, template d’invitation et relances RSVP automatiques.',
        tier: 'all',
      },
      {
        name: 'Notifications',
        detail:
          'Matrice par type d’événement (RSVP, paiements, échéances, quotas) avec switchs email et in-app.',
        tier: 'all',
      },
      {
        name: 'Sécurité du compte',
        detail:
          'Double authentification (2FA TOTP), sessions actives révocables et journal d’activité.',
        tier: 'business',
      },
      {
        name: 'Zone de danger',
        detail:
          'Export complet des données (JSON/CSV) et suppression de l’organisation, réservés au Propriétaire.',
        tier: 'agency',
      },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Parcours « de A à Z » — le constat → la promesse                          */
/* -------------------------------------------------------------------------- */

export interface JourneyStep {
  step: string;
  title: string;
  detail: string;
}

export const JOURNEY: readonly JourneyStep[] = [
  {
    step: '01',
    title: 'Le lead arrive',
    detail: 'Capté dans le CRM, qualifié, assigné, suivi dans le pipeline.',
  },
  {
    step: '02',
    title: 'Devis & contrat',
    detail: 'Devis à la marque, contrat signé en ligne, dossier de réservation chaîné.',
  },
  {
    step: '03',
    title: 'Acompte encaissé',
    detail: 'Échéancier acompte + solde, lien de paiement, versement automatique.',
  },
  {
    step: '04',
    title: 'On organise',
    detail: 'Rétroplanning, budget, prestataires et portail couple, sous votre marque.',
  },
  {
    step: '05',
    title: 'Le jour J',
    detail: 'Invitation WhatsApp, RSVP, check-in hors-ligne, plan de table — l’exécution premium.',
  },
  {
    step: '06',
    title: 'Livraison',
    detail: 'Galerie reconnaissance faciale, solde réglé, mariage marqué livré.',
  },
];

/* -------------------------------------------------------------------------- */
/*  Le différenciateur (wedge jour J)                                         */
/* -------------------------------------------------------------------------- */

export interface WedgeItem {
  icon: LucideIcon;
  title: string;
  detail: string;
}

export const WEDGE: readonly WedgeItem[] = [
  {
    icon: MessageCircle,
    title: 'RSVP par WhatsApp',
    detail:
      'Vos invités confirment là où ils lisent vraiment leurs messages. Relances automatiques, repli SMS, suivi de livraison.',
  },
  {
    icon: ScanFace,
    title: 'Galerie reconnaissance faciale',
    detail:
      'Chaque invité retrouve ses photos d’un selfie. Modération IA, upload contributeurs, archive 12 mois.',
  },
  {
    icon: CheckCircle2,
    title: 'Check-in hors-ligne',
    detail:
      'Scan QR à l’entrée même sans réseau, synchro dès que ça revient, plusieurs agents en parallèle.',
  },
  {
    icon: Armchair,
    title: 'Plan de table intelligent',
    detail:
      'Auto-placement, contraintes garder-ensemble / séparer, export des cartons à votre papeterie.',
  },
];

/* -------------------------------------------------------------------------- */
/*  Marque blanche graduée                                                    */
/* -------------------------------------------------------------------------- */

export interface WhiteLabelLevel {
  level: string;
  tier: Tier;
  title: string;
  points: readonly string[];
}

export const WHITE_LABEL: readonly WhiteLabelLevel[] = [
  {
    level: 'Niveau 1',
    tier: 'all',
    title: 'Votre marque, visible',
    points: [
      'Sous-domaine slug.wedillybird.com',
      'Votre logo et votre couleur',
      'Mention Wedillybird conservée',
    ],
  },
  {
    level: 'Niveau 2',
    tier: 'business',
    title: 'Portail couple brandé',
    points: [
      'Sous-domaine dédié vérifié',
      'Portail couple à votre identité',
      'Cobranding sur l’invitation publique',
    ],
  },
  {
    level: 'Niveau 3',
    tier: 'agency',
    title: 'Marque blanche totale',
    points: [
      'Domaine personnalisé',
      'Email expéditeur white-label',
      'Aucune mention Wedillybird, nulle part',
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  Add-ons & dépassements (transverses, hors tiering)                        */
/* -------------------------------------------------------------------------- */

export interface PriceLine {
  label: string;
  price: string;
  detail: string;
}

export const ADDONS: readonly PriceLine[] = [
  {
    label: 'Paiements via votre Stripe',
    price: '0 %',
    detail:
      'Connectez votre propre compte Stripe et encaissez vos couples sans quitter l’outil. Aucune commission Wedillybird — l’argent va directement sur votre compte.',
  },
  {
    label: 'Upsell HD post-mariage',
    price: '+29 €',
    detail: 'Archive perpétuelle + ZIP HD, revendable au couple après l’événement.',
  },
  {
    label: 'Siège supplémentaire',
    price: '19 €/mois',
    detail: 'Étendre l’équipe sans changer de forfait (Starter & Business).',
  },
  {
    label: 'Événement simultané',
    price: '19 €/mois',
    detail: 'Un mariage actif de plus que le quota du forfait, au prorata.',
  },
];

export const OVERAGES: readonly PriceLine[] = [
  { label: 'Message WhatsApp / SMS', price: '0,06 €', detail: 'au-delà du bundle mensuel inclus' },
  { label: 'Invité', price: '0,25 €', detail: 'au-delà du cap de 150 par mariage' },
  { label: 'Stockage', price: '0,03 €', detail: 'par Go et par mois au-delà du quota' },
];

/* -------------------------------------------------------------------------- */
/*  Capacités par forfait (garde-fou marge — pas le récit de vente)           */
/* -------------------------------------------------------------------------- */

export interface CapacityRow {
  label: string;
  starter: string;
  business: string;
  agency: string;
}

export const CAPACITIES: readonly CapacityRow[] = [
  { label: 'Mariages actifs simultanés', starter: '5', business: '20', agency: '50' },
  { label: 'Invités par mariage', starter: '150', business: '150', agency: '150' },
  { label: 'Messages WhatsApp / mois', starter: '3 000', business: '10 000', agency: '25 000' },
  { label: 'Stockage galerie', starter: '50 Go', business: '200 Go', agency: '500 Go' },
  { label: 'Sièges équipe', starter: '2', business: '8', agency: 'Illimités' },
];

/* -------------------------------------------------------------------------- */
/*  FAQ pros                                                                  */
/* -------------------------------------------------------------------------- */

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: readonly FaqItem[] = [
  {
    q: 'En quoi êtes-vous différents d’un HoneyBook ou d’un Dubsado ?',
    a: 'Les autres gèrent le bureau (CRM, devis, factures). Nous gérons aussi le grand jour : RSVP WhatsApp, galerie reconnaissance faciale, check-in hors-ligne et plan de table. C’est le seul outil qui couvre le lead jusqu’à la galerie, sous votre marque.',
  },
  {
    q: 'Où va l’argent que mes couples paient ?',
    a: 'Directement sur votre propre compte Stripe, que vous connectez en un clic. Wedillybird n’est jamais dans le flux, ne détient jamais vos fonds et ne prélève aucune commission — vous gardez vos frais Stripe et vos litiges comme d’habitude.',
  },
  {
    q: 'Mes données et celles de mes couples sont-elles protégées ?',
    a: 'Vos clients, mariages et galeries vous appartiennent. Export complet (JSON/CSV) disponible à tout moment, hébergement européen, et nous ne stockons jamais les numéros de carte. Une déconnexion d’intégration conserve toujours vos mariages.',
  },
  {
    q: 'Puis-je résilier quand je veux ?',
    a: 'Oui. La résiliation maintient votre accès jusqu’à l’échéance, conserve vos données et annule le prélèvement suivant. Les crédits pay-as-you-go déjà achetés ne sont jamais perdus.',
  },
  {
    q: 'Que se passe-t-il si je dépasse mon forfait ?',
    a: 'Rien ne casse : les dépassements sont facturés au-dessus du coût (messages 0,06 €, invité 0,25 €, stockage 0,03 €/Go/mois), avec compteur visible et alertes à 80 % et 100 %. Un upgrade est souvent moins cher que les add-ons cumulés.',
  },
  {
    q: 'Je débute, dois-je m’abonner tout de suite ?',
    a: 'Non. Le pay-as-you-go à 79 €/mariage vous laisse exécuter un événement sans engagement. Au-delà de deux mariages par mois, le forfait Starter devient plus rentable.',
  },
];
