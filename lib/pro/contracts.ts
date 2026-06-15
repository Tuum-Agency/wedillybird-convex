/**
 * Contrats — types + helpers purs (statuts, clauses standard, fusion de
 * champs), partagés UI + Convex + tests. La signature électronique est
 * matérialisée par des transitions de statut manuelles (pas de service e-sign
 * externe branché) ; chaque transition est tracée dans l'audit.
 */

export const CONTRACT_STATUSES = [
  'draft',
  'sent',
  'signed_client',
  'countersigned',
  'active',
  'cancelled',
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  signed_client: 'Signé par le couple',
  countersigned: 'Contre-signé',
  active: 'Actif',
  cancelled: 'Annulé',
};

export type ContractTone = 'muted' | 'info' | 'warn' | 'ok' | 'danger';
const TONE: Record<ContractStatus, ContractTone> = {
  draft: 'muted',
  sent: 'info',
  signed_client: 'warn',
  countersigned: 'warn',
  active: 'ok',
  cancelled: 'danger',
};
export function contractTone(status: ContractStatus): ContractTone {
  return TONE[status] ?? 'muted';
}

export function isContractStatus(v: unknown): v is ContractStatus {
  return typeof v === 'string' && (CONTRACT_STATUSES as readonly string[]).includes(v);
}

export interface ContractSection {
  title: string;
  body: string;
}

/** Clauses standard d'un contrat de coordination de mariage (FR). */
export const CONTRACT_SECTIONS: ContractSection[] = [
  {
    title: 'Parties',
    body: 'Entre l’agence {{agence}}, représentée par {{planner}}, ci-après « le Prestataire », et {{couple}}, ci-après « les Clients ». Les parties conviennent de ce qui suit pour le mariage prévu le {{date}} à {{lieu}}.',
  },
  {
    title: 'Objet & prestations',
    body: 'Le Prestataire assure la coordination du jour J (12 h de présence), la supervision de l’équipe et des prestataires, ainsi que le repérage et le plan de salle. Toute prestation supplémentaire fera l’objet d’un avenant écrit.',
  },
  {
    title: 'Prix & échéancier',
    body: 'Le montant total de la prestation s’élève à {{total}}. Un acompte de 30 % ({{acompte}}) est dû à la signature ; le solde ({{solde}}) est exigible au plus tard le {{echeance_solde}}.',
  },
  {
    title: 'Annulation, report & force majeure',
    body: 'En cas d’annulation par les Clients, l’acompte reste acquis au Prestataire. Le report de date est gratuit dans la limite des disponibilités. En cas de force majeure (art. 1218 C. civ.), les parties rechercheront une solution amiable ; aucune pénalité ne sera due.',
  },
  {
    title: 'Propriété des photos & données (RGPD)',
    body: 'Les photos restent la propriété des Clients. Le Prestataire peut utiliser quelques clichés à des fins de portfolio sauf refus écrit. Les données personnelles sont traitées conformément au RGPD ; les Clients disposent d’un droit d’accès et d’effacement.',
  },
  {
    title: 'Conditions générales',
    body: 'Le présent contrat est régi par le droit applicable au lieu de l’événement. Tout litige sera soumis aux juridictions compétentes après tentative de résolution amiable. La signature électronique vaut accord des parties.',
  },
];

/** Modèles de contrats proposés (présentés en tête de la page). */
export const CONTRACT_TEMPLATES = [
  {
    id: 'coordination',
    name: 'Coordination jour J',
    desc: '12 h de présence · supervision · plan de salle',
  },
  { id: 'complete', name: 'Organisation complète', desc: 'De la recherche de lieu au jour J' },
  { id: 'intimate', name: 'Mariage intime', desc: 'Petit comité · prestation allégée' },
] as const;

/* ============================ ASSISTANT IA — GÉNÉRATION COUNTRY-AWARE ============================
 * Générateur de clauses **déterministe** adapté à la juridiction et au type de
 * prestation. Ce n'est pas un avis juridique : les clauses sont des modèles types
 * à faire relire (voir AI_DISCLAIMER). Country-aware = loi applicable, force
 * majeure, protection des données et cadre de signature électronique adaptés.
 */

export type ServiceType = 'coordination' | 'complete' | 'intimate';

export const SERVICE_TYPES: { id: ServiceType; name: string; desc: string }[] = [
  {
    id: 'coordination',
    name: 'Coordination jour J',
    desc: '12 h de présence · supervision · plan de salle',
  },
  { id: 'complete', name: 'Organisation complète', desc: 'De la recherche de lieu au jour J' },
  { id: 'intimate', name: 'Mariage intime', desc: 'Petit comité · prestation allégée' },
];

const SERVICE_SCOPE: Record<ServiceType, string> = {
  coordination:
    'la coordination du jour J (12 h de présence), la supervision de l’équipe et des prestataires, ainsi que le repérage et le plan de salle',
  complete:
    'l’organisation complète du mariage : recherche et réservation du lieu et des prestataires, gestion du budget, suivi du rétroplanning et coordination du jour J',
  intimate:
    'la coordination d’un mariage en petit comité : conseil, sélection des prestataires essentiels et présence le jour J (6 h)',
};

/** Cadre de signature électronique (UE / US / Canada). */
export type EsignKey = 'eidas' | 'esign_ueta' | 'pipeda';
export interface EsignFramework {
  key: EsignKey;
  /** Standard cité dans l'audit (ex. « eIDAS »). */
  label: string;
  /** Description courte pour la bannière d'audit. */
  note: string;
}
export const ESIGN_FRAMEWORKS: Record<EsignKey, EsignFramework> = {
  eidas: {
    key: 'eidas',
    label: 'eIDAS',
    note: 'Signature électronique simple conforme au règlement eIDAS (UE n° 910/2014), avec piste d’audit horodatée.',
  },
  esign_ueta: {
    key: 'esign_ueta',
    label: 'ESIGN / UETA',
    note: 'Electronic signature under the U.S. ESIGN Act and UETA, with a timestamped audit trail.',
  },
  pipeda: {
    key: 'pipeda',
    label: 'PIPEDA',
    note: 'Signature électronique conforme à la PIPEDA et aux lois provinciales, avec piste d’audit horodatée.',
  },
};

export interface Jurisdiction {
  code: string;
  label: string;
  /** Nom de la loi applicable cité dans la clause « loi applicable ». */
  governingLaw: string;
  /** Référence de force majeure locale. */
  forceMajeure: string;
  /** Clause d'annulation / sort de l'acompte. */
  cancellation: string;
  /** Loi de protection des données applicable. */
  dataLaw: string;
  /** Juridiction compétente en cas de litige. */
  courts: string;
  esign: EsignKey;
}

/** Juridictions couvertes par l'assistant (UE + Suisse + Canada-Québec + US). */
export const JURISDICTIONS: Jurisdiction[] = [
  {
    code: 'FR',
    label: 'France',
    governingLaw: 'le droit français',
    forceMajeure: 'l’article 1218 du Code civil',
    cancellation:
      'l’acompte reste acquis au Prestataire ; si les sommes versées constituent des arrhes, l’article 1590 du Code civil s’applique',
    dataLaw: 'au RGPD (Règlement (UE) 2016/679) et à la loi Informatique et Libertés',
    courts: 'les juridictions françaises compétentes',
    esign: 'eidas',
  },
  {
    code: 'BE',
    label: 'Belgique',
    governingLaw: 'le droit belge',
    forceMajeure: 'les articles 5.226 et suivants du Code civil belge',
    cancellation: 'l’acompte reste acquis au Prestataire, sauf stipulation contraire',
    dataLaw: 'au RGPD (Règlement (UE) 2016/679)',
    courts: 'les juridictions belges compétentes',
    esign: 'eidas',
  },
  {
    code: 'CH',
    label: 'Suisse',
    governingLaw: 'le droit suisse',
    forceMajeure: 'l’article 119 du Code des obligations',
    cancellation: 'l’acompte reste acquis au Prestataire, sauf convention contraire',
    dataLaw: 'à la nLPD (loi fédérale sur la protection des données)',
    courts: 'les tribunaux suisses compétents',
    esign: 'eidas',
  },
  {
    code: 'LU',
    label: 'Luxembourg',
    governingLaw: 'le droit luxembourgeois',
    forceMajeure: 'les principes de force majeure du droit luxembourgeois',
    cancellation: 'l’acompte reste acquis au Prestataire, sauf stipulation contraire',
    dataLaw: 'au RGPD (Règlement (UE) 2016/679)',
    courts: 'les juridictions luxembourgeoises compétentes',
    esign: 'eidas',
  },
  {
    code: 'CA-QC',
    label: 'Canada (Québec)',
    governingLaw: 'le droit applicable au Québec (Canada)',
    forceMajeure: 'l’article 1470 du Code civil du Québec',
    cancellation: 'l’acompte demeure acquis au Prestataire, sauf convention contraire',
    dataLaw: 'à la Loi 25 (protection des renseignements personnels) et à la PIPEDA',
    courts: 'les tribunaux du district judiciaire du lieu de l’événement',
    esign: 'pipeda',
  },
  {
    code: 'US',
    label: 'États-Unis',
    governingLaw: 'le droit de l’État du lieu de l’événement (États-Unis)',
    forceMajeure: 'la doctrine de force majeure (« force majeure / impossibility ») applicable',
    cancellation:
      'l’acompte est non remboursable (« non-refundable retainer »), à titre de liquidated damages, dans la mesure permise par l’État',
    dataLaw: 'aux lois applicables sur la confidentialité (CCPA et lois d’État)',
    courts: 'les juridictions compétentes de l’État du lieu de l’événement',
    esign: 'esign_ueta',
  },
];

export const DEFAULT_JURISDICTION = 'FR';

export function getJurisdiction(code: string | undefined | null): Jurisdiction {
  return JURISDICTIONS.find((j) => j.code === code) ?? JURISDICTIONS[0]!;
}

export function esignFramework(code: string | undefined | null): EsignFramework {
  return ESIGN_FRAMEWORKS[getJurisdiction(code).esign];
}

/** Avertissement légal affiché sous toute clause générée. */
export const AI_DISCLAIMER =
  'Clauses générées automatiquement à partir de modèles juridiques types, adaptées à la juridiction sélectionnée. Wedillybird n’est pas un cabinet d’avocats : faites relire ce contrat par un professionnel du droit avant signature.';

/**
 * Génère un jeu de clauses adapté à la juridiction + au type de prestation.
 * Les champs `{{...}}` restent fusionnés à l'affichage (preview/PDF).
 */
export function generateContractSections(opts: {
  jurisdiction: string;
  serviceType: ServiceType;
}): ContractSection[] {
  const j = getJurisdiction(opts.jurisdiction);
  const esign = ESIGN_FRAMEWORKS[j.esign];
  return [
    {
      title: 'Parties',
      body: 'Entre l’agence {{agence}}, représentée par {{planner}}, ci-après « le Prestataire », et {{couple}}, ci-après « les Clients ». Les parties conviennent de ce qui suit pour le mariage prévu le {{date}} à {{lieu}}.',
    },
    {
      title: 'Objet & prestations',
      body: `Le Prestataire assure ${SERVICE_SCOPE[opts.serviceType]}. Toute prestation supplémentaire fera l’objet d’un avenant écrit.`,
    },
    {
      title: 'Prix & échéancier',
      body: 'Le montant total de la prestation s’élève à {{total}}. Un acompte de 30 % ({{acompte}}) est dû à la signature ; le solde ({{solde}}) est exigible au plus tard le {{echeance_solde}}.',
    },
    {
      title: 'Annulation, report & force majeure',
      body: `En cas d’annulation par les Clients, ${j.cancellation}. Le report de date est gratuit dans la limite des disponibilités. En cas de force majeure (${j.forceMajeure}), les parties rechercheront une solution amiable.`,
    },
    {
      title: 'Propriété des photos & données',
      body: `Les photos restent la propriété des Clients. Le Prestataire peut utiliser quelques clichés à des fins de portfolio, sauf refus écrit. Les données personnelles sont traitées conformément ${j.dataLaw} ; les Clients disposent d’un droit d’accès et d’effacement.`,
    },
    {
      title: 'Loi applicable & signature',
      body: `Le présent contrat est régi par ${j.governingLaw}. Tout litige sera soumis à ${j.courts} après tentative de résolution amiable. La signature électronique (${esign.label}) vaut accord des parties et engagement ferme.`,
    },
  ];
}

/* ---- smart-file : étape courante du dossier de réservation depuis le statut ---- */
/**
 * Index de l'étape « en cours » du dossier (les étapes précédentes sont faites) :
 * 0 quote_sent · 1 quote_accepted · 2 contract_signed · 3 deposit_paid · 4 booked.
 */
export function bookingCurrentStep(status: ContractStatus): number {
  switch (status) {
    case 'draft':
    case 'sent':
      return 2; // devis accepté → contrat à signer
    case 'signed_client':
    case 'countersigned':
      return 3; // contrat signé → acompte à régler
    case 'active':
      return 5; // tout est fait (réservé)
    default:
      return 2; // annulé → dossier figé à la signature
  }
}

/** Remplace les champs `{{cle}}` d'une clause par les valeurs fournies. */
export function mergeFields(body: string, ctx: Record<string, string | undefined>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (ctx[k] != null ? String(ctx[k]) : '…'));
}

/** Étapes du dossier de réservation (smart-file) reliant devis → contrat → acompte. */
export const BOOKING_STEPS = [
  { k: 'quote_sent', label: 'Devis envoyé' },
  { k: 'quote_accepted', label: 'Devis accepté' },
  { k: 'contract_signed', label: 'Contrat signé' },
  { k: 'deposit_paid', label: 'Acompte payé' },
  { k: 'booked', label: 'Réservé' },
] as const;

/** Prochaine transition « avancer » selon le statut courant (null si terminal). */
export function nextStatus(status: ContractStatus): ContractStatus | null {
  switch (status) {
    case 'draft':
      return 'sent';
    case 'sent':
      return 'signed_client';
    case 'signed_client':
      return 'countersigned';
    case 'countersigned':
      return 'active';
    default:
      return null;
  }
}

/** Libellé d'action pour la transition « avancer ». */
export function nextStatusLabel(status: ContractStatus): string | null {
  switch (status) {
    case 'draft':
      return 'Envoyer pour signature';
    case 'sent':
      return 'Marquer signé par le couple';
    case 'signed_client':
      return 'Contre-signer';
    case 'countersigned':
      return 'Activer le contrat';
    default:
      return null;
  }
}
