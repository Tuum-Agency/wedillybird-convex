# Runbook prod — topologie & déploiement Wedillybird

> Objectif : sortir le modèle mental « quel compte / quel déploiement / quelle clé
> pour quoi » de la tête d'une seule personne (mode d'échec **F8** du premortem :
> une commande envoyée au mauvais déploiement, en silence, pendant le lancement).
> Vérifié le 2026-07-27.

## 1. La carte (comptes, déploiements, clés)

| Brique | Prod | Dev / autre |
|---|---|---|
| **Convex** | `fearless-poodle-133` (team `wedilly-bird`) · client `https://fearless-poodle-133.convex.cloud` · HTTP `https://fearless-poodle-133.convex.site` | dev `capable-crocodile-720` (dans `.env.local`) |
| **AWS média** | compte **487046110766**, profil CLI **`wbadmin`** (AdministratorAccess), région **eu-west-3** · CloudFront `E3O56ZG0J0BA9J` (`media.wedillybird.com`, cert ACM `us-east-1` `…9857bbac…`) · Lambdas `ModerationFunction851946CE`, `VariantsFunction DABCF433` | profil `safeUser` = compte **614939597285**, **aucune perm** (ne pas l'utiliser pour le média) |
| **Vercel** | projet lié (`vercel whoami` = `doums85`), domaine `wedillybird.com` | previews |
| **Stripe** | **live** · webhooks → `wedillybird.com/api/webhooks/[provider]` | clé `sk_test` en `.env.local` |
| **Backend social** | `ai-business-os` (`aibusinessos.beindigital.fr`, MCP) — **infra séparée**, publie @wedillybird. **N'a PAS été touché** par le takeover Convex (vérifié). | — |

Le déploiement prod `fearless-poodle-133` a été **repris** (reset table `users`) le 2026-07-27 d'un ancien produit. Des **tables orphelines** de cet ancien produit peuvent subsister — **ne rien y purger** sans certitude (voir [F6](#5-billing-convex)).

## 2. Le « fusil chargé » (à connaître)

`vercel.json` lance `npx convex deploy` vers `fearless-poodle-133` à **chaque push sur `main`** (condition : `CONVEX_DEPLOY_KEY` posé + `VERCEL_ENV=production`). Donc **tout merge sur `main` redéploie la prod Convex.**

Garde-fou intrinsèque : `convex deploy` **valide le schéma contre les données existantes** et **fait échouer le build** si incompatible (erreur bruyante, PAS de corruption silencieuse). Le risque résiduel = une migration de schéma *compatible mais logiquement fausse* → c'est une question de **revue de PR**, pas d'outillage.

## 3. Règle d'or des opérations Convex prod

Le piège vécu (F8) : un terminal garde `CONVEX_DEPLOYMENT=dev:…`, on lance `npx convex env set …` **sans `--prod`**, la clé part sur le **dev** sans avertissement (→ SMS mort en prod).

**Toujours** passer par le wrapper, qui force `--prod` + confirmation + affiche la cible :

```bash
scripts/convex-prod.sh env list
scripts/convex-prod.sh env set TWILIO_ACCOUNT_SID ACxxxxxxxx
scripts/convex-prod.sh env get CONVEX_WEBHOOK_SECRET
```

Jamais `npx convex env set …` nu pour la prod.

## 4. Déploiement du stack média (CDK)

Le stack média ne se déploie **pas** via Vercel — c'est un `cdk deploy` manuel sur AWS `487046110766`.

⚠️ **Le piège F4** : `LAMBDA_CALLBACK_SECRET` doit rester **identique** entre la Lambda et Convex, sinon les callbacks de modération sont rejetés (401) et **la galerie reste vide**. Toujours **sourcer le secret depuis Convex prod** au moment du deploy (ne jamais le retaper) :

```bash
cd infra
export AWS_ACCOUNT_ID=487046110766
export AWS_REGION=eu-west-3
export MEDIA_CERTIFICATE_ARN=arn:aws:acm:us-east-1:487046110766:certificate/9857bbac-a0f7-4a78-ab5e-eff22faa3a1b
export CONVEX_SITE_URL=https://fearless-poodle-133.convex.site
export LAMBDA_CALLBACK_SECRET=$(cd .. && npx convex env get LAMBDA_CALLBACK_SECRET --prod)
# si la Lambda modération a une OPENAI_API_KEY, la re-sourcer aussi (sinon elle est retirée) :
# export OPENAI_API_KEY=$(aws lambda get-function-configuration --profile wbadmin --region eu-west-3 \
#   --function-name <ModerationFunction...> --query 'Environment.Variables.OPENAI_API_KEY' --output text)
npx cdk diff  WedillybirdMediaStack --profile wbadmin   # TOUJOURS diff d'abord : vérifier qu'aucun secret/cert ne change
npx cdk deploy WedillybirdMediaStack --profile wbadmin --require-approval never
```

Filets côté pipeline média (livrés) : **DLQ** par Lambda (échecs d'invocation retenus 14 j) + cron Convex `photosModerationHealth.reconcileStalePendingPhotos` (alerte ops si des photos restent `pending` non modérées > 20 min).

## 5. Après CHAQUE déploiement prod — checklist

```bash
# 1. Money-path : secret Vercel↔Convex + URL prod OK (attendu {"ok":true})
curl -s https://wedillybird.com/api/health/webhook-secret

# 2. Le site répond
curl -s -o /dev/null -w '%{http_code}\n' https://wedillybird.com/en
```

- **Paiement** : un vrai achat de bout en bout (carte → accès + galerie) après tout changement money-path. Filet automatique : cron `/api/cron/reconcile-payments` (toutes les 15 min).
- **Média** : uploader une vraie photo → vérifier qu'elle passe `approved` dans une galerie.
- **SMS** : voir §6.

## 6. Handoffs fondateur en cours (hors code)

- <a id="f2"></a>**A2P / SMS (F2)** : les invitations SMS vers les **+1 US** sont filtrées par les carriers tant que la **Toll-Free Verification / A2P Twilio** n'est pas *approuvée*. En attendant : garder **WhatsApp/email** comme canal d'invitation mis en avant. Les `TWILIO_*` **ne sont volontairement PAS** sur Convex prod (les poser activerait un envoi SMS silencieusement filtré) — à poser **après** l'approbation A2P, via `scripts/convex-prod.sh env set`.
- <a id="5-billing-convex"></a>**Billing Convex (F6)** : vérifier que `fearless-poodle-133` (team `wedilly-bird`) **n'est pas sur le plan Free** / que le spending cap est bien au-dessus de 10 $ + alerte 80 % (un cap trop bas coupe **toute la team** = prod down — déjà vécu le 2026-07-12). Poser un moyen de paiement. Puis, seulement, purger les tables orphelines de l'ancien produit.
- **Avis (F3)** : décision produit en attente — laissés en l'état à la demande.
