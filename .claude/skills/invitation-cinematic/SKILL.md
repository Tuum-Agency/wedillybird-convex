---
name: invitation-cinematic
description: >-
  Créer, modifier ou déboguer une cinématique d'ouverture d'invitation
  Wedillybird (components/invitation/cinematics/*). Couvre le pipeline complet :
  choix du type (CSS-3D pur ou plaque vidéo), génération des médias 9:16 via
  OpenArt, montage ffmpeg, écriture du composant + CSS, câblage registry /
  player / i18n 7 locales / musique, et vérification au rendu réel.
  Déclencheurs : « nouvelle cinématique », « cinématique d'invitation »,
  « univers d'invitation », « thème d'ouverture », « l'Éclosion / le Sceau /
  le Faire-part… », « ajouter une cinématique », « la cinématique ne s'affiche
  pas », « plate vidéo invitation », « exposer un univers aux couples ».
---

# Cinématiques d'invitation — pipeline complet

Une cinématique = l'ouverture animée que voit l'invité en arrivant sur son
invitation. C'est **50 % du WoW produit**. Ce skill couvre la chaîne entière,
de l'idée au rendu vérifié.

> Complémentaire du skill global `wedding-cinematic-studio` : celui-là couvre la
> **direction créative** (univers, storyboard, prompts, 17 rôles). Celui-ci
> couvre l'**implémentation dans ce codebase**. Enchaîner les deux.
>
> ⚠️ Le skill global affirme « vidéos prérendues INTERDITES ». C'est **périmé** :
> `jardin-japonais` puis `floral` embarquent une plaque vidéo. La règle réelle
> est ci-dessous (§1).

## 1. Décider AVANT de produire : CSS pur ou plaque vidéo ?

| | **CSS-3D pur** | **Plaque vidéo** (piste D) |
|---|---|---|
| Exemples | `seal`, `royal`, `feux`, `deco` | `jardin-japonais`, `floral` |
| Poids | ~0 asset | 1,5–4 Mo |
| Look | graphique, illustratif | photoréaliste |
| Reteinte `accentColor` | totale | ornements seulement |
| Quand | univers géométrique, papeterie, lumière | nature, matière, photoréalisme |

**Ne jamais mettre de WebGL / Three.js** sur le chemin invité : +200-400 Ko gzip
sur une page dont le LCP est critique, pour un rendu *inférieur* à une vidéo
photoréaliste. La profondeur se fait en CSS 3D (`perspective` +
`transform-style: preserve-3d` + plans à Z fixes) — voir §6.

Si plaque vidéo, garde-fous **obligatoires** : muette, `playsInline`, poster de
chargement, image fixe en `prefers-reduced-motion`, jamais en LCP bloquant.

## 2. Le contrat (non négociable)

Tout thème est une fonction `(CinematicSceneProps) => JSX` — voir
`components/invitation/cinematics/shared.tsx` :

```ts
partnerA, partnerB, formattedDate, venueName?, accentColor?, eventDate?,
photoUrl?, reduced?, parallax?, holdPhase?, playKey?, onDone?, live?
```

- **6 phases cumulatives** (0→5) via `useCinematicTimeline({ waits: [5 durées] })`.
- Les **prénoms sont le héros** : Bodoni italic (`var(--font-display)`), un
  **geste signature** au climax.
- `holdPhase` fige (vignettes/storyboard) · `playKey` rejoue · `onDone` rend la
  main au shell · `live` affiche « Passer ».
- Les 4 informations du faire-part : `t('weddingLabel')` · prénoms ·
  `formattedDate` · `venueName`.

Le socle fournit `useCountdown`, `useSceneParallax`, `CinematicSkip`,
`CinematicCountdown`. **Réutiliser, ne pas réécrire.**

## 3. Médias : le format est 9:16, pas 16:9

L'invitation se regarde **au téléphone**. Cible : **720×1280**.

Les générateurs d'images sortent souvent en 16:9 — un crop centré détruit les
compositions latérales (une arche perd ses montants et devient un cadre vide).
Recadrer avec un cadrage **choisi par plan**, puis contrôler visuellement.

Pipeline détaillé (commandes exactes, modèles, coûts) :
**`references/pipeline-media.md`**.

En résumé : crop 9:16 → `openart_upload_sign` + PUT curl → `wan2-7 image2video`
(`startFrame`/`endFrame` pour un morph) → montage `xfade` → `plate.mp4` muette +
`poster.jpg` (1ʳᵉ image) + `still.jpg` (dernière image, pour reduced-motion).

Viser **< 2 Mo** pour ~10 s (CRF 30). Un clip qui dérive (colorimétrie hors
palette, sujet perdu) : **l'écarter**, ne pas s'acharner à le rattraper.

## 4. Câbler le thème (4 endroits, tous obligatoires)

1. `registry.ts` → `CINEMATIC_IDS` + `CINEMATIC_META` (`suggestedTrackId`, `dark`).
2. `player.tsx` → entrée dans `THEMES` (import dynamique).
3. `messages/*.json` → **les 7 locales** (`ar de en es fr it pt`).
4. `registry.ts` → `AVAILABLE_CINEMATIC_IDS` **pour l'exposer aux couples**.

> **Piège** : un thème absent de `AVAILABLE_CINEMATIC_IDS` existe, se rend, mais
> **aucun couple ne peut le choisir**. C'est volontaire aujourd'hui (seul `seal`
> est exposé) — c'est une décision produit, à confirmer, jamais à supposer.

**Musique** : rien à coder. `invitation-shell` gère porte → audio → fondu →
toggle. Le thème déclare seulement son `suggestedTrackId` dans `CINEMATIC_META`
(pistes : `aurore, jardin, celebration, envol, harmonie`). L'audio exige un geste
utilisateur (iOS) : c'est le rôle de la porte.

## 5. Les pièges qui coûtent une session

Tous vécus. Aucun n'est détecté par `typecheck`.

1. **Préfixe des classes de phase.** `...PHASE_CLASSES.slice(0, phase)` sans
   `.map(c => \`cineXx-${c}\`)` pose `garden` au lieu de `cineXx-garden`. Le CSS
   ne matche jamais : le texte est **dans le DOM** mais reste `opacity: 0`.
   Invisible en test DOM — seule une **capture d'écran** le révèle.
2. **Mismatch d'hydratation sur `prefers-reduced-motion`.** Le serveur l'ignore →
   le client diverge du HTML SSR. N'honorer la préférence qu'**après montage**,
   via `useSyncExternalStore` (`getServerSnapshot → false`).
   ⚠️ Pas de `setState` dans un `useEffect` : interdit par React 19
   (`react-hooks/set-state-in-effect`).
3. **`filter` / `opacity` cassent le tri 3D.** Les porter sur le **conteneur de
   couche à Z fixe**, jamais sur un enfant — sinon l'enfant sort du tri de
   profondeur et réapparaît dans l'ordre du DOM (z-fighting).
4. **Parallaxe : écrire `--rx/--ry` sur le STAGE**, pas sur le monde. Sinon les
   contextes 3D frères (plan avant qui passe devant le texte) restent figés
   pendant que le fond pivote.
5. **`i18n:validate` ne voit pas une clé manquante partout.** Il vérifie la
   *parité* entre locales, pas la *complétude*. Une clé absente des 7 fichiers
   passe le contrôle et **plante au runtime** (`MISSING_MESSAGE`).
   → lancer `assets/audit-i18n.py` (compare les `t('…')` appelés aux clés réelles).
6. **Ne jamais envoyer une image en base64 dans un appel MCP** : ~25k tokens par
   image. Utiliser `openart_upload_sign` puis pousser les octets soi-même (curl).
7. **Éditer les JSON i18n en mode texte**, pas par round-trip `json.dumps` : cela
   ré-éclate les tableaux que Prettier garde sur une ligne et pollue le diff.
   Ancrer l'insertion **dans le bon namespace** (une même clé peut exister
   ailleurs dans le fichier).
8. **Passer Prettier** sur le `.css` après écriture (`npx prettier --write`).

## 6. Profondeur 3D en CSS (sans WebGL)

Empiler des plans à **Z fixes** de part et d'autre du texte, dans un parent
`perspective` + `preserve-3d`. La parallaxe naît de la projection, pas d'un
calcul JS : sous rotation, le déplacement est **proportionnel à Z**, avec le
texte à Z=0 comme pivot (les plans devant et derrière glissent en sens opposés).

Ordre type : plaque `-180` · brume `-80` · pétales lointains `-60` ·
**texte `0`** · pétales médians `+45` · pétales proches `+150` (flous, dans un
conteneur `z-index` supérieur pour passer devant le texte).

Vérifier la profondeur en **mesurant** (voir §7), pas à l'œil.

## 7. Vérifier au rendu réel — obligatoire

`typecheck` + tests unitaires ne prouvent **rien** sur une cinématique : les deux
bugs les plus coûteux (§5.1, §5.2) passaient au vert.

`assets/verify-cinematic.mjs` (Playwright) fait le tour :
captures par phase · opacités calculées · erreurs console et `MISSING_MESSAGE` ·
mismatch d'hydratation · `prefers-reduced-motion` · **mesure de parallaxe par
plan** (animations figées, sinon la chute des pétales fausse la mesure).

Pièges de test :
- **Bannière RGPD** : poser `localStorage['wedillybird-cookie-consent']='accepted'`
  *avant* le chargement (`addInitScript`), sinon elle masque le bas de scène et
  React la remonte si on la supprime après coup.
- **Port** : `:3001` si un autre workspace occupe `:3000`. Vérifier en demandant
  un asset du thème (404 vs 200).
- **La cinématique est démontée après `onDone`** : mesurer *avant* la fin, sinon
  on conclut à tort qu'elle ne s'affiche pas.
- Page de contrôle temporaire sous `app/[locale]/(marketing)/…` : **la supprimer**
  avant de livrer (elle est publique).

## 8. Checklist de livraison

- [ ] 9:16, plaque < 2 Mo, `poster.jpg` + `still.jpg` présents
- [ ] 6 phases, geste signature, prénoms en Bodoni italic
- [ ] 4 infos affichées : mariage · couple · date · lieu
- [ ] Contraste AA (fond clair → encre sombre + voile ivoire ; fond sombre → l'inverse)
- [ ] `accentColor` custom testé · `prefers-reduced-motion` → image fixe
- [ ] 4 points de câblage faits (§4) · 7 locales · `audit-i18n.py` vert
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` verts
- [ ] Vérification au rendu réel passée (§7) · page de test supprimée
- [ ] Exposition dans `AVAILABLE_CINEMATIC_IDS` : **décision confirmée** avec le fondateur
