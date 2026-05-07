#!/usr/bin/env bash
# Pousse toutes les variables `STRIPE_PRICE_*` du `.env.local` vers Vercel
# (Production + Preview). Idempotent : supprime la valeur existante si elle
# existe avant d'ajouter la nouvelle, pour éviter le prompt interactif "var
# already exists" du CLI Vercel.
#
# Prérequis :
#   - Vercel CLI installé (`brew install vercel-cli` ou `pnpm i -g vercel`)
#   - Projet linké (`vercel link` à la racine du projet) — le script bloque
#     proprement si `.vercel/project.json` est absent.
#
# Usage :
#   ./scripts/push-stripe-env-to-vercel.sh           # push prod + preview
#   ./scripts/push-stripe-env-to-vercel.sh --dry-run # liste ce qui serait poussé
#
# ⚠ Le script ne déclenche PAS de redeploy. Après le push, fais `vercel --prod`
# (ou push un commit) pour que les nouvelles env vars soient effectives.

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# 1. Vérifie les prérequis
if ! command -v vercel >/dev/null 2>&1; then
  echo "❌ Vercel CLI introuvable. Installe : brew install vercel-cli"
  exit 1
fi

if [[ ! -f .vercel/project.json ]]; then
  echo "❌ Projet non linké à Vercel. Lance d'abord :"
  echo "     vercel link"
  echo "   (sélectionne le bon scope/projet quand demandé)"
  exit 1
fi

if [[ ! -f .env.local ]]; then
  echo "❌ .env.local introuvable à la racine du projet"
  exit 1
fi

# 2. Extrait les lignes STRIPE_PRICE_*=price_… du .env.local
VARS=$(grep -E '^STRIPE_PRICE_[A-Z_]+=price_' .env.local || true)

if [[ -z "$VARS" ]]; then
  echo "❌ Aucune variable STRIPE_PRICE_*=price_… trouvée dans .env.local"
  exit 1
fi

count=$(echo "$VARS" | wc -l | tr -d ' ')
echo "Trouvé $count variable(s) STRIPE_PRICE_* à pousser sur Vercel"
echo "Environnements cibles : production + preview"
$DRY_RUN && echo "[DRY RUN] Aucun appel Vercel effectif"
echo ""

# 3. Push
while IFS='=' read -r name value; do
  # Trim potentiel \r si fichier édité sous Windows
  name="${name%$'\r'}"
  value="${value%$'\r'}"

  for env in production preview; do
    if $DRY_RUN; then
      echo "  [dry-run] $name → $env"
      continue
    fi

    # Supprime la valeur existante (silencieux si absente).
    # `--yes` répond automatiquement au prompt de confirmation.
    vercel env rm "$name" "$env" --yes >/dev/null 2>&1 || true

    # Ajoute la nouvelle valeur via stdin (pas d'echo de la valeur en clair
    # dans la sortie shell — printf l'injecte directement dans le pipe).
    printf '%s' "$value" | vercel env add "$name" "$env" >/dev/null 2>&1
    echo "  ✓ $name → $env"
  done
done <<< "$VARS"

echo ""
if $DRY_RUN; then
  echo "ℹ Dry-run terminé. Relance sans --dry-run pour appliquer."
else
  echo "✅ Push terminé. N'oublie pas de redéployer pour appliquer :"
  echo "     vercel --prod"
  echo "   ou push un commit (si auto-deploy activé sur main)."
fi
