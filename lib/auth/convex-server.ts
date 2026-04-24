import 'server-only';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference, type FunctionReference } from 'convex/server';

let cachedClient: ConvexHttpClient | null = null;

export function getConvexServerClient(): ConvexHttpClient {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
  }
  cachedClient = new ConvexHttpClient(url);
  return cachedClient;
}

type Args = Record<string, unknown>;

export const convexApi = {
  requestOtp: makeFunctionReference<'action', { phone: string; ipAddress?: string }>(
    'auth:requestOtp',
  ),
  verifyOtp: makeFunctionReference<
    'mutation',
    { phone: string; code: string },
    { userId: string; sessionToken: string; phone: string }
  >('auth:verifyOtp'),
  currentUser: makeFunctionReference<
    'query',
    { userId: string },
    {
      _id: string;
      phone: string;
      email?: string;
      fullName?: string;
      avatarUrl?: string;
      role: 'couple' | 'pro' | 'guest' | 'admin';
      locale: 'fr';
      planTier?: string;
      createdAt: number;
      lastSeenAt?: number;
    } | null
  >('auth:currentUser'),
  completeOnboarding: makeFunctionReference<
    'mutation',
    { userId: string; fullName: string; role: 'couple' | 'pro'; email?: string },
    { ok: true }
  >('users:completeOnboarding'),
  userByPhone: makeFunctionReference<
    'query',
    { phone: string },
    {
      _id: string;
      phone: string;
      email?: string;
      fullName?: string;
      role: 'couple' | 'pro' | 'guest' | 'admin';
      locale: 'fr';
    } | null
  >('auth:userByPhone'),
  createEvent: makeFunctionReference<
    'mutation',
    {
      ownerId: string;
      title: string;
      partnerA: string;
      partnerB: string;
      eventDate: number;
      timezone: string;
      venue?: { name: string; address: string };
      theme?: { primaryColor: string; accentColor: string; fontFamily: string };
    },
    { id: string; slug: string }
  >('events:create'),
  listEventsByOwner: makeFunctionReference<
    'query',
    { ownerId: string },
    Array<{
      _id: string;
      slug: string;
      title: string;
      coupleNames: { partnerA: string; partnerB: string };
      eventDate: number;
      timezone: string;
      status: 'draft' | 'active' | 'archived' | 'cancelled';
      planTier: 'free' | 'essential' | 'premium';
      maxGuests: number;
      venue?: { name: string; address: string; lat?: number; lng?: number };
      updatedAt: number;
    }>
  >('events:listByOwner'),
} satisfies Record<
  string,
  FunctionReference<'query' | 'mutation' | 'action', 'public', Args, unknown>
>;
