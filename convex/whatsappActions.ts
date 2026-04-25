'use node';

import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { sendTeamInviteWhatsApp } from '../lib/whatsapp/team-invite';

/**
 * Sends a WhatsApp `team_invitation` template to a freshly invited team
 * member. Scheduled by `organizations.invite` immediately after insert.
 *
 * Configuration (Convex deployment env):
 *   WHATSAPP_TEAM_TEMPLATE — Meta-approved template name. When unset the
 *     action logs and exits gracefully (no throw) so the invite flow keeps
 *     working in dev/preview without a configured template.
 *
 *   WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID — required for real
 *     sending; without them the lib falls back to a local mock client that
 *     just logs.
 *
 * Template variables expected:
 *   {{1}} = inviterName
 *   {{2}} = organizationName
 *   {{3}} = inviteUrl
 */
export const sendTeamInvitation = internalAction({
  args: {
    phone: v.string(),
    inviterName: v.string(),
    organizationName: v.string(),
    inviteUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    return await sendTeamInviteWhatsApp(args);
  },
});
