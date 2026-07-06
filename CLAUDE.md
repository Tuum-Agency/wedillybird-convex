@AGENTS.md

# Wedillybird — Règles projet

## Pricing — source de vérité (v2, validée 2026-05-29)

**La grille tarifaire canonique** est détaillée dans `.context/pricing-v2.md` (économie unitaire complète, marges, scénarios SMS/WhatsApp). Tout autre fichier (`lib/payments/plans.ts`, `messages/fr.json`, `messages/en.json`, Stripe Prices, BACKLOG) doit s'y aligner.

Résumé impératif :

- **Pas de tier `free`** côté particuliers. (Supprimé du code ✅ — `PlanTier = 'essential' | 'premium'`.)
- **Particuliers (one-shot)** — EUR canonique · **USD posé en valeur marché** (v2.3 : $40/$80/+$30, plus de conversion ×1,08 ; pros en parité $99/$219/$449/$79) :
  - Essentiel **29 € / $40** — 100 invités max — 5 Go galerie 12 mois
  - Premium **59 € / $80** — 250 invités max — 25 Go HD 12 mois
  - Upsell HD post-event **+29 € / +$30** — archive perpétuelle
- **Pros (mensuel · -20 % en annuel)** :
  - Starter **99 €/mois / $99** (79 €/mois annuel) — 5 events × 150 invités — 50 Go
  - Business **219 €/mois / $219** (175 €/mois annuel) — 20 events × 150 invités — 200 Go
  - Agency **449 €/mois / $449** (359 €/mois annuel) — 50 events × 150 invités — 500 Go
  - Pay-as-you-go **79 €/event / $79** — 150 invités max — 25 Go
- **Dépassements** :
  - SMS / WhatsApp au-delà bundle : **0,06 €/msg**
  - Invité au-delà du cap : **0,25 €/invité**
  - Stockage : **0,03 €/Go/mois**
  - Event simultané supplémentaire (Pro) : **19 €/event/mois prorata**
- **Règles transverses** : remboursement 100 % sous 7j si event non envoyé, report gratuit en cas d'annulation, galerie active 12 mois post-event puis archivage.
- **Bundle interne** : 3,5 × cap invités (couvre invitation + reminders + RSVP + gallery link).

Le code (`lib/payments/plans.ts`, `lib/payments/subscriptions.ts`) est **aligné** sur cette grille. Les Stripe Prices **live** ont été créés et nettoyés (2026-06-12) : **30 Prices canoniques actifs** (Essentiel 29 / Premium 59 / Upsell 29 / Starter 99·951 / Business 219·2103 / Agency 449·4311 / PAYG 79, en EUR/USD/MAD) ; les anciens Prices aux mauvais montants ont été **archivés**. Les env vars `STRIPE_PRICE_*` Vercel pointent sur les bons IDs (génération `price_1Tdp*`/`1Tdtq*`). Vérifié via l'API Stripe (0 transaction live à ce jour).

## Direction de design (V2)

**Source de vérité** : le code — `app/globals.css` (design tokens OKLCH, thèmes) et `app/[locale]/layout.tsx` (polices) — distillé dans **`DESIGN.md`** (design system complet, à fournir aux outils de design). `.context/redesign-direction.md` est **historique/périmé** : en cas de conflit, le code et `DESIGN.md` priment.

Direction « Wedillybird Bloom », **deux univers visuels stricts** :

- **Light « mariage éditorial »** → couple, invité, public, auth, **page d'invitation publique (= 50 % du WoW, Motion + GSAP)**, portail couple marque blanche. Palette claire blush / champagne / ivoire, accents gold ; ambiance papeterie premium (Aesop / Vogue Italia).
- **Dark « Linear-grade »** → back-office agence (dashboard pro, CRM, budget, prestataires, etc.), activé via `data-theme="dark"`. Dense, rigoureux ; charbon brun-violet + accents blush/gold conservés.

Typo : **Bodoni Moda Italic** (display, h1-h3, toujours italic) + **Geist Sans** (UI) + **Geist Mono** (QR, IDs, IBAN). Palette **OKLCH** Blush/Champagne/Ivory/Sage/Ink (les alias `terracotta` sont legacy, en cours de suppression — **ne pas** décrire la marque comme « terracotta »). Multi-tenant : override `--brand-500`, luminance contrainte 35-65 % (AA). `prefers-reduced-motion` respecté.

Toute proposition de modification UI doit respecter cette direction ou rouvrir le brainstorming.

## Conventions — rappel rapide

- **Commits Conventional Commits** stricts. Jamais de mention Claude/AI dans les commits, PRs, ou code.
- **FR uniquement** pour les strings UI (next-intl, locale unique).
- **Convex en dev** : `unset CONVEX_DEPLOYMENT CONVEX_URL CONVEX_SITE_URL && export CONVEX_DEPLOYMENT="dev:capable-crocodile-720" && pnpx convex dev --once`. Ne jamais `pnpx convex deploy` (= prod).
- **Tests vitest** dans `tests/unit/...`. Tout commit doit garder la suite verte.
- **typedRoutes Next 16** actif : pour redirect vers URL externe utiliser `redirect(url as never)` ou wrapper.
- **Pas de Context React** : Zustand pour state global.
- **tsconfig root** exclut `convex/` et `infra/` (chacun a son propre tsconfig).

## État livré (avril 2026)

Sprints 1-11 livrés (auth WhatsApp, invités, RSVP, check-in offline, galerie, paiements one-shot, dashboard pro, AWS S3+CloudFront+SES+Rekognition+Sharp variants, Stripe Subscriptions, branding org, wildcard subdomain, WhatsApp invite). Voir PRs #12-#16 sur GitHub.

Bloqueurs prod externes (`BACKLOG.md`) : SES sandbox exit, Stripe Customer Portal config, IAM scope-down, DNS wildcard Vercel, Meta template `team_invitation`, **alignement pricing sur la grille canonique** (à programmer comme nouveau sprint).
