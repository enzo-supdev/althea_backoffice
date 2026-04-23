# Seed de donnees de test

Deux fichiers CSV prets a l'emploi pour peupler le back-office avec un jeu de
donnees realiste (para-pharmacie), **images incluses**.

## Contenu

- **10 categories** : soins du visage, hygiene corporelle, vitamines, premiers
  secours, bien-etre, maman & bebe, orthopedie, solaire, dentaire, dermatologie
- **40 produits** repartis sur ces 10 categories, prix HT de 3.50 € a 49 €,
  stock varie (25 a 250 unites), mix 90/10 published/draft

## Ordre d'import

**1. Categories d'abord** — les produits referencent les categories par slug.

Dans `Catalogue > Categories`, clique `Importer CSV` et selectionne
`seed/categories.csv`. Chaque categorie est creee avec sa banniere 800x400
aux couleurs du theme (rose pour soins visage, bleu pour hygiene, rouge pour
premiers secours, etc.).

**2. Produits ensuite**.

Dans `Catalogue > Produits`, clique `Importer CSV` et selectionne
`seed/products.csv`. Chaque produit est cree avec son image 600x600
correspondant a son nom et a la couleur de sa categorie.

## Idempotence

L'import est **upsert** : si un slug existe deja, l'item est mis a jour au lieu
d'etre recree. Tu peux editer le CSV et ré-importer autant de fois que tu veux
sans generer de doublons.

## Fonctionnement des images

Pour chaque ligne avec `imageUrl` non vide :
1. `fetch(url)` cote client
2. Binaire uploade via `POST /media/upload` (renvoie une `ref`)
3. `ref` attache au produit (`mainImageRef`) ou a la categorie
   (`POST /categories/admin/:id/image`)

URL par defaut : `placehold.co` avec le nom de l'item en gros sur fond colore.
Pour remplacer par de vraies photos, edite la colonne `imageUrl` avec une URL
publique accessible en GET (Unsplash, Cloudinary, S3, CDN, ...). Le backend
accepte `jpeg, png, webp, gif, mp4, webm, mov, pdf, doc, docx`.

> **Attention placeholder** : placehold.co renvoie du SVG par defaut.
> Toujours **ajouter `.png`** avant le `?text=...` dans l'URL sinon l'upload
> echoue en 400 (SVG refuse).

## Format CSV produits

| Colonne | Type | Obligatoire | Notes |
|---|---|---|---|
| `name` | string | oui | |
| `slug` | string | non | auto-genere depuis le name si vide |
| `categorySlug` | string | oui | doit exister cote back-office |
| `priceHt` | number | oui | `.` ou `,` accepte |
| `vatRate` | number | non | 0, 5.5, 10, 20 — defaut 20 |
| `stock` | integer | non | defaut 0 |
| `status` | enum | non | `draft` ou `published` — defaut `draft` |
| `description` | string | non | |
| `imageUrl` | url | non | fetch + upload + mainImageRef |

## Format CSV categories

| Colonne | Type | Obligatoire |
|---|---|---|
| `name` | string | oui |
| `slug` | string | non |
| `description` | string | non |
| `imageUrl` | url | non |

## Temps d'import estime

- Categories : ~15 sec (10 uploads placehold + 10 create + 10 setImage)
- Produits : ~60-90 sec (40 uploads + 40 create, sequentiel)
