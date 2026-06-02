@AGENTS.md

# Wedillybird — Règles projet

## Pricing — source de vérité (v2, validée 2026-05-29)

**La grille tarifaire canonique** est détaillée dans `.context/pricing-v2.md` (économie unitaire complète, marges, scénarios SMS/WhatsApp). Tout autre fichier (`lib/payments/plans.ts`, `messages/fr.json`, `messages/en.json`, Stripe Prices, BACKLOG) doit s'y aligner.

Résumé impératif :

- **Pas de tier `free`** côté particuliers. Le code actuel en a un — il doit être supprimé.
- **Particuliers (one-shot)** :
  - Essentiel **29 €** — 100 invités max — 5 Go galerie 12 mois
  - Premium **59 €** — 250 invités max — 25 Go HD 12 mois
  - Upsell HD post-event **+29 €** — archive perpétuelle
- **Pros (mensuel · -20 % en annuel)** :
  - Starter **99 €/mois** (79 €/mois annuel) — 5 events × 150 invités — 50 Go
  - Business **219 €/mois** (175 €/mois annuel) — 20 events × 150 invités — 200 Go
  - Agency **449 €/mois** (359 €/mois annuel) — 50 events × 150 invités — 500 Go
  - Pay-as-you-go **79 €/event** — 150 invités max — 25 Go
- **Dépassements** :
  - SMS / WhatsApp au-delà bundle : **0,06 €/msg**
  - Invité au-delà du cap : **0,25 €/invité**
  - Stockage : **0,03 €/Go/mois**
  - Event simultané supplémentaire (Pro) : **19 €/event/mois prorata**
- **Règles transverses** : remboursement 100 % sous 7j si event non envoyé, report gratuit en cas d'annulation, galerie active 12 mois post-event puis archivage.
- **Bundle interne** : 3,5 × cap invités (couvre invitation + reminders + RSVP + gallery link).

Le code livré dans les sprints 1-11 (notamment Sprint 9.2 sur les subscriptions Pro) **diverge** de cette grille et doit être refactoré. Les Stripe Prices test (`price_1TQ712…`, `price_1TQ713…`, `price_1TQ714…`) sont **à recréer** avec les bons montants.

## Direction de design (V2)

`.context/redesign-direction.md` contient la direction artistique figée pour le redesign V2 (palette OKLCH terracotta, Migra Italic + Geist, Motion + GSAP, page invitation publique = 50 % du WoW factor, etc.). Toute proposition de modification UI doit respecter cette direction ou rouvrir le brainstorming.

## Conventions — rappel rapide

- **Commits Conventional Commits** stricts. Jamais de mention Claude/AI dans les commits, PRs, ou code.
- **FR uniquement** pour les strings UI (next-intl, locale unique).
- **Convex en dev** : `unset CONVEX_DEPLOYMENT CONVEX_URL CONVEX_SITE_URL && export CONVEX_DEPLOYMENT="dev:capable-crocodile-720" && pnpx convex dev --once`. Ne jamais `pnpx convex deploy` (= prod).
- **Tests vitest** dans `tests/unit/...`. Tout commit doit garder la suite verte.
- **typedRoutes Next 16** actif : pour redirect vers URL externe utiliser `redirect(url as never)` ou wrapper.
- **Pas de Context React** : Zustand pour state global.
- **tsconfig root** exclut `convex/` et `infra/` (chacun a son propre tsconfig).

## État livré (avril 2026)

Sprints 1-11 livrés (auth WhatsApp, invités, RSVP, check-in offline, galerie, paiements one-shot, dashboard pro, AWS S3+CloudFront+SES+Rekognition+Sharp variants, Stripe Subscriptions, CinetPay driver, branding org, wildcard subdomain, WhatsApp invite). Voir PRs #12-#16 sur GitHub.

Bloqueurs prod externes (`BACKLOG.md`) : SES sandbox exit, Stripe Customer Portal config, IAM scope-down, DNS wildcard Vercel, Meta template `team_invitation`, CinetPay creds prod, **alignement pricing sur la grille canonique** (à programmer comme nouveau sprint).
