import { describe, expect, it } from 'vitest';
import { autoPlace, type AutoPlaceGuest } from '../../../convex/lib/autoplace';

const g = (id: string, seats = 1, category?: string): AutoPlaceGuest => ({
  _id: id,
  seats,
  ...(category ? { category } : {}),
});

describe('autoPlace', () => {
  it('rien à placer → résultat vide', () => {
    expect(autoPlace([], [{ _id: 't1', remaining: 8 }], 8)).toEqual({
      assignments: [],
      newTables: [],
      unplaced: [],
    });
  });

  it('place tout dans une table existante si la capacité suffit', () => {
    const res = autoPlace([g('a'), g('b')], [{ _id: 't1', remaining: 8 }], 8);
    expect(res.newTables).toHaveLength(0);
    expect(res.assignments).toEqual([
      { guestId: 'a', tableId: 't1' },
      { guestId: 'b', tableId: 't1' },
    ]);
  });

  it('crée une nouvelle table en cas de débordement', () => {
    const res = autoPlace([g('a'), g('b'), g('c')], [{ _id: 't1', remaining: 2 }], 8);
    expect(res.assignments).toEqual([
      { guestId: 'a', tableId: 't1' },
      { guestId: 'b', tableId: 't1' },
    ]);
    expect(res.newTables).toEqual([{ capacity: 8, guestIds: ['c'] }]);
  });

  it('respecte la capacité : un duo (2 places) ne rentre pas dans 1 place restante', () => {
    const res = autoPlace([g('a', 2)], [{ _id: 't1', remaining: 1 }], 8);
    expect(res.assignments).toHaveLength(0);
    expect(res.newTables).toEqual([{ capacity: 8, guestIds: ['a'] }]);
  });

  it('regroupe par catégorie en privilégiant des tables fraîches', () => {
    const res = autoPlace(
      [g('f1', 1, 'Famille'), g('f2', 1, 'Famille'), g('a1', 1, 'Amis'), g('a2', 1, 'Amis')],
      [
        { _id: 't1', remaining: 8 },
        { _id: 't2', remaining: 8 },
      ],
      8,
    );
    expect(res.newTables).toHaveLength(0);
    const t1 = res.assignments.filter((a) => a.tableId === 't1').map((a) => a.guestId);
    const t2 = res.assignments.filter((a) => a.tableId === 't2').map((a) => a.guestId);
    expect(t1).toEqual(['f1', 'f2']);
    expect(t2).toEqual(['a1', 'a2']);
  });

  it('grande tablée (> capacité par défaut) → nouvelle table dimensionnée au groupe', () => {
    const res = autoPlace([g('big', 10)], [], 8);
    expect(res.newTables).toEqual([{ capacity: 10, guestIds: ['big'] }]);
  });

  it('compte les places (invité + accompagnants) dans la capacité', () => {
    // 1 table de 3 : un invité de 2 places + un d'1 place tiennent (=3), le 3e déborde.
    const res = autoPlace([g('a', 2), g('b', 1), g('c', 1)], [{ _id: 't1', remaining: 3 }], 8);
    expect(res.assignments).toEqual([
      { guestId: 'a', tableId: 't1' },
      { guestId: 'b', tableId: 't1' },
    ]);
    expect(res.newTables).toEqual([{ capacity: 8, guestIds: ['c'] }]);
  });

  describe('réglages (options)', () => {
    it('createTables=false : laisse les surplus non placés au lieu d’ouvrir une table', () => {
      const res = autoPlace([g('a'), g('b'), g('c')], [{ _id: 't1', remaining: 2 }], 8, {
        createTables: false,
      });
      expect(res.assignments).toEqual([
        { guestId: 'a', tableId: 't1' },
        { guestId: 'b', tableId: 't1' },
      ]);
      expect(res.newTables).toHaveLength(0);
      expect(res.unplaced).toEqual(['c']);
    });

    it('groupByCategory=false : ignore les catégories (un seul flux d’ordre)', () => {
      // Sans groupement, le remplissage serré tasse t1 avant d'ouvrir/d'utiliser t2.
      const res = autoPlace(
        [g('f1', 1, 'Famille'), g('a1', 1, 'Amis'), g('f2', 1, 'Famille')],
        [
          { _id: 't1', remaining: 2 },
          { _id: 't2', remaining: 8 },
        ],
        8,
        { groupByCategory: false, keepGroupsTogether: false },
      );
      const t1 = res.assignments.filter((a) => a.tableId === 't1').map((a) => a.guestId);
      // Remplissage serré : t1 (2 places) se remplit en premier, dans l'ordre d'arrivée.
      expect(t1).toEqual(['f1', 'a1']);
    });

    it('balanceTables=true : étale sur la table la plus vide', () => {
      // 2 tables ; en équilibrage, on démarre par la plus vide puis on alterne vers l'autre.
      const res = autoPlace(
        [g('a'), g('b')],
        [
          { _id: 't1', remaining: 4 },
          { _id: 't2', remaining: 9 },
        ],
        8,
        { groupByCategory: false, keepGroupsTogether: false, balanceTables: true },
      );
      // a → t2 (la plus vide : 9 > 4) ; b → t2 reste la plus vide (8 > 4) → tasse pas, étale.
      expect(res.assignments[0]).toEqual({ guestId: 'a', tableId: 't2' });
    });

    it('grande tablée + createTables=false → non placée', () => {
      const res = autoPlace([g('big', 10)], [{ _id: 't1', remaining: 4 }], 8, {
        createTables: false,
      });
      expect(res.assignments).toHaveLength(0);
      expect(res.newTables).toHaveLength(0);
      expect(res.unplaced).toEqual(['big']);
    });
  });
});
