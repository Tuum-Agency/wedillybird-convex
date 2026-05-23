@AGENTS.md

# Wedillybird — Règles projet

## Pricing — source de vérité

**La grille tarifaire canonique** est dans `.context/redesign-direction.md` (section "Pricing figé"). Tout autre fichier (`lib/payments/plans.ts`, `messages/fr.json`, Stripe Prices, BACKLOG) doit s'y aligner.

Résumé impératif :

- **Pas de tier `free`** côté particuliers. Le code actuel en a un — il doit être supprimé.
- **Particuliers (one-shot)** : Essentiel 19 €, Premium 49 €, Upsell post-mariage +29 €.
- **Pros (mensuel, -20 % annual)** : Starter 89 €, Business 179 €, Agency 349 €, Pay-as-you-go 69 €/event.
- **Règles transverses** : dépassement WhatsApp 0,06 €/msg, stockage galerie pro 0,03 €/Go/mois, remboursement 100 % sous 7j si event non envoyé, report gratuit en cas d'annulation.

Le code livré dans les sprints 1-11 (notamment Sprint 9.2 sur les subscriptions Pro) **diverge** de cette grille et doit être refactoré. Les Stripe Prices test (`price_1TQ712…`, `price_1TQ713…`, `price_1TQ714…`) sont **à recréer** avec les bons montants.

## Direction de design (V2)

`.context/redesign-direction.md` contient la direction artistique figée pour le redesign V2 (palette OKLCH terracotta, Migra Italic + Geist, Motion + GSAP, page invitation publique = 50 % du WoW factor, etc.). Toute proposition de modification UI doit respecter cette direction ou rouvrir le brainstorming.

## Conventions — rappel rapide

- **Commits Conventional Commits** stricts. Jamais de mention Claude/AI dans les commits, PRs, ou code.
- **FR uniquement** pour les strings UI (next-intl, locale unique).
- **Convex en dev** : `unset CONVEX_DEPLOYMENT CONVEX_URL CONVEX_SITE_URL && export CONVEX_DEPLOYMENT="dev:capable-crocodile-720" && pnpx convex dev --once`. Pour la **prod** (`prod:fearless-poodle-133`), `pnpx convex deploy` et `pnpx convex run … --prod` sont autorisés **uniquement avec confirmation explicite de l'utilisateur** au cas par cas (jamais automatique, jamais sans demander).
- **Tests vitest** dans `tests/unit/...`. Tout commit doit garder la suite verte.
- **typedRoutes Next 16** actif : pour redirect vers URL externe utiliser `redirect(url as never)` ou wrapper.
- **Pas de Context React** : Zustand pour state global.
- **tsconfig root** exclut `convex/` et `infra/` (chacun a son propre tsconfig).

## État livré (avril 2026)

Sprints 1-11 livrés (auth WhatsApp, invités, RSVP, check-in offline, galerie, paiements one-shot, dashboard pro, AWS S3+CloudFront+SES+Rekognition+Sharp variants, Stripe Subscriptions, CinetPay driver, branding org, wildcard subdomain, WhatsApp invite). Voir PRs #12-#16 sur GitHub.

Bloqueurs prod externes (`BACKLOG.md`) : SES sandbox exit, Stripe Customer Portal config, IAM scope-down, DNS wildcard Vercel, Meta template `team_invitation`, CinetPay creds prod, **alignement pricing sur la grille canonique** (à programmer comme nouveau sprint).
