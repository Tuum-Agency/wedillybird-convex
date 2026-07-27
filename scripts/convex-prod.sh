#!/usr/bin/env bash
#
# Garde-fou des opérations Convex sur la PROD (mode d'échec F8 du premortem).
#
# Le piège vécu : un terminal garde `CONVEX_DEPLOYMENT=dev:capable-crocodile-720`
# d'une session de dev, on lance `npx convex env set TWILIO_... ` SANS `--prod`,
# la commande répond OK — mais les clés sont posées sur le DEV, pas sur la prod.
# Rien ne le signale, et le SMS reste mort en prod. Ce wrapper :
#   1. force le flag `--prod` (cible le déploiement prod du projet, quel que soit
#      le CONVEX_DEPLOYMENT ambiant du shell) ;
#   2. affiche la cible AVANT d'exécuter ;
#   3. exige une confirmation explicite.
#
# Usage :
#   scripts/convex-prod.sh env list
#   scripts/convex-prod.sh env set TWILIO_ACCOUNT_SID ACxxxxxxxx
#   scripts/convex-prod.sh env get CONVEX_WEBHOOK_SECRET
#
set -euo pipefail

PROD_SLUG="fearless-poodle-133"

if [ $# -eq 0 ]; then
  echo "Usage: scripts/convex-prod.sh <sous-commande convex...>   (--prod est ajouté automatiquement)"
  echo "  ex: scripts/convex-prod.sh env list"
  echo "      scripts/convex-prod.sh env set TWILIO_ACCOUNT_SID ACxxxxxxxx"
  exit 1
fi

echo "▶ Cible : Convex PROD ($PROD_SLUG)"
echo "  CONVEX_DEPLOYMENT ambiant = ${CONVEX_DEPLOYMENT:-<non défini>}  (ignoré : on force --prod)"
echo "  Commande : npx convex $* --prod"
echo ""
read -r -p "Confirmer l'opération sur la PROD ? (taper 'prod' pour continuer) " ans
if [ "$ans" != "prod" ]; then
  echo "Annulé."
  exit 1
fi

exec npx convex "$@" --prod
