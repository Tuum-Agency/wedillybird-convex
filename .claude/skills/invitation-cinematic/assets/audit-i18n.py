#!/usr/bin/env python3
"""
Audit de COMPLÉTUDE i18n — complète `pnpm i18n:validate`, qui ne vérifie que la
PARITÉ entre locales.

Une clé appelée par le code mais absente des 7 fichiers passe la parité (les 7
sont d'accord pour ne pas l'avoir) et plante au runtime avec MISSING_MESSAGE.
C'est ainsi que 4 clés `music*` d'`invitation-shell` sont restées invisibles
jusqu'à ce qu'un couple active la musique.

Usage :
    python3 audit-i18n.py                      # composants d'invitation
    python3 audit-i18n.py 'components/**/*.tsx' # périmètre choisi

Sortie : liste des `Namespace.clé` manquantes ; code 1 s'il y en a.
"""

import glob
import json
import re
import sys

DEFAULT_GLOB = "components/invitation/**/*.tsx"
LOCALE = "messages/fr.json"

# t('x') NON précédé d'un caractère d'identifiant : évite les faux positifs du
# type `.get('replay')` ou `.split('a')`, dont le suffixe ressemble à `t('`.
CALL = re.compile(r"(?<![A-Za-z0-9_$.])t\(\s*'([A-Za-z0-9_.]+)'")
NAMESPACE = re.compile(r"useTranslations\(\s*'([A-Za-z0-9_.]+)'\s*\)")


def resolve(table, dotted):
    """Descend un chemin pointé dans un dict imbriqué ; None si absent."""
    cur = table
    for part in dotted.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def main():
    pattern = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_GLOB
    messages = json.load(open(LOCALE, encoding="utf-8"))
    files = sorted(glob.glob(pattern, recursive=True))
    problems = []

    for path in files:
        src = open(path, encoding="utf-8").read()
        namespaces = NAMESPACE.findall(src)
        if not namespaces:
            continue
        # Un composant par fichier dans ce codebase : le 1er namespace fait foi.
        ns = namespaces[0]
        table = resolve(messages, ns)
        if table is None:
            problems.append(f"{path}: namespace absent « {ns} »")
            continue
        for key in sorted(set(CALL.findall(src))):
            if resolve(table, key) is None:
                problems.append(f"{path}: {ns}.{key} MANQUANTE")

    if problems:
        print("\n".join(problems))
        print(f"\n✗ {len(problems)} clé(s) manquante(s) sur {len(files)} fichiers")
        return 1
    print(f"✓ aucune clé manquante ({len(files)} fichiers analysés)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
