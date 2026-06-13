/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as budget from "../budget.js";
import type * as clients from "../clients.js";
import type * as contracts from "../contracts.js";
import type * as crons from "../crons.js";
import type * as emailActions from "../emailActions.js";
import type * as events from "../events.js";
import type * as guests from "../guests.js";
import type * as http from "../http.js";
import type * as invitationActions from "../invitationActions.js";
import type * as lib_autoplace from "../lib/autoplace.js";
import type * as lib_channelRouting from "../lib/channelRouting.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_eventAuth from "../lib/eventAuth.js";
import type * as lib_guestStats from "../lib/guestStats.js";
import type * as lib_magicLink from "../lib/magicLink.js";
import type * as lib_orgAuth from "../lib/orgAuth.js";
import type * as lib_otp from "../lib/otp.js";
import type * as lib_phone from "../lib/phone.js";
import type * as lib_qrToken from "../lib/qrToken.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_twilioSms from "../lib/twilioSms.js";
import type * as lib_uniqueSlug from "../lib/uniqueSlug.js";
import type * as lib_whatsappCloud from "../lib/whatsappCloud.js";
import type * as newsletter from "../newsletter.js";
import type * as organizations from "../organizations.js";
import type * as paygPurchases from "../paygPurchases.js";
import type * as paymentLinks from "../paymentLinks.js";
import type * as payments from "../payments.js";
import type * as paymentsInvoice from "../paymentsInvoice.js";
import type * as photos from "../photos.js";
import type * as photosActions from "../photosActions.js";
import type * as photosFaceSearch from "../photosFaceSearch.js";
import type * as photosReprocess from "../photosReprocess.js";
import type * as planning from "../planning.js";
import type * as pro from "../pro.js";
import type * as quotes from "../quotes.js";
import type * as reminderActions from "../reminderActions.js";
import type * as reminders from "../reminders.js";
import type * as rsvps from "../rsvps.js";
import type * as seating from "../seating.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as vendors from "../vendors.js";
import type * as whatsappTemplateNotifications from "../whatsappTemplateNotifications.js";
import type * as whatsappTemplates from "../whatsappTemplates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  analytics: typeof analytics;
  auth: typeof auth;
  budget: typeof budget;
  clients: typeof clients;
  contracts: typeof contracts;
  crons: typeof crons;
  emailActions: typeof emailActions;
  events: typeof events;
  guests: typeof guests;
  http: typeof http;
  invitationActions: typeof invitationActions;
  "lib/autoplace": typeof lib_autoplace;
  "lib/channelRouting": typeof lib_channelRouting;
  "lib/email": typeof lib_email;
  "lib/entitlements": typeof lib_entitlements;
  "lib/eventAuth": typeof lib_eventAuth;
  "lib/guestStats": typeof lib_guestStats;
  "lib/magicLink": typeof lib_magicLink;
  "lib/orgAuth": typeof lib_orgAuth;
  "lib/otp": typeof lib_otp;
  "lib/phone": typeof lib_phone;
  "lib/qrToken": typeof lib_qrToken;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/twilioSms": typeof lib_twilioSms;
  "lib/uniqueSlug": typeof lib_uniqueSlug;
  "lib/whatsappCloud": typeof lib_whatsappCloud;
  newsletter: typeof newsletter;
  organizations: typeof organizations;
  paygPurchases: typeof paygPurchases;
  paymentLinks: typeof paymentLinks;
  payments: typeof payments;
  paymentsInvoice: typeof paymentsInvoice;
  photos: typeof photos;
  photosActions: typeof photosActions;
  photosFaceSearch: typeof photosFaceSearch;
  photosReprocess: typeof photosReprocess;
  planning: typeof planning;
  pro: typeof pro;
  quotes: typeof quotes;
  reminderActions: typeof reminderActions;
  reminders: typeof reminders;
  rsvps: typeof rsvps;
  seating: typeof seating;
  seed: typeof seed;
  users: typeof users;
  vendors: typeof vendors;
  whatsappTemplateNotifications: typeof whatsappTemplateNotifications;
  whatsappTemplates: typeof whatsappTemplates;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
