# Pipeline média — de l'image à `plate.mp4`

Chaîne validée sur « L'Éclosion » (`floral`). Toutes les commandes sont réelles.

## 0. Cible

| | |
|---|---|
| Format | **9:16 portrait**, 720×1280 |
| Durée | 8–12 s |
| Poids | **< 2 Mo** (CRF 30) |
| Audio | **aucun** (`-an`) — la musique est gérée par le shell |
| Livrables | `public/cinematics/<theme>/{plate.mp4, poster.jpg, still.jpg}` |

`poster.jpg` = **première** image (affichée au chargement).
`still.jpg` = **dernière** image (fond fixe en `prefers-reduced-motion`, donc le
texte doit y être lisible).

## 1. Recadrer en 9:16

Les images générées arrivent souvent en 16:9. Choisir le cadrage **plan par
plan** : un sujet décentré (fleur à gauche) ne se crope pas au centre.

```bash
# 1672x941 (16:9) -> 529x941 (9:16). Le 3e nombre = décalage X du crop.
ffmpeg -y -i src.png -vf "crop=529:941:288:0" crop.png
```

**Contrôler visuellement** avant d'aller plus loin (planche contact) :

```bash
ffmpeg -y -i a.png -i b.png -i c.png -filter_complex hstack=3 contact.png
```

Un plan dont la composition repose sur les bords (arche large, symétrie) **ne
survit pas** au recadrage : le régénérer nativement en 9:16 plutôt que l'étirer.

## 2. Envoyer les références à OpenArt

**Jamais de base64 dans un appel MCP** (~25k tokens/image). OpenArt signe, on
pousse les octets soi-même :

```
openart_upload_sign { mediaType:"image", size:<octets EXACTS>,
                      contentType:"image/jpeg", purpose:"create-video" }
```

```bash
curl -X PUT --data-binary "@crop.jpg" \
  -H "Content-Type: image/jpeg" -H "Content-Length: $(stat -f%z crop.jpg)" \
  "<signURL>"        # 200 attendu
```

`size` doit correspondre **exactement** aux octets envoyés. Convertir en JPEG
(`-q:v 3`) d'abord : ~70 Ko au lieu de ~2 Mo en PNG.

## 3. Animer (image → vidéo)

| Modèle | Usage |
|---|---|
| **`wan2-7`** `image2video` | défaut. Seul à exposer **`startFrame` + `endFrame`** → morphs contrôlés |
| `grok-imagine-1-5` | rapide/économique, animation simple d'une photo |
| `kling-3-omni` | 4K, production en lot |

**Coût constaté : 125 crédits** par clip `wan2-7` 720p / 5 s.
Toujours chiffrer (`openart_model_cost`) avant une série.

Le **morph start/end** est le meilleur outil pour un geste signature (bouton de
rose fermé → rose épanouie) : le modèle interpole entre deux images maîtrisées.

Prompt en 6 éléments, **une seule action par plan** :
QUI · OÙ · ACTION · CAMÉRA · AMBIANCE · RYTHME.

`negativePrompt` utile : `text, letters, watermark, people, faces, hands, fast
motion, jump cut, morphing artifacts, camera shake, oversaturated`.

Récupération (hôte CLI) : `openart_creation_wait { historyId }`, relancer tant
que `STILL_RUNNING`.

> Un `generate_image` MCP peut **expirer côté client alors que l'image est bien
> produite** : vérifier dans la médiathèque avant de relancer (et de repayer).

## 4. Monter

Fondu enchaîné entre deux plans (`offset` = durée du 1er − durée du fondu) :

```bash
ffmpeg -y -i A.mp4 -i B.mp4 -filter_complex \
 "[0:v]scale=720:1280,setsar=1[a];[1:v]scale=720:1280,setsar=1[b];\
  [a][b]xfade=transition=fade:duration=0.7:offset=4.362,format=yuv420p[v]" \
 -map "[v]" -an -c:v libx264 -profile:v high -crf 30 -preset slow \
 -movflags +faststart plate.mp4
```

Poster et image fixe :

```bash
ffmpeg -y -ss 0      -i plate.mp4 -frames:v 1 -q:v 4 poster.jpg
ffmpeg -y -sseof -0.15 -i plate.mp4 -frames:v 1 -q:v 4 still.jpg
```

La plaque **ne boucle pas** : elle se fige sur sa dernière image, ce qui laisse
lire le faire-part. Caler les phases du composant sur les temps réels de la
vidéo (`PHASE_TIME`) pour que `holdPhase` positionne la bonne image.

## 5. Aperçu à faire valider

Ne pas faire valider sur des images fixes : **enregistrer le rendu réel** du
navigateur (Playwright `recordVideo`), c'est ce que verra l'invité.

Pour montrer la profondeur 3D, **bouger la caméra** pendant l'enregistrement
(`page.mouse.move` par petits pas) — sans mouvement, la parallaxe est invisible.

Ajouter la musique à l'aperçu (elle n'est pas dans la plaque) :

```bash
ffmpeg -y -i rec.webm -i public/audio/invitation/jardin.m4a \
 -filter_complex "[1:a]afade=t=in:st=0:d=1.5,atrim=0:16,asetpts=PTS-STARTPTS[a]" \
 -map 0:v -map "[a]" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p \
 -c:a aac -b:a 128k -shortest -movflags +faststart preview.mp4
```
