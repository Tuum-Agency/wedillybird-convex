import { describe, it, expect } from 'vitest';
import {
  mergeFields,
  nextStatus,
  nextStatusLabel,
  contractTone,
  isContractStatus,
  CONTRACT_STATUS_LABEL,
  CONTRACT_SECTIONS,
  CONTRACT_TEMPLATES,
  JURISDICTIONS,
  getJurisdiction,
  esignFramework,
  generateContractSections,
  bookingCurrentStep,
  AI_DISCLAIMER,
  SERVICE_TYPES,
} from '../../../lib/pro/contracts';

describe('mergeFields', () => {
  it('remplace les champs connus, « … » sinon', () => {
    expect(mergeFields('Total {{total}}, lieu {{lieu}}', { total: '2 500 €' })).toBe(
      'Total 2 500 €, lieu …',
    );
  });
  it('sans champ → texte intact', () => {
    expect(mergeFields('Aucun champ ici', {})).toBe('Aucun champ ici');
  });
});

describe('cycle de vie', () => {
  it('nextStatus parcourt le cycle puis null', () => {
    expect(nextStatus('draft')).toBe('sent');
    expect(nextStatus('sent')).toBe('signed_client');
    expect(nextStatus('signed_client')).toBe('countersigned');
    expect(nextStatus('countersigned')).toBe('active');
    expect(nextStatus('active')).toBeNull();
    expect(nextStatus('cancelled')).toBeNull();
  });
  it('nextStatusLabel', () => {
    expect(nextStatusLabel('draft')).toBe('Envoyer pour signature');
    expect(nextStatusLabel('sent')).toBe('Marquer signé par le couple');
    expect(nextStatusLabel('signed_client')).toBe('Contre-signer');
    expect(nextStatusLabel('countersigned')).toBe('Activer le contrat');
    expect(nextStatusLabel('active')).toBeNull();
  });
});

describe('tonalités, gardes & constantes', () => {
  it('contractTone', () => {
    expect(contractTone('active')).toBe('ok');
    expect(contractTone('cancelled')).toBe('danger');
    expect(contractTone('sent')).toBe('info');
    expect(contractTone('signed_client')).toBe('warn');
    expect(contractTone('draft')).toBe('muted');
  });
  it('isContractStatus', () => {
    expect(isContractStatus('active')).toBe(true);
    expect(isContractStatus('paid')).toBe(false);
    expect(isContractStatus(null)).toBe(false);
  });
  it('libellés + clauses + modèles standard', () => {
    expect(CONTRACT_STATUS_LABEL.signed_client).toBe('Signé par le couple');
    expect(CONTRACT_SECTIONS).toHaveLength(6);
    expect(CONTRACT_SECTIONS[0]?.title).toBe('Parties');
    expect(CONTRACT_TEMPLATES.length).toBe(3);
  });
});

describe('assistant IA — country-aware', () => {
  it('getJurisdiction connaît FR/US et retombe sur FR', () => {
    expect(getJurisdiction('FR').label).toBe('France');
    expect(getJurisdiction('US').label).toBe('États-Unis');
    expect(getJurisdiction('ZZ').code).toBe('FR'); // fallback
    expect(getJurisdiction(undefined).code).toBe('FR');
  });
  it('cadre e-signature : eIDAS (UE) vs ESIGN/UETA (US) vs PIPEDA (CA)', () => {
    expect(esignFramework('FR').label).toBe('eIDAS');
    expect(esignFramework('CH').label).toBe('eIDAS');
    expect(esignFramework('US').label).toBe('ESIGN / UETA');
    expect(esignFramework('CA-QC').label).toBe('PIPEDA');
  });
  it('génère 6 clauses adaptées à la juridiction (loi applicable)', () => {
    const fr = generateContractSections({ jurisdiction: 'FR', serviceType: 'coordination' });
    expect(fr).toHaveLength(6);
    const lawFr = fr.find((s) => s.title === 'Loi applicable & signature')!;
    expect(lawFr.body).toContain('droit français');
    expect(lawFr.body).toContain('eIDAS');

    const us = generateContractSections({ jurisdiction: 'US', serviceType: 'coordination' });
    const lawUs = us.find((s) => s.title === 'Loi applicable & signature')!;
    expect(lawUs.body).toContain('ESIGN / UETA');
    const cancelUs = us.find((s) => s.title.startsWith('Annulation'))!;
    expect(cancelUs.body).toContain('non-refundable retainer');
  });
  it('le type de prestation change l’objet', () => {
    const coord = generateContractSections({ jurisdiction: 'FR', serviceType: 'coordination' });
    const full = generateContractSections({ jurisdiction: 'FR', serviceType: 'complete' });
    const objCoord = coord.find((s) => s.title === 'Objet & prestations')!.body;
    const objFull = full.find((s) => s.title === 'Objet & prestations')!.body;
    expect(objCoord).not.toBe(objFull);
    expect(objFull).toContain('organisation complète');
  });
  it('disclaimer présent + juridictions/services couverts', () => {
    expect(AI_DISCLAIMER).toContain('professionnel du droit');
    expect(JURISDICTIONS.length).toBeGreaterThanOrEqual(5);
    expect(SERVICE_TYPES.map((s) => s.id)).toContain('intimate');
  });
});

describe('smart-file (dossier de réservation)', () => {
  it('étape courante selon le statut', () => {
    expect(bookingCurrentStep('draft')).toBe(2);
    expect(bookingCurrentStep('sent')).toBe(2);
    expect(bookingCurrentStep('signed_client')).toBe(3);
    expect(bookingCurrentStep('countersigned')).toBe(3);
    expect(bookingCurrentStep('active')).toBe(5);
  });
});
