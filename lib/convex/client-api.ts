import { makeFunctionReference } from 'convex/server';

export const clientApi = {
  countGuestsByEvent: makeFunctionReference<
    'query',
    { eventId: string; requesterId: string },
    { total: number; attending: number; declined: number; pending: number; maybe: number }
  >('guests:countByEvent'),
};
