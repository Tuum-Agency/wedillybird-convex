/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { listEventsInWindow } from '../../../convex/reminders';

/**
 * T2-5 : `listEventsInWindow` doit interroger `.withIndex('by_eventDate', …)`
 * au lieu d'un `.filter()` sur `.collect()` intégral de la table `events`
 * (cron quotidien des rappels J-7/J-1 — coût qui grossissait avec CHAQUE
 * event jamais créé). Ce test vérifie (a) que l'index est bien utilisé avec
 * les bonnes bornes, et (b) que le résultat reste identique au comportement
 * précédent (régression du refactor).
 */

type AnyFn = { _handler: (ctx: any, args: any) => Promise<unknown> };
const asFn = (m: unknown) => m as unknown as AnyFn;

describe('reminders.listEventsInWindow', () => {
  it("filtre via l'index by_eventDate (gte/lte) plutôt qu'un scan intégral, et enrichit avec la locale du owner", async () => {
    const start = 1_000_000;
    const end = 2_000_000;
    const fixtures = [
      {
        _id: 'ev_before',
        title: 'Avant fenêtre',
        eventDate: start - 1,
        timezone: 'Europe/Paris',
        status: 'active',
        coupleNames: { partnerA: 'A', partnerB: 'B' },
        ownerId: 'owner_before',
      },
      {
        _id: 'ev_in',
        title: 'Dans la fenêtre',
        eventDate: 1_500_000,
        timezone: 'Europe/Paris',
        status: 'active',
        coupleNames: { partnerA: 'C', partnerB: 'D' },
        messagingConfig: { preferredChannel: 'whatsapp' },
        ownerId: 'owner_in',
      },
      {
        _id: 'ev_after',
        title: 'Après fenêtre',
        eventDate: end + 1,
        timezone: 'Europe/Paris',
        status: 'active',
        coupleNames: { partnerA: 'E', partnerB: 'F' },
        ownerId: 'owner_after',
      },
    ];

    let capturedIndex: string | undefined;
    const captured: { gte?: number; lte?: number } = {};
    const gets: string[] = [];

    const ctx = {
      db: {
        query: (table: string) => {
          expect(table).toBe('events');
          return {
            withIndex: (indexName: string, rangeFn: (q: any) => any) => {
              capturedIndex = indexName;
              const qBuilder = {
                gte: (_field: string, val: number) => {
                  captured.gte = val;
                  return qBuilder;
                },
                lte: (_field: string, val: number) => {
                  captured.lte = val;
                  return qBuilder;
                },
              };
              rangeFn(qBuilder);
              return {
                collect: async () =>
                  fixtures.filter(
                    (e) => e.eventDate >= captured.gte! && e.eventDate <= captured.lte!,
                  ),
              };
            },
          };
        },
        get: async (ownerId: string) => {
          gets.push(ownerId);
          return { locale: 'fr' };
        },
      },
    };

    const res = (await asFn(listEventsInWindow)._handler(ctx, { start, end })) as Array<{
      _id: string;
    }>;

    expect(capturedIndex).toBe('by_eventDate');
    expect(captured).toEqual({ gte: start, lte: end });
    // Seul l'event dans la fenêtre est retourné — pas de fuite du scan complet.
    expect(res.map((e) => e._id)).toEqual(['ev_in']);
    expect(gets).toEqual(['owner_in']);
  });
});
