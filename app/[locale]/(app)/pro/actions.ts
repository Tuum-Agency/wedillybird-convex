'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { convexApi, getConvexServerClient } from '@/lib/auth/convex-server';
import { stripeConnectAuthorizeUrl, deauthorizeStripeConnect } from '@/lib/payments/drivers/stripe';
import { signConnectState, connectStateSecret } from '@/lib/payments/connect-oauth-state';
import { appOrigin } from '@/lib/reminders/window';

const E164 = /^\+[1-9]\d{6,14}$/;
const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export type CreateOrgResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: 'UNAUTHORIZED' | 'NOT_PRO' | 'INVALID_NAME' | 'UNKNOWN' };

export async function createOrganizationAction(formData: FormData): Promise<CreateOrgResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  const name = ((formData.get('name') as string | null) ?? '').trim();
  if (name.length < 1 || name.length > 120) return { ok: false, error: 'INVALID_NAME' };

  const primary = (formData.get('primaryColor') as string | null)?.trim() || undefined;
  const accent = (formData.get('accentColor') as string | null)?.trim() || undefined;

  try {
    const convex = getConvexServerClient();
    const { id, slug } = await convex.mutation(convexApi.createOrganization, {
      ownerId: session.userId,
      name,
      primaryColor: primary,
      accentColor: accent,
    });
    revalidatePath('/pro/dashboard');
    return { ok: true, id, slug };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'NOT_PRO') return { ok: false, error: 'NOT_PRO' };
    if (message === 'INVALID_NAME') return { ok: false, error: 'INVALID_NAME' };
    return { ok: false, error: 'UNKNOWN' };
  }
}

export type CreateWeddingResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

/**
 * Crée un mariage **rattaché à l'organisation** de l'agent connecté (back-office
 * pro), depuis le dialog « Nouveau mariage ». Distinct du parcours couple
 * `/events/new` (obsolète côté agence).
 */
export async function createOrgWeddingAction(input: {
  partnerA: string;
  partnerB: string;
  eventDate: number;
  venueName?: string;
  venueAddress?: string;
}): Promise<CreateWeddingResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  const partnerA = input.partnerA.trim();
  const partnerB = input.partnerB.trim();
  if (!partnerA || !partnerB) return { ok: false, error: 'INVALID_NAMES' };
  if (!Number.isFinite(input.eventDate)) return { ok: false, error: 'INVALID_DATE' };
  try {
    const convex = getConvexServerClient();
    const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
    if (!org) return { ok: false, error: 'NOT_PRO' };
    const venueName = input.venueName?.trim();
    const res = await convex.mutation(convexApi.createEvent, {
      ownerId: session.userId,
      organizationId: org._id,
      title: `${partnerA} & ${partnerB}`,
      partnerA,
      partnerB,
      eventDate: input.eventDate,
      timezone: 'Europe/Paris',
      ...(venueName
        ? { venue: { name: venueName, address: input.venueAddress?.trim() ?? '' } }
        : {}),
    });
    revalidatePath('/pro/weddings');
    revalidatePath('/pro/dashboard');
    return { ok: true, id: res.id, slug: res.slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export type InviteMemberResult =
  | { ok: true; inviteToken: string }
  | {
      ok: false;
      error:
        | 'UNAUTHORIZED'
        | 'FORBIDDEN'
        | 'INVALID_PHONE'
        | 'NO_CONTACT'
        | 'ALREADY_MEMBER'
        | 'CANNOT_ASSIGN_OWNER'
        | 'UNKNOWN';
    };

export async function inviteMemberAction(
  organizationId: string,
  formData: FormData,
): Promise<InviteMemberResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  const phone = ((formData.get('phone') as string | null) ?? '').trim() || undefined;
  const email = ((formData.get('email') as string | null) ?? '').trim().toLowerCase() || undefined;
  const role = formData.get('role') as 'admin' | 'planner' | 'viewer' | null;

  if (!phone && !email) return { ok: false, error: 'NO_CONTACT' };
  if (phone && !E164.test(phone)) return { ok: false, error: 'INVALID_PHONE' };
  if (role !== 'admin' && role !== 'planner' && role !== 'viewer') {
    return { ok: false, error: 'CANNOT_ASSIGN_OWNER' };
  }

  try {
    const convex = getConvexServerClient();
    const result = await convex.mutation(convexApi.inviteOrgMember, {
      organizationId,
      requesterId: session.userId,
      phone,
      email,
      role,
    });
    revalidatePath('/pro/team');
    return { ok: true, inviteToken: result.inviteToken };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    if (message === 'FORBIDDEN') return { ok: false, error: 'FORBIDDEN' };
    if (message === 'ALREADY_MEMBER') return { ok: false, error: 'ALREADY_MEMBER' };
    if (message === 'CANNOT_ASSIGN_OWNER') return { ok: false, error: 'CANNOT_ASSIGN_OWNER' };
    if (message === 'NO_CONTACT') return { ok: false, error: 'NO_CONTACT' };
    return { ok: false, error: 'UNKNOWN' };
  }
}

export async function revokeMemberAction(
  membershipId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.revokeOrgMembership, {
      membershipId,
      requesterId: session.userId,
    });
    revalidatePath('/pro/team');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function changeMemberRoleAction(
  membershipId: string,
  role: 'admin' | 'planner' | 'viewer',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.updateMemberRole, {
      membershipId,
      requesterId: session.userId,
      role,
    });
    revalidatePath('/pro/team');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function cancelInviteAction(
  membershipId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.cancelOrgInvite, { membershipId, requesterId: session.userId });
    revalidatePath('/pro/team');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function resendInviteAction(
  membershipId: string,
): Promise<{ ok: true; inviteToken: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  try {
    const convex = getConvexServerClient();
    const r = await convex.mutation(convexApi.resendOrgInvite, {
      membershipId,
      requesterId: session.userId,
    });
    revalidatePath('/pro/team');
    return { ok: true, inviteToken: r.inviteToken };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function reactivateMemberAction(
  membershipId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  try {
    const convex = getConvexServerClient();
    await convex.mutation(convexApi.reactivateOrgMember, {
      membershipId,
      requesterId: session.userId,
    });
    revalidatePath('/pro/team');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export async function acceptInviteAction(
  token: string,
): Promise<{ ok: true; organizationId: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  try {
    const convex = getConvexServerClient();
    const result = await convex.mutation(convexApi.acceptOrgInvite, {
      token,
      userId: session.userId,
    });
    revalidatePath('/pro/dashboard');
    return { ok: true, organizationId: result.organizationId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export type UpdateBrandingResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'UNAUTHORIZED'
        | 'NO_ORG'
        | 'FORBIDDEN'
        | 'INVALID_COLOR'
        | 'INVALID_LOGO_TYPE'
        | 'INVALID_LOGO_SIZE'
        | 'UPLOAD_FAILED'
        | 'UNKNOWN';
    };

/**
 * Met à jour le branding (logo + couleurs) de l'organisation du pro
 * connecté.
 *
 * Pour le logo : on génère une upload URL Convex (mutation
 * `organizations:generateLogoUploadUrl`), on POST le blob côté serveur, on
 * récupère le `storageId` retourné par Convex, puis on commit via
 * `setLogo`. C'est la même mécanique que `ConvexHttpClient` côté browser,
 * mais en server-side : on évite de passer par le client (limite 4 Mo des
 * server actions, mais le logo fait max 2 Mo donc OK).
 *
 * Pour les couleurs : validation hex côté serveur en plus du `accept` côté
 * input (l'input color pourrait être contourné via un client modifié).
 */
export async function updateOrgBrandingAction(formData: FormData): Promise<UpdateBrandingResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };

  const primary = ((formData.get('primaryColor') as string | null) ?? '').trim();
  const accent = ((formData.get('accentColor') as string | null) ?? '').trim();
  const file = formData.get('logo');
  const removeLogo = formData.get('removeLogo') === 'true';

  if (primary && !HEX_COLOR_RE.test(primary)) return { ok: false, error: 'INVALID_COLOR' };
  if (accent && !HEX_COLOR_RE.test(accent)) return { ok: false, error: 'INVALID_COLOR' };

  const convex = getConvexServerClient();

  let org;
  try {
    org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  } catch {
    return { ok: false, error: 'UNKNOWN' };
  }
  if (!org) return { ok: false, error: 'NO_ORG' };
  if (org.myRole !== 'owner' && org.myRole !== 'admin') {
    return { ok: false, error: 'FORBIDDEN' };
  }

  let logoStorageId: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
      return { ok: false, error: 'INVALID_LOGO_TYPE' };
    }
    if (file.size > LOGO_MAX_BYTES) return { ok: false, error: 'INVALID_LOGO_SIZE' };

    let uploadUrl: string;
    try {
      const r = await convex.mutation(convexApi.generateOrgLogoUploadUrl, {
        organizationId: org._id,
        requesterId: session.userId,
      });
      uploadUrl = r.uploadUrl;
    } catch {
      return { ok: false, error: 'UPLOAD_FAILED' };
    }

    let storageId: string;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: buffer,
      });
      if (!res.ok) return { ok: false, error: 'UPLOAD_FAILED' };
      const json = (await res.json()) as { storageId?: string };
      if (!json.storageId) return { ok: false, error: 'UPLOAD_FAILED' };
      storageId = json.storageId;
    } catch {
      return { ok: false, error: 'UPLOAD_FAILED' };
    }

    try {
      await convex.mutation(convexApi.setOrgLogo, {
        organizationId: org._id,
        requesterId: session.userId,
        logoStorageId: storageId,
      });
      logoStorageId = storageId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      if (message === 'FORBIDDEN') return { ok: false, error: 'FORBIDDEN' };
      return { ok: false, error: 'UNKNOWN' };
    }
  } else if (removeLogo) {
    try {
      await convex.mutation(convexApi.clearOrgLogo, {
        organizationId: org._id,
        requesterId: session.userId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      if (message === 'FORBIDDEN') return { ok: false, error: 'FORBIDDEN' };
      return { ok: false, error: 'UNKNOWN' };
    }
  }

  // Patch couleurs (et nom optionnellement plus tard) si renseignées.
  if (primary || accent) {
    try {
      await convex.mutation(convexApi.updateOrgBranding, {
        organizationId: org._id,
        requesterId: session.userId,
        primaryColor: primary || undefined,
        accentColor: accent || undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNKNOWN';
      if (message === 'FORBIDDEN') return { ok: false, error: 'FORBIDDEN' };
      if (message.startsWith('INVALID_')) return { ok: false, error: 'INVALID_COLOR' };
      return { ok: false, error: 'UNKNOWN' };
    }
  }

  // Side-effect: silence the lint about unused value after early returns.
  void logoStorageId;

  revalidatePath('/pro/settings');
  revalidatePath('/pro/dashboard');
  revalidatePath('/pro/billing');
  return { ok: true };
}

export type DangerResult = { ok: true } | { ok: false; error: string };

/** Zone de danger — transfère la propriété de l'organisation à un membre. */
export async function transferOwnershipAction(newOwnerUserId: string): Promise<DangerResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };
  try {
    await convex.mutation(convexApi.transferOrgOwnership, {
      organizationId: org._id,
      requesterId: session.userId,
      newOwnerUserId,
    });
    revalidatePath('/pro/settings');
    revalidatePath('/pro/team');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

/** Zone de danger — supprime définitivement l'organisation (saisie du nom requise). */
export async function deleteOrganizationAction(confirmName: string): Promise<DangerResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };
  try {
    await convex.mutation(convexApi.deleteOrganization, {
      organizationId: org._id,
      requesterId: session.userId,
      confirmName,
    });
    revalidatePath('/pro/dashboard');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

type NotifChannel = { email: boolean; app: boolean };
export type NotifPrefsResult = { ok: true } | { ok: false; error: string };

/** Met à jour les préférences de notification de l'organisation. */
export async function updateNotificationPrefsAction(
  prefs: Record<'rsvp' | 'payment' | 'newLead' | 'taskDue' | 'weeklyDigest', NotifChannel>,
): Promise<NotifPrefsResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };
  try {
    await convex.mutation(convexApi.updateNotificationPrefs, {
      organizationId: org._id,
      requesterId: session.userId,
      prefs,
    });
    revalidatePath('/pro/settings');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export type MessagingDefaultsResult = { ok: true } | { ok: false; error: string };

/** Met à jour les réglages messagerie par défaut de l'organisation. */
export async function updateMessagingDefaultsAction(defaults: {
  channel: 'whatsapp' | 'sms' | 'auto';
  senderName: string;
  defaultTemplate: 'editorial' | 'classic' | 'modern' | 'festive' | 'sober';
  reminderJ7: boolean;
  reminderJ1: boolean;
}): Promise<MessagingDefaultsResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };
  try {
    await convex.mutation(convexApi.updateMessagingDefaults, {
      organizationId: org._id,
      requesterId: session.userId,
      defaults,
    });
    revalidatePath('/pro/settings');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export type PaymentsSettingsResult = { ok: true } | { ok: false; error: string };

/** Met à jour les réglages d'encaissement (mode + fréquence de versement). */
export async function setPaymentsSettingsAction(input: {
  mode?: 'byop' | 'manual';
}): Promise<PaymentsSettingsResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };
  try {
    await convex.mutation(convexApi.setPaymentsSettings, {
      organizationId: org._id,
      requesterId: session.userId,
      ...input,
    });
    revalidatePath('/pro/payments');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

export type WhiteLabelResult = { ok: true } | { ok: false; error: string };

/** Met à jour la marque blanche (domaine sur mesure / e-mail / badge) — Agency. */
export async function updateWhiteLabelAction(input: {
  customDomain?: string;
  senderEmail?: string;
  whiteLabelFull?: boolean;
}): Promise<WhiteLabelResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };
  try {
    await convex.mutation(convexApi.updateWhiteLabel, {
      organizationId: org._id,
      requesterId: session.userId,
      customDomain: input.customDomain,
      senderEmail: input.senderEmail,
      whiteLabelFull: input.whiteLabelFull,
    });
    revalidatePath('/pro/settings');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

/* ------------------------------ Stripe Connect OAuth (compte de l'agence) ------------------------------ */

export type ConnectStartResult = { ok: true; url: string } | { ok: false; error: string };
export type ConnectDisconnectResult = { ok: true } | { ok: false; error: string };

/**
 * Normalise les erreurs Connect en codes lisibles côté UI. Les messages bruts
 * Stripe (anglais, longs) sont mappés sur des codes FR connus ; sinon on
 * renvoie le message tel quel (au moins l'utilisateur voit la cause).
 */
function connectErr(m: string): string {
  if (m === 'STRIPE_DRIVER_NOT_CONFIGURED') return 'PAYMENTS_NOT_CONFIGURED';
  if (m === 'STRIPE_CONNECT_NOT_CONFIGURED') return 'CONNECT_NOT_ENABLED';
  // Plateforme pas (encore) inscrite à Connect.
  if (/sign(ed)? up for Connect|Connect.*dashboard\.stripe\.com\/connect/i.test(m)) {
    return 'CONNECT_NOT_ENABLED';
  }
  return m;
}

/**
 * Démarre la connexion OAuth « Se connecter avec Stripe » : l'agence autorise
 * Wedillybird à opérer sur SON propre compte Stripe (encaissement direct, lecture
 * des données). Renvoie l'URL d'autorisation avec un `state` signé (anti-CSRF lié
 * à l'org). Owner/admin uniquement. Dégrade si Stripe/Connect non configuré.
 */
export async function startStripeConnectAction(): Promise<ConnectStartResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };
  if (org.myRole !== 'owner' && org.myRole !== 'admin') return { ok: false, error: 'FORBIDDEN' };

  try {
    const state = await signConnectState(
      { orgId: org._id, nonce: crypto.randomUUID(), ts: Date.now() },
      connectStateSecret(),
    );
    const url = stripeConnectAuthorizeUrl({
      state,
      redirectUri: `${appOrigin()}/api/stripe/oauth/callback`,
      suggestedBusinessName: org.name,
    });
    return { ok: true, url };
  } catch (err) {
    console.error('[stripe-connect] start failed:', err);
    return { ok: false, error: connectErr(err instanceof Error ? err.message : 'UNKNOWN') };
  }
}

/**
 * Déconnecte le compte Stripe de l'agence : révoque l'accès OAuth côté Stripe
 * (best-effort) puis oublie le compte (repli en suivi manuel). Owner/admin.
 */
export async function disconnectStripeConnectAction(): Promise<ConnectDisconnectResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'UNAUTHORIZED' };
  const convex = getConvexServerClient();
  const org = await convex.query(convexApi.myOrganization, { userId: session.userId });
  if (!org) return { ok: false, error: 'NO_ORG' };
  if (org.myRole !== 'owner' && org.myRole !== 'admin') return { ok: false, error: 'FORBIDDEN' };

  try {
    const status = await convex.query(convexApi.orgConnectStatus, {
      organizationId: org._id,
      requesterId: session.userId,
    });
    if (status.accountId) {
      try {
        await deauthorizeStripeConnect(status.accountId);
      } catch (err) {
        // Révocation best-effort : si déjà révoqué côté Stripe, on oublie quand même.
        console.error('[stripe-connect] deauthorize failed (ignored):', err);
      }
    }
    await convex.mutation(convexApi.disconnectStripeAccount, {
      organizationId: org._id,
      requesterId: session.userId,
    });
    revalidatePath('/pro/payments');
    return { ok: true };
  } catch (err) {
    console.error('[stripe-connect] disconnect failed:', err);
    return { ok: false, error: connectErr(err instanceof Error ? err.message : 'UNKNOWN') };
  }
}
