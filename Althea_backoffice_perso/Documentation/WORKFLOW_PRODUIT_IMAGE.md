# Workflow — Créer un produit avec une image

L'API ne permet pas d'envoyer une image et les données produit en une seule requête.  
Il faut toujours **uploader l'image en premier**, récupérer sa référence, puis l'utiliser lors de la création du produit.

---

## Vue d'ensemble

```
Étape 1          Étape 2                    Étape 3 (optionnel)
─────────        ────────────────────────   ─────────────────────────
Upload image  →  Créer le produit       →  Ajouter d'autres images
                 avec mainImageRef           à la galerie du produit
```

---

## Étape 1 — Uploader l'image

**Endpoint :** `POST /api/v1/media/upload`  
**Auth requise :** oui  
**Format :** `multipart/form-data`

### Requête

```
POST http://localhost:3000/api/v1/media/upload
Authorization: Bearer <ton_token>
Content-Type: multipart/form-data

file: <fichier image>
```

Formats acceptés : `jpg`, `jpeg`, `png`, `webp`, `gif`  
Taille max : **10 MB**

### Réponse

```json
{
  "success": true,
  "data": {
    "ref": "1745234567890-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
    "url": "/api/v1/media/1745234567890-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
    "mimetype": "image/jpeg",
    "size": 204800
  }
}
```

> **Important :** le champ `ref` est la valeur à conserver.  
> C'est elle qui sera utilisée dans les étapes suivantes, pas l'`url`.

---

## Étape 2 — Créer le produit avec l'image principale

**Endpoint :** `POST /api/v1/products/admin`  
**Auth requise :** oui (admin)

On passe la `ref` récupérée à l'étape 1 dans le champ `mainImageRef`.

### Requête

```
POST http://localhost:3000/api/v1/products/admin
Authorization: Bearer <ton_token>
Content-Type: application/json
```

```json
{
  "name": "Mon produit",
  "slug": "mon-produit",
  "categoryId": "uuid-de-la-categorie",
  "priceHt": 29.99,
  "vatRate": 20,
  "stock": 100,
  "status": "draft",
  "mainImageRef": "1745234567890-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
}
```

### Réponse

```json
{
  "success": true,
  "data": {
    "id": "bbbb1111-0000-0000-0000-000000000000",
    "name": "Mon produit",
    "slug": "mon-produit",
    "mainImageRef": "1745234567890-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
    "status": "draft",
    ...
  }
}
```

Le produit est créé. L'image principale est référencée via `mainImageRef`.

Pour afficher l'image côté front, construire l'URL :
```
http://localhost:3000/api/v1/media/<mainImageRef>
```

---

## Étape 3 (optionnel) — Ajouter des images à la galerie

Un produit peut avoir plusieurs images (galerie). Elles sont distinctes de `mainImageRef`.

**Endpoint :** `POST /api/v1/products/admin/:id/images`  
**Auth requise :** oui (admin)

Pour chaque image supplémentaire, uploader d'abord le fichier (étape 1), puis appeler cet endpoint avec la liste des `ref` obtenues.

### Requête

```
POST http://localhost:3000/api/v1/products/admin/bbbb1111-0000-0000-0000-000000000000/images
Authorization: Bearer <ton_token>
Content-Type: application/json
```

```json
{
  "imageRefs": [
    "1745234567891-aaaabbbb-cccc-dddd-eeee-ff1122334455.jpg",
    "1745234567892-11112222-3333-4444-5555-66778899aabb.jpg"
  ]
}
```

### Réponse

```json
{
  "success": true,
  "data": [
    {
      "id": "cccc2222-0000-0000-0000-000000000000",
      "imageRef": "1745234567891-aaaabbbb-cccc-dddd-eeee-ff1122334455.jpg",
      "displayOrder": 0,
      "isMain": false
    },
    {
      "id": "dddd3333-0000-0000-0000-000000000000",
      "imageRef": "1745234567892-11112222-3333-4444-5555-66778899aabb.jpg",
      "displayOrder": 1,
      "isMain": false
    }
  ]
}
```

---

## Récapitulatif complet

```
1. POST /api/v1/media/upload
   → body: form-data { file: image.jpg }
   → récupérer data.ref  ←────────────────────────┐
                                                   │
2. POST /api/v1/products/admin                     │
   → body: { ..., mainImageRef: <ref> }  ──────────┘
   → récupérer data.id  ←──────────────────────────┐
                                                   │
3. POST /api/v1/products/admin/:id/images  ────────┘  (optionnel)
   → body: { imageRefs: [<ref1>, <ref2>] }
```

---

## Erreur fréquente

Si tu passes la valeur `url` à la place de `ref` dans `mainImageRef`, la validation échouera ou l'image ne s'affichera pas correctement.

| Ce qu'il ne faut PAS mettre | Ce qu'il faut mettre |
|---|---|
| `/api/v1/media/1745234...jpg` | `1745234567890-a1b2c3d4-....jpg` |
| L'URL complète | Uniquement le `ref` brut |
