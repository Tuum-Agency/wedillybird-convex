import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  detectDelimiter,
  autoMapColumns,
  buildClientRows,
  markDuplicates,
} from '../../../lib/pro/csv';

describe('detectDelimiter', () => {
  it('virgule vs point-virgule', () => {
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a;b;c')).toBe(';');
  });
});

describe('parseCsv', () => {
  it('champs simples', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('guillemets, virgules internes et échappement ""', () => {
    expect(parseCsv('nom,note\n"Awa, Karim","dit ""oui"""')).toEqual([
      ['nom', 'note'],
      ['Awa, Karim', 'dit "oui"'],
    ]);
  });
  it('délimiteur ; détecté', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('ignore les lignes vides + \\r\\n', () => {
    expect(parseCsv('a,b\r\n\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('autoMapColumns', () => {
  it('reconnaît les en-têtes FR', () => {
    expect(autoMapColumns(['Partenaire A', 'Partenaire B', 'Email', 'Téléphone'])).toEqual([
      'partnerA',
      'partnerB',
      'email',
      'phone',
    ]);
    expect(autoMapColumns(['Nom', 'Courriel', 'xyz'])).toEqual(['partnerA', 'email', 'ignore']);
  });
  it('chaque champ mappé au plus une fois', () => {
    const m = autoMapColumns(['Nom', 'Prénom']);
    expect(m.filter((f) => f === 'partnerA')).toHaveLength(1);
  });
});

describe('buildClientRows', () => {
  it('construit et ignore les lignes sans Partenaire A', () => {
    const rows = buildClientRows(
      [
        ['Awa', 'Karim', 'a@b.fr'],
        ['', 'x', ''],
      ],
      ['partnerA', 'partnerB', 'email'],
    );
    expect(rows).toEqual([
      { partnerA: 'Awa', partnerB: 'Karim', email: 'a@b.fr', phone: undefined },
    ]);
  });
});

describe('markDuplicates', () => {
  it('marque les doublons existants et internes', () => {
    const out = markDuplicates(
      [{ partnerA: 'Awa' }, { partnerA: 'Léa' }, { partnerA: 'Awa' }],
      new Set(['léa']),
    );
    expect(out.map((r) => r.duplicate)).toEqual([false, true, true]);
  });
});
