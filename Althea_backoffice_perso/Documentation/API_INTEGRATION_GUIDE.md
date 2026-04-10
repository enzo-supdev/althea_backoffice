# Guide d'intégration API — Althea Systems

> Document destiné à un agent IA front-end implémentant un client pour cette API.
> Ce document est exhaustif et autonome : aucune autre référence n'est nécessaire.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Authentification](#2-authentification)
3. [Format des réponses](#3-format-des-réponses)
4. [Gestion des erreurs](#4-gestion-des-erreurs)
5. [Flux d'utilisation complets](#5-flux-dutilisation-complets)
6. [Référence des endpoints](#6-référence-des-endpoints)
   - [6.1 Auth](#61-auth)
   - [6.2 Users](#62-users)
   - [6.3 Products](#63-products)
   - [6.4 Categories](#64-categories)
   - [6.5 Cart](#65-cart)
   - [6.6 Checkout](#66-checkout)
   - [6.7 Orders](#67-orders)
   - [6.8 Invoices](#68-invoices)
   - [6.9 Search](#69-search)
   - [6.10 Media](#610-media)
   - [6.11 Contact](#611-contact)
   - [6.12 Chatbot](#612-chatbot)
   - [6.13 Analytics](#613-analytics)
   - [6.14 Legal](#614-legal)
   - [6.15 Homepage](#615-homepage)
   - [6.16 Admin Users](#616-admin-users)

---

## 1. Vue d'ensemble

| Propriété | Valeur |
|---|---|
| URL de base (production) | `https://api-pslt.matheovieilleville.fr` |
| Préfixe API | `/api/v1/` |
| Format | JSON (sauf endpoints binaires) |
| Authentification | Bearer JWT (header `Authorization: Bearer <token>`) |
| Stack serveur | Node.js / TypeScript / Express v5 / Prisma 7 / PostgreSQL / Stripe |

### Niveaux d'accès

| Niveau | Description |
|---|---|
| `public` | Aucune authentification requise |
| `user` | JWT valide requis (`Authorization: Bearer <accessToken>`) |
| `admin` | JWT valide + rôle `admin` requis |

### URL complète d'un endpoint

```
https://api-pslt.matheovieilleville.fr/api/v1/<module>/<route>
```

---

## 2. Authentification

### Tokens

L'API utilise deux tokens JWT :

- **`accessToken`** : durée courte (ex. 15 min). À envoyer dans le header `Authorization`.
- **`refreshToken`** : durée longue. À utiliser pour renouveler l'`accessToken` via `POST /api/v1/auth/refresh-token`.

### Header à envoyer

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Stratégie de renouvellement

1. Une requête retourne `401 Unauthorized`
2. Appeler `POST /api/v1/auth/refresh-token` avec le `refreshToken`
3. Stocker les nouveaux `accessToken` et `refreshToken`
4. Rejouer la requête originale

---

## 3. Format des réponses

### Réponse standard (succès)

```json
{
  "success": true,
  "message": "Description optionnelle",
  "data": { ... }
}
```

### Réponse paginée (succès)

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

> **Exceptions importantes :**
> - **Invoices** : ne wrappent pas dans `{ success, data }` — retournent `{ invoice }`, `{ creditNote }`, ou le résultat paginé directement
> - **Chatbot** : retourne `{ session }`, `{ userMessage, botResponse }`, `{ messages }`, `{ sessions, pagination }` directement
> - **Admin Users** (`GET /admin/users`) : utilise `pagination` au lieu de `meta`
> - Les endpoints `DELETE` pour featured products, banners et contact messages retournent **204 No Content** (pas de body)

---

## 4. Gestion des erreurs

### Format d'erreur standard

```json
{
  "success": false,
  "message": "Description de l'erreur",
  "errors": [ ... ]
}
```

### Codes HTTP

| Code | Signification |
|---|---|
| `200` | Succès |
| `201` | Créé avec succès |
| `204` | Succès sans contenu |
| `400` | Données invalides / règles métier non respectées |
| `401` | Non authentifié (token absent ou invalide) |
| `403` | Accès refusé (rôle insuffisant ou ressource d'un autre utilisateur) |
| `404` | Ressource introuvable |
| `409` | Conflit (ex. email déjà utilisé) |
| `413` | Fichier trop volumineux |
| `422` | Validation échouée |
| `429` | Trop de requêtes (rate limiting) |
| `500` | Erreur serveur interne |
| `503` | Service indisponible (ex. Stripe down) |

---

## 5. Flux d'utilisation complets

### 5.1 Inscription et vérification email

```
1. POST /api/v1/auth/register
   → Reçoit { user, accessToken, refreshToken }
   → Un email de vérification est envoyé automatiquement

2. L'utilisateur clique sur le lien dans l'email
   GET /api/v1/auth/verify-email/:token
   → Email vérifié, compte activé

3. (Optionnel) Si l'email n'est pas arrivé :
   POST /api/v1/auth/resend-verification { email }
```

### 5.2 Connexion et gestion des tokens

```
1. POST /api/v1/auth/login { email, password }
   → Reçoit { user, accessToken, refreshToken }

2. Utiliser accessToken dans Authorization header pour toutes les requêtes authentifiées

3. Quand accessToken expiré (réponse 401) :
   POST /api/v1/auth/refresh-token { refreshToken }
   → Reçoit { accessToken, refreshToken }

4. POST /api/v1/auth/logout
   → Invalide le refreshToken côté serveur
```

### 5.3 Flux d'achat complet (checkout Stripe)

```
1. Vérifier et construire le panier :
   GET /api/v1/cart
   POST /api/v1/cart/items { productId, quantity }
   PUT /api/v1/cart/items/:id { quantity }

2. Valider le panier :
   POST /api/v1/checkout/validate
   → Vérifie disponibilité des stocks et validité des prix

3. Obtenir les options de livraison :
   GET /api/v1/checkout/shipping-options
   → Array d'options avec prix et délais

4. (Optionnel) Calculer le total avec livraison et/ou code promo :
   POST /api/v1/checkout/calculate-total { shippingMethodId, couponCode? }

5. (Optionnel) Appliquer un code promo :
   POST /api/v1/checkout/apply-coupon { sessionId, couponCode }

6. Créer la session de checkout :
   POST /api/v1/checkout/shipping { addressId (uuid), shippingMethodId (uuid) }
   → Reçoit 201 { sessionId, ... }

7. Créer le Payment Intent Stripe :
   POST /api/v1/checkout/payment-intent { sessionId }
   → Reçoit 201 { clientSecret, paymentIntentId }

8. Côté client : utiliser clientSecret avec Stripe.js pour confirmer le paiement

9. Confirmer le paiement côté serveur :
   POST /api/v1/checkout/confirm { paymentIntentId }
   → Reçoit 201 { order }
   → Le panier est automatiquement vidé
   → Une facture est générée automatiquement
```

### 5.4 Récupération mot de passe

```
1. POST /api/v1/auth/forgot-password { email }
   → Email avec lien de réinitialisation envoyé

2. POST /api/v1/auth/reset-password/:token { password }
   → Mot de passe réinitialisé
```

### 5.5 Gestion du panier anonyme → connexion

```
1. Avant connexion, stocker le panier localement (localStorage)

2. Après connexion :
   POST /api/v1/cart/merge { anonymousCartItems: [{ productId, quantity }] }
   → Fusionne les articles du panier anonyme avec le panier utilisateur
```

---

## 6. Référence des endpoints

---

### 6.1 Auth

Base : `/api/v1/auth`

#### `POST /api/v1/auth/register`

**Auth** : public
**Description** : Crée un compte utilisateur et envoie un email de vérification. Le compte est en statut `pending` jusqu'à vérification de l'email.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `firstName` | string | oui | 1–50 caractères |
| `lastName` | string | oui | 1–50 caractères |
| `email` | string | oui | Email valide, max 255 caractères |
| `password` | string | oui | 8–100 caractères, doit contenir minuscule + majuscule + chiffre |

**Réponse 201**
```json
{
  "success": true,
  "message": "Utilisateur créé avec succès. Veuillez vérifier votre email.",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "firstName": "Jean",
      "lastName": "Dupont",
      "email": "jean.dupont@example.com",
      "role": "user",
      "status": "pending",
      "emailVerifiedAt": null,
      "createdAt": "2026-04-03T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Données de validation invalides |
| `409` | Un utilisateur avec cet email existe déjà |
| `500` | Erreur serveur |

---

#### `GET /api/v1/auth/verify-email/:token`

**Auth** : public
**Description** : Vérifie l'email d'un utilisateur via le token reçu par email. Active le compte (statut `active`).

**Params**

| Param | Type | Description |
|---|---|---|
| `token` | string | Token de vérification reçu par email |

**Réponse 200**
```json
{
  "success": true,
  "message": "Email vérifié avec succès"
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Token invalide ou expiré |
| `404` | Utilisateur introuvable |

---

#### `POST /api/v1/auth/resend-verification`

**Auth** : public
**Description** : Renvoie un email de vérification. Rate limité.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `email` | string | oui |

**Réponse 200**
```json
{
  "success": true,
  "message": "Email de vérification envoyé"
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Email déjà vérifié |
| `404` | Utilisateur introuvable |
| `429` | Trop de tentatives |

---

#### `POST /api/v1/auth/login`

**Auth** : public
**Description** : Authentifie un utilisateur. Rate limité.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `email` | string | oui |
| `password` | string | oui |

**Réponse 200**
```json
{
  "success": true,
  "message": "Connexion réussie",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "firstName": "Jean",
      "lastName": "Dupont",
      "email": "jean.dupont@example.com",
      "role": "user",
      "status": "active",
      "emailVerifiedAt": "2026-04-03T10:05:00.000Z",
      "lastLoginAt": "2026-04-03T12:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Données invalides |
| `401` | Email ou mot de passe incorrect |
| `429` | Trop de tentatives de connexion |

---

#### `POST /api/v1/auth/logout`

**Auth** : user
**Description** : Invalide le refreshToken côté serveur.

**Réponse 200**
```json
{
  "success": true,
  "message": "Déconnexion réussie"
}
```

---

#### `POST /api/v1/auth/refresh-token`

**Auth** : public
**Description** : Renouvelle l'accessToken à partir du refreshToken.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `refreshToken` | string | oui |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | refreshToken manquant |
| `401` | refreshToken invalide ou expiré |

---

#### `POST /api/v1/auth/forgot-password`

**Auth** : public
**Description** : Envoie un email de réinitialisation du mot de passe. Rate limité.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `email` | string | oui |

**Réponse 200**
```json
{
  "success": true,
  "message": "Email de réinitialisation envoyé"
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Email invalide |
| `404` | Utilisateur introuvable |
| `429` | Trop de tentatives |

---

#### `POST /api/v1/auth/reset-password/:token`

**Auth** : public
**Description** : Réinitialise le mot de passe via le token reçu par email.

**Params**

| Param | Type | Description |
|---|---|---|
| `token` | string | Token de réinitialisation |

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `password` | string | oui | 8–100 caractères, minuscule + majuscule + chiffre |

**Réponse 200**
```json
{
  "success": true,
  "message": "Mot de passe réinitialisé avec succès"
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Token invalide ou expiré |
| `404` | Utilisateur introuvable |

---

#### `POST /api/v1/auth/change-password`

**Auth** : user
**Description** : Change le mot de passe de l'utilisateur connecté.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `currentPassword` | string | oui | Mot de passe actuel |
| `newPassword` | string | oui | 8–100 caractères, minuscule + majuscule + chiffre |

**Réponse 200**
```json
{
  "success": true,
  "message": "Mot de passe changé avec succès"
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Données invalides |
| `401` | Mot de passe actuel incorrect |

---

### 6.2 Users

Base : `/api/v1/users` — toutes les routes nécessitent authentification (`user`)

#### `GET /api/v1/users/me`

**Auth** : user
**Description** : Récupère le profil de l'utilisateur connecté.

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean.dupont@example.com",
    "role": "user",
    "status": "active",
    "emailVerifiedAt": "2026-04-03T10:05:00.000Z",
    "lastLoginAt": "2026-04-03T12:00:00.000Z",
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T12:00:00.000Z"
  }
}
```

---

#### `PUT /api/v1/users/me`

**Auth** : user
**Description** : Met à jour le profil de l'utilisateur connecté.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `firstName` | string | non | 1–50 caractères |
| `lastName` | string | non | 1–50 caractères |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* user object mis à jour */ }
}
```

---

#### `PUT /api/v1/users/me/email`

**Auth** : user
**Description** : Change l'email de l'utilisateur. Envoie un email de vérification au nouvel email.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `email` | string | oui | Email valide, max 255 caractères |
| `password` | string | oui | Mot de passe actuel pour confirmation |

**Réponse 200**
```json
{
  "success": true,
  "message": "Email modifié avec succès. Veuillez vérifier votre nouvel email."
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Données invalides |
| `401` | Mot de passe incorrect |
| `409` | Email déjà utilisé |

---

#### `GET /api/v1/users/me/orders`

**Auth** : user
**Description** : Liste les commandes de l'utilisateur connecté avec pagination.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `status` | string | — | `pending`, `processing`, `shipped`, `delivered`, `cancelled` |
| `page` | integer | `1` | — |
| `limit` | integer | `20` | max 100 |
| `sortBy` | string | `createdAt` | `createdAt`, `total` |
| `sortOrder` | string | `desc` | `asc`, `desc` |

**Réponse 200**
```json
{
  "success": true,
  "data": [ /* array de commandes */ ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

#### `GET /api/v1/users/me/invoices`

**Auth** : user
**Description** : Liste les factures de l'utilisateur connecté.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `status` | string | — | `pending`, `paid`, `cancelled`, `refunded` |
| `page` | integer | `1` | — |
| `limit` | integer | `20` | max 100 |

**Réponse 200** : résultat paginé directement (pas de wrapper `success/data`)
```json
{
  "data": [ /* array de factures */ ],
  "meta": { "total": 10, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

#### `GET /api/v1/users/me/addresses`

**Auth** : user
**Description** : Récupère toutes les adresses de l'utilisateur.

**Réponse 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "addr-uuid",
      "firstName": "Jean",
      "lastName": "Dupont",
      "address1": "123 Rue de la Paix",
      "address2": null,
      "city": "Paris",
      "region": "Île-de-France",
      "postalCode": "75001",
      "country": "FR",
      "phone": "+33612345678",
      "isDefault": true,
      "createdAt": "2026-04-03T10:00:00.000Z"
    }
  ]
}
```

---

#### `POST /api/v1/users/me/addresses`

**Auth** : user
**Description** : Crée une nouvelle adresse de livraison.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `firstName` | string | oui | — |
| `lastName` | string | oui | — |
| `address1` | string | oui | — |
| `address2` | string | non | nullable |
| `city` | string | oui | — |
| `region` | string | oui | — |
| `postalCode` | string | oui | — |
| `country` | string | oui | Exactement 2 caractères (uppercased automatiquement, ex. `"FR"`) |
| `phone` | string | oui | — |
| `isDefault` | boolean | non | défaut `false` |

**Réponse 201**
```json
{
  "success": true,
  "data": { /* adresse créée */ }
}
```

---

#### `PUT /api/v1/users/me/addresses/:id`

**Auth** : user
**Description** : Met à jour une adresse existante. Mêmes champs que POST, tous optionnels.

**Params** : `id` (uuid de l'adresse)

**Réponse 200**
```json
{
  "success": true,
  "data": { /* adresse mise à jour */ }
}
```

---

#### `DELETE /api/v1/users/me/addresses/:id`

**Auth** : user
**Description** : Supprime une adresse.

**Params** : `id` (uuid de l'adresse)

**Réponse 200**
```json
{
  "success": true,
  "message": "Adresse supprimée"
}
```

---

#### `GET /api/v1/users/me/payment-methods`

**Auth** : user
**Description** : Récupère les moyens de paiement enregistrés.

**Réponse 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "pm-uuid",
      "stripePaymentMethodId": "pm_1234567890",
      "stripeCustomerId": "cus_abc123",
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2028,
      "cardholderName": "Jean Dupont",
      "isDefault": true,
      "createdAt": "2026-04-03T10:00:00.000Z"
    }
  ]
}
```

---

#### `POST /api/v1/users/me/payment-methods`

**Auth** : user
**Description** : Enregistre un moyen de paiement Stripe. L'ID `pm_*` est obtenu côté client via Stripe.js.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `stripePaymentMethodId` | string | oui | Doit commencer par `pm_` |
| `cardholderName` | string | oui | 1–100 caractères |
| `isDefault` | boolean | non | défaut `false` |

**Réponse 201**
```json
{
  "success": true,
  "data": { /* moyen de paiement créé */ }
}
```

---

#### `PUT /api/v1/users/me/payment-methods/:id/default`

**Auth** : user
**Description** : Définit un moyen de paiement comme défaut.

**Params** : `id` (uuid du moyen de paiement)

**Réponse 200**
```json
{
  "success": true,
  "data": { /* moyen de paiement mis à jour */ }
}
```

---

#### `DELETE /api/v1/users/me/payment-methods/:id`

**Auth** : user
**Description** : Supprime un moyen de paiement.

**Params** : `id` (uuid du moyen de paiement)

**Réponse 200**
```json
{
  "success": true,
  "message": "Moyen de paiement supprimé"
}
```

---

### 6.3 Products

Base : `/api/v1/products`

#### `GET /api/v1/products`

**Auth** : public
**Description** : Liste paginée des produits publiés (status `published`).

**Query**

| Param | Type | Défaut | Description |
|---|---|---|---|
| `search` | string | — | Recherche par nom |
| `category` | string | — | Slug de catégorie |
| `availability` | string | — | Filtre disponibilité |
| `minPrice` | number | — | Prix HT minimum |
| `maxPrice` | number | — | Prix HT maximum |
| `vatRate` | number | — | Taux TVA (0, 5.5, 10, 20) |
| `sortBy` | string | — | `name`, `priceHt`, `createdAt`, `displayOrder` |
| `sortOrder` | string | — | `asc`, `desc` |
| `page` | integer | `1` | max 100 |
| `limit` | integer | `20` | — |

**Réponse 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod-uuid",
      "name": "Produit exemple",
      "slug": "produit-exemple",
      "description": "Description du produit",
      "priceHt": "29.99",
      "vatRate": "20",
      "priceTtc": "35.99",
      "stock": 100,
      "status": "published",
      "isPriority": false,
      "isFeatured": false,
      "displayOrder": 0,
      "mainImageRef": "image-uuid",
      "categoryId": "cat-uuid",
      "createdAt": "2026-04-03T10:00:00.000Z"
    }
  ],
  "meta": { "total": 150, "page": 1, "limit": 20, "totalPages": 8 }
}
```

---

#### `GET /api/v1/products/top`

**Auth** : public
**Description** : Récupère les top 10 produits featured.

**Réponse 200**
```json
{
  "success": true,
  "data": [ /* array de produits */ ]
}
```

---

#### `GET /api/v1/products/:slug`

**Auth** : public
**Description** : Détail d'un produit publié par son slug, avec ses images.

**Params** : `slug` (string, lettres minuscules + chiffres + tirets)

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "prod-uuid",
      "name": "Produit exemple",
      "slug": "produit-exemple",
      "description": "Description",
      "technicalSpecs": [{ "key": "Poids", "value": "1.5kg" }],
      "priceHt": "29.99",
      "vatRate": "20",
      "priceTtc": "35.99",
      "stock": 100,
      "status": "published",
      "categoryId": "cat-uuid"
    },
    "images": [
      {
        "id": "img-uuid",
        "imageRef": "media-uuid",
        "displayOrder": 0,
        "isMain": true
      }
    ]
  }
}
```

---

#### `GET /api/v1/products/:id/similar`

**Auth** : public
**Description** : Retourne des produits similaires (même catégorie), jusqu'à 6.

**Params** : `id` (uuid du produit)

**Réponse 200**
```json
{
  "success": true,
  "data": [ /* array de produits similaires */ ]
}
```

---

#### `GET /api/v1/products/category/:categorySlug`

**Auth** : public
**Description** : Liste paginée des produits d'une catégorie.

**Params** : `categorySlug` (string)

**Query** : `page`, `limit` (mêmes que `GET /products`)

**Réponse 200** : même format que `GET /products`

---

#### `GET /api/v1/products/admin`

**Auth** : admin
**Description** : Liste tous les produits (tous statuts).

**Query** : mêmes paramètres que `GET /products` + `status` (`published`, `draft`)

**Réponse 200** : même format paginé

---

#### `GET /api/v1/products/admin/export`

**Auth** : admin
**Description** : Export CSV de tous les produits.

**Réponse 200** : fichier binaire `text/csv`

---

#### `GET /api/v1/products/admin/export/advanced`

**Auth** : admin
**Description** : Export avancé avec filtres.

**Query**

| Param | Type | Défaut |
|---|---|---|
| `categoryId` | uuid | — |
| `status` | string | — |
| `minPrice` | number | — |
| `maxPrice` | number | — |
| `minStock` | integer | — |
| `maxStock` | integer | — |
| `format` | string | `csv` | `csv` ou `json` |

**Réponse 200** : fichier binaire `text/csv` ou `application/json`

---

#### `GET /api/v1/products/admin/:id`

**Auth** : admin
**Description** : Détail complet d'un produit par ID (tous statuts).

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "product": { /* ... */ },
    "images": [ /* ... */ ]
  }
}
```

---

#### `POST /api/v1/products/admin`

**Auth** : admin
**Description** : Crée un nouveau produit.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `name` | string | oui | 1–200 caractères |
| `slug` | string | oui | 1–220 caractères, minuscules+chiffres+tirets |
| `description` | string | non | max 5000 caractères, nullable |
| `technicalSpecs` | array | non | max 50 items : `[{ key: string, value: string }]` |
| `categoryId` | uuid | oui | — |
| `priceHt` | number | oui | 0–9 999 999.99 |
| `vatRate` | number | non | `0`, `5.5`, `10` ou `20` (défaut `20`) |
| `stock` | integer | non | ≥ 0, défaut `0` |
| `status` | string | non | `published` ou `draft` |
| `isPriority` | boolean | non | défaut `false` |
| `isFeatured` | boolean | non | défaut `false` |
| `displayOrder` | integer | non | ≥ 0 |
| `mainImageRef` | uuid | non | nullable |

**Réponse 201**
```json
{
  "success": true,
  "data": { /* produit créé */ }
}
```

---

#### `POST /api/v1/products/admin/:id/duplicate`

**Auth** : admin
**Description** : Duplique un produit existant. Le duplicat est en statut `draft`.

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis |
|---|---|---|
| `name` | string | non |
| `copyImages` | boolean | non (défaut `false`) |
| `copyVariants` | boolean | non (défaut `false`) |

**Réponse 201**
```json
{
  "success": true,
  "data": {
    "product": { /* produit dupliqué */ }
  }
}
```

---

#### `PUT /api/v1/products/admin/:id`

**Auth** : admin
**Description** : Met à jour un produit. Mêmes champs que POST, tous optionnels.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "data": { /* produit mis à jour */ }
}
```

---

#### `PUT /api/v1/products/admin/:id/stock`

**Auth** : admin
**Description** : Met à jour le stock d'un produit.

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `stock` | integer | oui | ≥ 0 |
| `operation` | string | non | `set` (défaut), `increment`, `decrement` |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "product": { /* produit avec stock mis à jour */ }
  }
}
```

---

#### `PATCH /api/v1/products/admin/:id/status`

**Auth** : admin
**Description** : Change le statut de publication d'un produit.

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis | Valeurs |
|---|---|---|---|
| `status` | string | oui | `published`, `draft` |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* produit mis à jour */ }
}
```

---

#### `DELETE /api/v1/products/admin/:id`

**Auth** : admin
**Description** : Supprime un produit (soft delete).

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "message": "Produit supprimé"
}
```

---

#### `DELETE /api/v1/products/admin/bulk`

**Auth** : admin
**Description** : Suppression groupée de produits.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `productIds` | uuid[] | oui |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* résultat suppression */ }
}
```

---

#### `PATCH /api/v1/products/admin/bulk/status`

**Auth** : admin
**Description** : Change le statut de plusieurs produits.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `productIds` | uuid[] | oui |
| `status` | string | oui (`published` ou `draft`) |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* résultat mise à jour */ }
}
```

---

#### `PATCH /api/v1/products/admin/bulk/category`

**Auth** : admin
**Description** : Change la catégorie de plusieurs produits.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `productIds` | uuid[] | oui |
| `categoryId` | uuid | oui (nullable) |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* résultat mise à jour */ }
}
```

---

#### `POST /api/v1/products/admin/:id/images`

**Auth** : admin
**Description** : Ajoute des images à un produit. Envoyer un objet avec `imageRef` (uuid de média déjà uploadé).

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis |
|---|---|---|
| `imageRef` | uuid | oui |

**Réponse 201**
```json
{
  "success": true,
  "data": { /* images mises à jour */ }
}
```

---

#### `DELETE /api/v1/products/admin/:id/images/:imageId`

**Auth** : admin
**Description** : Supprime une image d'un produit.

**Params** : `id` (uuid produit), `imageId` (uuid image)

**Réponse 200**
```json
{
  "success": true,
  "message": "Image supprimée"
}
```

---

#### `PUT /api/v1/products/admin/:id/images/reorder`

**Auth** : admin
**Description** : Réordonne les images d'un produit.

**Params** : `id` (uuid produit)

**Body**

| Champ | Type | Requis |
|---|---|---|
| `images` | array | oui : `[{ id: uuid, displayOrder: integer }]` |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* images réordonnées */ }
}
```

---

### 6.4 Categories

Base : `/api/v1/categories`

#### `GET /api/v1/categories`

**Auth** : public
**Description** : Liste toutes les catégories actives, triées par `displayOrder`.

**Réponse 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat-uuid",
      "name": "Électronique",
      "slug": "electronique",
      "description": "Produits électroniques",
      "imageRef": "media-uuid",
      "status": "active",
      "displayOrder": 0,
      "createdAt": "2026-04-03T10:00:00.000Z"
    }
  ]
}
```

---

#### `GET /api/v1/categories/:slug`

**Auth** : public
**Description** : Détail d'une catégorie avec ses produits associés.

**Params** : `slug` (string)

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "category": { /* ... */ },
    "products": [ /* array de produits (peut être vide) */ ]
  }
}
```

---

#### `GET /api/v1/categories/admin`

**Auth** : admin
**Description** : Liste toutes les catégories (actives et inactives).

**Réponse 200**
```json
{
  "success": true,
  "data": [ /* toutes les catégories */ ]
}
```

---

#### `POST /api/v1/categories/admin`

**Auth** : admin
**Description** : Crée une nouvelle catégorie.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `name` | string | oui | 1–100 caractères |
| `slug` | string | oui | 1–120 caractères, minuscules+chiffres+tirets |
| `description` | string | non | max 2000, nullable |
| `imageRef` | uuid | non | nullable |
| `status` | string | non | `active` ou `inactive` |
| `displayOrder` | integer | non | ≥ 0 |

**Réponse 201**
```json
{
  "success": true,
  "data": { /* catégorie créée */ }
}
```

---

#### `PUT /api/v1/categories/admin/:id`

**Auth** : admin
**Description** : Met à jour une catégorie. Mêmes champs que POST, tous optionnels.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "data": { /* catégorie mise à jour */ }
}
```

---

#### `DELETE /api/v1/categories/admin/:id`

**Auth** : admin
**Description** : Supprime une catégorie. Échoue si des produits y sont rattachés.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "message": "Catégorie supprimée"
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Des produits sont associés à cette catégorie |
| `404` | Catégorie introuvable |

---

#### `PATCH /api/v1/categories/admin/:id/status`

**Auth** : admin
**Description** : Active ou désactive une catégorie.

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis | Valeurs |
|---|---|---|---|
| `status` | string | oui | `active`, `inactive` |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* catégorie mise à jour */ }
}
```

---

#### `PUT /api/v1/categories/admin/reorder`

**Auth** : admin
**Description** : Réordonne les catégories.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `categories` | array | oui : `[{ id: uuid, displayOrder: integer }]` |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* résultat reorder */ }
}
```

---

#### `POST /api/v1/categories/admin/:id/image`

**Auth** : admin
**Description** : Associe une image (déjà uploadée via media) à une catégorie.

**Params** : `id` (uuid catégorie)

**Body**

| Champ | Type | Requis |
|---|---|---|
| `imageRef` | uuid | oui |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* catégorie mise à jour */ }
}
```

---

### 6.5 Cart

Base : `/api/v1/cart` — toutes les routes nécessitent authentification (`user`)

#### `GET /api/v1/cart`

**Auth** : user
**Description** : Récupère le panier complet de l'utilisateur.

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "id": "cart-uuid",
    "userId": "user-uuid",
    "items": [
      {
        "id": "item-uuid",
        "productId": "prod-uuid",
        "quantity": 2,
        "unitPriceHt": "29.99",
        "unitPriceTtc": "35.99",
        "createdAt": "2026-04-03T10:00:00.000Z"
      }
    ],
    "createdAt": "2026-04-03T10:00:00.000Z",
    "updatedAt": "2026-04-03T10:00:00.000Z"
  }
}
```

---

#### `GET /api/v1/cart/summary`

**Auth** : user
**Description** : Résumé concis du panier (compteur).

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalItems": 5,
      "itemCount": 3,
      "subtotalHt": "89.97",
      "subtotalTtc": "107.97"
    }
  }
}
```

---

#### `POST /api/v1/cart/items`

**Auth** : user
**Description** : Ajoute un produit au panier. Si le produit existe déjà, incrémente la quantité.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `productId` | uuid | oui | — |
| `quantity` | integer | oui | ≥ 1 |

**Réponse 201** : panier complet mis à jour
```json
{
  "success": true,
  "message": "Produit ajouté au panier",
  "data": { /* panier complet */ }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Stock insuffisant |
| `404` | Produit introuvable |

---

#### `PUT /api/v1/cart/items/:id`

**Auth** : user
**Description** : Met à jour la quantité d'un article du panier.

**Params** : `id` (uuid de l'item panier)

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `quantity` | integer | oui | ≥ 1 |

**Réponse 200** : panier complet mis à jour

---

#### `DELETE /api/v1/cart/items/:id`

**Auth** : user
**Description** : Retire un article du panier.

**Params** : `id` (uuid de l'item panier)

**Réponse 200**
```json
{
  "success": true,
  "message": "Article supprimé du panier",
  "data": { /* panier mis à jour */ }
}
```

---

#### `DELETE /api/v1/cart`

**Auth** : user
**Description** : Vide entièrement le panier.

**Réponse 200**
```json
{
  "success": true,
  "message": "Panier vidé avec succès"
}
```

---

#### `POST /api/v1/cart/merge`

**Auth** : user
**Description** : Fusionne un panier anonyme (pré-connexion) avec le panier utilisateur.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `anonymousCartItems` | array | oui : `[{ productId: uuid, quantity: integer }]` |

**Réponse 200**
```json
{
  "success": true,
  "message": "Paniers fusionnés avec succès",
  "data": {
    "cart": { /* panier fusionné complet */ }
  }
}
```

---

### 6.6 Checkout

Base : `/api/v1/checkout`

#### `POST /api/v1/checkout/validate`

**Auth** : user
**Description** : Valide le panier avant checkout (vérification stock et prix).

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "issues": []
  }
}
```

---

#### `GET /api/v1/checkout/shipping-options`

**Auth** : public
**Description** : Retourne les méthodes de livraison disponibles.

**Réponse 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "shipping-uuid",
      "name": "Livraison standard",
      "price": 5.99,
      "estimatedDays": "3-5 jours ouvrés"
    }
  ]
}
```

---

#### `POST /api/v1/checkout/shipping`

**Auth** : user
**Description** : Crée une session de checkout avec adresse et méthode de livraison.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `addressId` | uuid | oui |
| `shippingMethodId` | uuid | oui |

**Réponse 201**
```json
{
  "success": true,
  "data": {
    "sessionId": "session-uuid",
    "totalAmount": 141.97,
    "shippingCost": 5.99
  }
}
```

---

#### `POST /api/v1/checkout/calculate-total`

**Auth** : user
**Description** : Calcule le total avec livraison et code promo optionnel.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `shippingMethodId` | uuid | oui |
| `cartId` | uuid | non |
| `couponCode` | string | non (1–50 caractères) |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "subtotalHt": 89.97,
    "totalVat": 17.99,
    "subtotalTtc": 107.96,
    "shippingCost": 5.99,
    "discount": 10.00,
    "totalTtc": 103.95
  }
}
```

---

#### `POST /api/v1/checkout/apply-coupon`

**Auth** : user
**Description** : Valide et applique un code promo.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `sessionId` | uuid | oui |
| `couponCode` | string | oui (1–50 caractères) |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "discountAmount": 10.00,
    "discountPercentage": 10
  }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Code promo invalide ou expiré |

---

#### `POST /api/v1/checkout/payment-intent`

**Auth** : user
**Description** : Crée un Payment Intent Stripe pour initialiser le paiement côté client.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `sessionId` | uuid | oui |

**Réponse 201**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_1234_secret_5678",
    "paymentIntentId": "pi_1234567890"
  }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Session invalide |
| `503` | Service Stripe indisponible |

---

#### `POST /api/v1/checkout/confirm`

**Auth** : user
**Description** : Confirme le paiement et crée la commande. Le panier est vidé automatiquement.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `paymentIntentId` | string | oui |

**Réponse 201**
```json
{
  "success": true,
  "message": "Paiement confirmé et commande créée",
  "data": {
    "order": {
      "id": "order-uuid",
      "orderNumber": "ORD-2026-00001",
      "status": "pending",
      "totalTtc": "103.95",
      "createdAt": "2026-04-03T12:00:00.000Z"
    }
  }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Paiement échoué ou déjà traité |
| `503` | Service Stripe indisponible |

---

#### `GET /api/v1/checkout/session/:id`

**Auth** : user
**Description** : Récupère les détails d'une session de checkout en cours.

**Params** : `id` (uuid de la session)

**Réponse 200**
```json
{
  "success": true,
  "data": { /* session de checkout */ }
}
```

---

#### `DELETE /api/v1/checkout/session`

**Auth** : user
**Description** : Annule la session de checkout en cours.

**Réponse 200**
```json
{
  "success": true,
  "message": "Session annulée"
}
```

---

#### `GET /api/v1/checkout/payment-methods`

**Auth** : user
**Description** : Récupère les moyens de paiement disponibles pour le checkout (identique à `/users/me/payment-methods`).

**Réponse 200**
```json
{
  "success": true,
  "data": [ /* array de moyens de paiement */ ]
}
```

---

#### `POST /api/v1/checkout/webhook`

**Auth** : public (signature Stripe)
**Description** : Endpoint Stripe webhook. **Ne pas appeler manuellement.** Le body doit être raw (non parsé JSON).

**Headers requis** : `Stripe-Signature: <signature>`

**Réponse 200** : `{ received: true }`

---

### 6.7 Orders

Base : `/api/v1/orders`

#### `GET /api/v1/orders/me`

**Auth** : user
**Description** : Liste les commandes de l'utilisateur connecté.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `page` | integer | `1` | — |
| `limit` | integer | `10` | max 100 |
| `status` | string | — | `pending`, `processing`, `completed`, `cancelled` |
| `dateFrom` | string | — | format `YYYY-MM-DD` |
| `dateTo` | string | — | format `YYYY-MM-DD` |

**Réponse 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "order-uuid",
      "orderNumber": "ORD-2026-00001",
      "userId": "user-uuid",
      "status": "pending",
      "subtotalHt": "89.97",
      "totalVat": "17.99",
      "totalTtc": "107.96",
      "paymentStatus": "paid",
      "paidAt": "2026-04-03T12:05:00.000Z",
      "createdAt": "2026-04-03T12:00:00.000Z"
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

#### `GET /api/v1/orders/:id`

**Auth** : user
**Description** : Détail d'une commande. Retourne 403 si la commande n'appartient pas à l'utilisateur.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "orderNumber": "ORD-2026-00001",
    "status": "pending",
    "addressSnapshot": { "firstName": "Jean", "city": "Paris", "country": "FR" },
    "items": [
      {
        "id": "item-uuid",
        "productId": "prod-uuid",
        "productNameSnapshot": "Produit exemple",
        "quantity": 2,
        "unitPriceHt": "29.99",
        "vatRate": "20",
        "unitPriceTtc": "35.99",
        "totalTtc": "71.98"
      }
    ],
    "subtotalHt": "59.98",
    "totalVat": "11.99",
    "totalTtc": "71.97",
    "paymentStatus": "paid"
  }
}
```

---

#### `POST /api/v1/orders/:id/cancel`

**Auth** : user
**Description** : Annule une commande si elle est encore en statut `pending`.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "message": "Commande annulée avec succès",
  "data": { /* commande annulée */ }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | La commande ne peut pas être annulée (déjà traitée) |
| `403` | Cette commande ne vous appartient pas |
| `404` | Commande introuvable |

---

#### `POST /api/v1/orders/checkout`

**Auth** : user
**Description** : Endpoint legacy. Crée une commande directement depuis le panier (sans passer par le flux checkout Stripe). Préférer le flux `/api/v1/checkout/*`.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `addressId` | uuid | non |

**Réponse 201**
```json
{
  "success": true,
  "data": { /* commande créée */ }
}
```

---

#### `GET /api/v1/orders/admin`

**Auth** : admin
**Description** : Liste toutes les commandes (tous utilisateurs).

**Query** : mêmes params que `GET /orders/me`

**Réponse 200** : même format paginé

---

#### `GET /api/v1/orders/admin/export`

**Auth** : admin
**Description** : Export CSV de toutes les commandes.

**Query**

| Param | Type |
|---|---|
| `status` | string |
| `startDate` | string (YYYY-MM-DD) |
| `endDate` | string (YYYY-MM-DD) |

**Réponse 200** : fichier binaire `text/csv`

---

#### `GET /api/v1/orders/admin/:id`

**Auth** : admin
**Description** : Détail complet d'une commande (sans restriction de propriété).

**Params** : `id` (uuid)

**Réponse 200** : même format que `GET /orders/:id`

---

#### `PUT /api/v1/orders/admin/:id/status`

**Auth** : admin
**Description** : Met à jour le statut d'une commande.

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis | Valeurs |
|---|---|---|---|
| `status` | string | oui | valeur de l'enum `order_status` |
| `comment` | string | non | — |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* commande mise à jour */ }
}
```

---

### 6.8 Invoices

Base : `/api/v1/invoices`

> **Important** : Les endpoints invoices ne respectent pas le wrapper standard `{ success, data }`. Les réponses sont retournées directement.

#### `GET /api/v1/invoices/me`

**Auth** : user
**Description** : Liste les factures de l'utilisateur.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `status` | string | — | `pending`, `paid`, `cancelled`, `refunded` |
| `page` | integer | `1` | — |
| `limit` | integer | `20` | max 100 |

**Réponse 200** : résultat paginé direct
```json
{
  "data": [
    {
      "id": "inv-uuid",
      "invoiceNumber": "INV-2026-00001",
      "orderId": "order-uuid",
      "userId": "user-uuid",
      "status": "paid",
      "subtotalHt": "89.97",
      "totalVat": "17.99",
      "totalTtc": "107.96",
      "issuedAt": "2026-04-03T12:05:00.000Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

#### `GET /api/v1/invoices/:id`

**Auth** : user
**Description** : Détail d'une facture. Retourne 403 si la facture n'appartient pas à l'utilisateur.

**Params** : `id` (uuid)

**Réponse 200** (sans wrapper `success`)
```json
{
  "invoice": {
    "id": "inv-uuid",
    "invoiceNumber": "INV-2026-00001",
    "orderId": "order-uuid",
    "status": "paid",
    "subtotalHt": "89.97",
    "totalVat": "17.99",
    "totalTtc": "107.96",
    "billingAddressSnapshot": { /* adresse JSON */ },
    "issuedAt": "2026-04-03T12:05:00.000Z"
  }
}
```

---

#### `GET /api/v1/invoices/:id/pdf`

**Auth** : user
**Description** : Génère et télécharge le PDF de la facture. Retourne 403 si la facture n'appartient pas à l'utilisateur.

**Params** : `id` (uuid)

**Réponse 200** : fichier binaire `application/pdf` (stream)

---

#### `GET /api/v1/invoices/admin`

**Auth** : admin
**Description** : Liste toutes les factures avec filtres avancés.

**Query**

| Param | Type | Défaut |
|---|---|---|
| `status` | string | — |
| `search` | string | — |
| `startDate` | string | — |
| `endDate` | string | — |
| `minAmount` | number | — |
| `maxAmount` | number | — |
| `sortBy` | string | `createdAt` |
| `order` | string | `desc` |
| `page` | integer | `1` |
| `limit` | integer | `20` |

**Réponse 200** : même format paginé direct que `GET /invoices/me`

---

#### `GET /api/v1/invoices/admin/export`

**Auth** : admin
**Description** : Export des factures.

**Query**

| Param | Type | Défaut |
|---|---|---|
| `status` | string | — |
| `startDate` | string | — |
| `endDate` | string | — |
| `format` | string | `csv` |

**Réponse 200** : fichier binaire `text/csv` ou xlsx

---

#### `GET /api/v1/invoices/admin/:id`

**Auth** : admin
**Description** : Détail d'une facture (sans restriction de propriété).

**Params** : `id` (uuid)

**Réponse 200** : même format que `GET /invoices/:id`

---

#### `POST /api/v1/invoices/admin/:id/credit-note`

**Auth** : admin
**Description** : Crée une note de crédit (avoir) pour une facture.

**Params** : `id` (uuid de la facture)

**Body**

| Champ | Type | Requis | Description |
|---|---|---|---|
| `amount` | number | oui | Montant du remboursement |
| `reason` | string | oui | `cancellation`, `refund` ou `error` |
| `notes` | string | non | Notes libres |

**Réponse 201** (sans wrapper `success`)
```json
{
  "creditNote": {
    "id": "cn-uuid",
    "creditNoteNumber": "CN-2026-00001",
    "invoiceId": "inv-uuid",
    "userId": "user-uuid",
    "amount": "50.00",
    "reason": "refund",
    "issuedAt": "2026-04-03T14:00:00.000Z"
  }
}
```

---

### 6.9 Search

Base : `/api/v1/search`

#### `GET /api/v1/search/products`

**Auth** : public
**Description** : Recherche avancée de produits avec facettes.

**Query**

| Param | Type | Défaut | Description |
|---|---|---|---|
| `q` | string | — | Terme de recherche |
| `category` | string | — | Slug de catégorie |
| `minPrice` | number | — | Prix minimum |
| `maxPrice` | number | — | Prix maximum |
| `inStock` | boolean | — | Seulement en stock |
| `featured` | boolean | — | Seulement featured |
| `sort` | string | `relevance` | `name`, `price`, `createdAt`, `relevance` |
| `order` | string | `asc` | `asc`, `desc` |
| `page` | integer | `1` | — |
| `limit` | integer | `20` | — |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "results": [ /* array de produits */ ],
    "facets": {
      "categories": [{ "name": "Électronique", "count": 12 }],
      "priceRanges": [ /* ... */ ]
    },
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

---

#### `GET /api/v1/search/suggest`

**Auth** : public
**Description** : Suggestions de recherche en temps réel (autocomplétion).

**Query**

| Param | Type | Requis | Contraintes |
|---|---|---|---|
| `q` | string | oui | min 2 caractères |
| `limit` | integer | non | défaut 10 |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "type": "product",
        "text": "Produit exemple",
        "slug": "produit-exemple"
      },
      {
        "type": "category",
        "text": "Électronique",
        "slug": "electronique"
      }
    ]
  }
}
```

---

### 6.10 Media

Base : `/api/v1/media`

#### `POST /api/v1/media/upload`

**Auth** : user
**Description** : Upload d'un fichier unique (image, PDF, etc.). Max 10 MB. Le champ multipart doit s'appeler `file`.

**Body** : `multipart/form-data`

| Champ | Type | Requis |
|---|---|---|
| `file` | binary | oui |

**Réponse 201**
```json
{
  "success": true,
  "data": {
    "ref": "abc123def456",
    "url": "/api/v1/media/abc123def456",
    "filename": "photo.jpg",
    "mimeType": "image/jpeg",
    "size": 245678
  }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Type de fichier non supporté / champ invalide |
| `413` | Fichier trop volumineux (max 10 MB) |

---

#### `GET /api/v1/media/:ref`

**Auth** : public
**Description** : Récupère un fichier par sa référence. Retourne le contenu binaire.

**Params** : `ref` (string, référence unique du fichier)

**Réponse 200** : contenu binaire (`image/*`, `application/pdf`, etc.)

---

#### `DELETE /api/v1/media/:ref`

**Auth** : admin
**Description** : Supprime définitivement un fichier.

**Params** : `ref` (string)

**Réponse 200**
```json
{
  "success": true,
  "message": "Fichier supprimé"
}
```

---

#### `POST /api/v1/media/admin/bulk-upload`

**Auth** : admin
**Description** : Upload multiple (max 10 fichiers). Le champ multipart doit s'appeler `files`.

**Body** : `multipart/form-data`

| Champ | Type | Requis |
|---|---|---|
| `files` | binary[] | oui |

**Réponse 201**
```json
{
  "success": true,
  "data": [
    { "ref": "abc123", "url": "/api/v1/media/abc123", "filename": "img1.jpg" },
    { "ref": "def456", "url": "/api/v1/media/def456", "filename": "img2.jpg" }
  ]
}
```

---

#### `GET /api/v1/media/admin/all`

**Auth** : admin
**Description** : Liste tous les fichiers media avec filtres.

**Query**

| Param | Type | Défaut |
|---|---|---|
| `type` | string | — (`image`, `pdf`, `document`) |
| `search` | string | — |
| `page` | integer | `1` |
| `limit` | integer | `20` |

**Réponse 200** : résultat paginé standard

---

### 6.11 Contact

Base : `/api/v1/contact`

#### `POST /api/v1/contact/submit`

**Auth** : public
**Description** : Soumet un message de contact.

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `email` | string | oui | Email valide |
| `subject` | string | oui | max 200 caractères |
| `message` | string | oui | 10–2000 caractères |

**Réponse 201**
```json
{
  "success": true,
  "message": "Votre message a été envoyé avec succès.",
  "data": {
    "message": "Votre message a été envoyé.",
    "messageId": "uuid-du-message"
  }
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `400` | Données invalides |
| `429` | Trop de requêtes |

---

#### `GET /api/v1/contact/admin/messages`

**Auth** : admin
**Description** : Liste tous les messages de contact.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `status` | string | — | `unread`, `read`, `processed` |
| `search` | string | — | — |
| `startDate` | string | — | YYYY-MM-DD |
| `endDate` | string | — | YYYY-MM-DD |
| `page` | integer | `1` | — |
| `limit` | integer | `20` | — |
| `sortBy` | string | `createdAt` | `createdAt`, `updatedAt`, `name` |
| `order` | string | `desc` | `asc`, `desc` |

**Réponse 200** : résultat paginé standard

---

#### `GET /api/v1/contact/admin/messages/:id`

**Auth** : admin
**Description** : Détail d'un message de contact.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "id": "msg-uuid",
    "email": "jean.dupont@example.com",
    "subject": "Question produit",
    "message": "Bonjour...",
    "status": "unread",
    "userId": null,
    "createdAt": "2026-04-03T10:00:00.000Z"
  }
}
```

---

#### `PUT /api/v1/contact/admin/messages/:id/status`

**Auth** : admin
**Description** : Met à jour le statut d'un message.

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis | Valeurs |
|---|---|---|---|
| `status` | string | oui | `unread`, `read`, `processed` |

**Réponse 200**
```json
{
  "success": true,
  "message": "Statut du message mis à jour avec succès",
  "data": { /* message mis à jour */ }
}
```

---

#### `DELETE /api/v1/contact/admin/messages/:id`

**Auth** : admin
**Description** : Supprime définitivement un message.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "message": "Message supprimé avec succès"
}
```

---

### 6.12 Chatbot

Base : `/api/v1/chatbot`

> **Important** : Les endpoints chatbot ne respectent pas le wrapper standard `{ success, data }`.

#### `POST /api/v1/chatbot/sessions`

**Auth** : public (optionnel)
**Description** : Crée une nouvelle session de chatbot. Si l'utilisateur est connecté, passer son `userId` pour lier la session au compte.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `userId` | uuid | non |

**Réponse 201** (sans wrapper `success`)
```json
{
  "session": {
    "id": "session-uuid",
    "userId": null,
    "sessionToken": "tok_abc123",
    "status": "open",
    "createdAt": "2026-04-03T10:00:00.000Z"
  }
}
```

---

#### `POST /api/v1/chatbot/sessions/:sessionId/messages`

**Auth** : public
**Description** : Envoie un message dans une session. Le bot répond automatiquement aux messages de type `user`.

**Params** : `sessionId` (uuid)

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `message` | string | oui | 1–2000 caractères |
| `sender` | string | oui | `user` ou `bot` |

**Réponse 201** (sans wrapper `success`)
```json
{
  "userMessage": {
    "id": "msg-uuid",
    "sessionId": "session-uuid",
    "content": "Bonjour, j'ai besoin d'aide",
    "sender": "user",
    "createdAt": "2026-04-03T10:05:00.000Z"
  },
  "botResponse": {
    "id": "msg-uuid-2",
    "sessionId": "session-uuid",
    "content": "Bonjour ! Comment puis-je vous aider ?",
    "sender": "bot",
    "createdAt": "2026-04-03T10:05:01.000Z"
  }
}
```

---

#### `GET /api/v1/chatbot/sessions/:sessionId/messages`

**Auth** : public
**Description** : Récupère l'historique des messages d'une session.

**Params** : `sessionId` (uuid)

**Query**

| Param | Type | Défaut | Contraintes |
|---|---|---|---|
| `limit` | integer | `50` | 1–200 |

**Réponse 200** (sans wrapper `success`)
```json
{
  "messages": [
    {
      "id": "msg-uuid",
      "sessionId": "session-uuid",
      "content": "Bonjour",
      "sender": "user",
      "createdAt": "2026-04-03T10:05:00.000Z"
    }
  ]
}
```

---

#### `PUT /api/v1/chatbot/admin/sessions/:sessionId/escalate`

**Auth** : admin
**Description** : Escalade une session vers un agent humain. Change le statut en `escalated`.

**Params** : `sessionId` (uuid)

**Body**

| Champ | Type | Requis |
|---|---|---|
| `assignedTo` | uuid | non (ID de l'agent) |

**Réponse 200** (sans wrapper `success`)
```json
{
  "session": {
    "id": "session-uuid",
    "status": "escalated",
    "escalatedTo": "agent-uuid"
  },
  "message": "Session escaladée avec succès"
}
```

---

#### `GET /api/v1/chatbot/admin/sessions`

**Auth** : admin
**Description** : Liste toutes les sessions de chatbot.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `status` | string | — | `open`, `escalated`, `closed` |
| `userId` | uuid | — | — |
| `page` | integer | `1` | — |
| `limit` | integer | `20` | max 100 |

**Réponse 200** (sans wrapper `success`)
```json
{
  "sessions": [
    {
      "sessionId": "session-uuid",
      "userId": null,
      "status": "open",
      "messageCount": 8,
      "createdAt": "2026-04-03T10:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalSessions": 94,
    "limit": 20
  }
}
```

---

### 6.13 Analytics

Base : `/api/v1/analytics` — toutes les routes sont admin

#### `GET /api/v1/analytics/admin/overview`

**Auth** : admin
**Description** : Vue d'ensemble des KPIs.

**Query**

| Param | Type | Défaut |
|---|---|---|
| `startDate` | string | — (YYYY-MM-DD) |
| `endDate` | string | — (YYYY-MM-DD) |
| `compareWithPrevious` | boolean | `true` |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "overview": {
      "revenue": { "total": 125000.50, "change": 15.5 },
      "orders": { "total": 458, "change": 12.3 },
      "customers": { "total": 1234, "new": 156, "change": 8.7 },
      "products": { "total": 89, "outOfStock": 5, "lowStock": 12 },
      "averageOrderValue": 273.14,
      "conversionRate": 3.45
    }
  }
}
```

---

#### `GET /api/v1/analytics/admin/sales`

**Auth** : admin
**Description** : Données de ventes par période.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `startDate` | string | — | YYYY-MM-DD |
| `endDate` | string | — | YYYY-MM-DD |
| `groupBy` | string | `day` | `day`, `week`, `month`, `year` |
| `includeRefunds` | boolean | `false` | — |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "sales": {
      "summary": { "totalRevenue": 125000.50, "totalOrders": 458 },
      "timeline": [
        { "period": "2026-04-01", "revenue": 4500.00, "orders": 15 }
      ],
      "topProducts": [
        { "productId": "uuid", "productName": "...", "revenue": 12000.00, "quantitySold": 400 }
      ]
    }
  }
}
```

---

#### `GET /api/v1/analytics/admin/products`

**Auth** : admin
**Description** : Performances des produits.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `startDate` | string | — | — |
| `endDate` | string | — | — |
| `limit` | integer | `10` | — |
| `sortBy` | string | `revenue` | `revenue`, `quantity`, `views`, `conversionRate` |
| `categoryId` | uuid | — | — |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "productAnalytics": {
      "topSellers": [ /* ... */ ],
      "underperforming": [ /* ... */ ],
      "inventory": { "outOfStock": [], "lowStock": [] }
    }
  }
}
```

---

#### `GET /api/v1/analytics/admin/customers`

**Auth** : admin
**Description** : Statistiques et segmentation clients.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `startDate` | string | — | — |
| `endDate` | string | — | — |
| `limit` | integer | `10` | — |
| `segment` | string | `all` | `all`, `new`, `returning`, `vip`, `inactive` |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "customerAnalytics": {
      "summary": { "total": 1234, "new": 156, "returning": 890, "inactive": 188 },
      "topCustomers": [ /* ... */ ],
      "segments": { "vip": 45, "regular": 800, "occasional": 389 },
      "retention": { "rate": 68.5, "churnRate": 31.5 }
    }
  }
}
```

---

#### `GET /api/v1/analytics/admin/export`

**Auth** : admin
**Description** : Exporte un rapport analytics.

**Query**

| Param | Type | Requis | Valeurs |
|---|---|---|---|
| `reportType` | string | oui | `overview`, `sales`, `products`, `customers` |
| `format` | string | non (défaut `csv`) | `csv`, `json`, `xlsx` |
| `startDate` | string | non | — |
| `endDate` | string | non | — |
| `groupBy` | string | non | `day`, `week`, `month` |

**Réponse 200** : fichier binaire selon le format demandé

---

### 6.14 Legal

Base : `/api/v1/legal`

#### `GET /api/v1/legal/:type`

**Auth** : public
**Description** : Récupère le contenu d'une page légale.

**Params**

| Param | Valeurs |
|---|---|
| `type` | `cgu`, `mentions_legales`, `about` |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "id": "legal-uuid",
    "type": "cgu",
    "content": "<h1>Conditions Générales d'Utilisation</h1>...",
    "lang": "fr",
    "updatedAt": "2026-04-03T10:00:00.000Z"
  }
}
```

---

#### `GET /api/v1/legal/admin`

**Auth** : admin
**Description** : Liste toutes les pages légales.

**Réponse 200**
```json
{
  "success": true,
  "data": [ /* array de pages légales */ ]
}
```

---

#### `PUT /api/v1/legal/admin/:type`

**Auth** : admin
**Description** : Crée ou met à jour une page légale (upsert).

**Params** : `type` (`cgu`, `mentions_legales`, `about`)

**Body**

| Champ | Type | Requis |
|---|---|---|
| `content` | string | oui |
| `lang` | string | non (défaut `fr`) |

**Réponse 200/201**
```json
{
  "success": true,
  "data": { /* page légale */ }
}
```

---

#### `GET /api/v1/legal/admin/:type/history`

**Auth** : admin
**Description** : Historique des modifications d'une page légale.

**Params** : `type` (`cgu`, `mentions_legales`, `about`)

**Réponse 200**
```json
{
  "success": true,
  "data": [ /* array d'entrées historique */ ]
}
```

---

### 6.15 Homepage

Base : `/api/v1/homepage`

#### `GET /api/v1/homepage/carousel`

**Auth** : public
**Description** : Récupère les slides actifs du carrousel.

**Réponse 200**
```json
{
  "success": true,
  "data": [
    {
      "id": "slide-uuid",
      "imageRef": "media-uuid",
      "title": "Nouvelle collection",
      "textContent": "Découvrez nos nouveautés",
      "redirectUrl": "/produits",
      "displayOrder": 0,
      "isMainImage": false,
      "isActive": true
    }
  ]
}
```

---

#### `GET /api/v1/homepage/config`

**Auth** : public
**Description** : Configuration complète de la homepage.

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "id": "config-uuid",
    "fixedText": "Livraison gratuite dès 100€",
    "featuredProductIds": ["prod-uuid-1", "prod-uuid-2"],
    "updatedAt": "2026-04-03T10:00:00.000Z"
  }
}
```

---

#### `GET /api/v1/homepage/featured-products`

**Auth** : public
**Description** : Produits mis en avant sur la homepage.

**Query**

| Param | Type | Défaut |
|---|---|---|
| `limit` | integer | `8` |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "featuredProducts": [ /* array de produits */ ]
  }
}
```

---

#### `GET /api/v1/homepage/banners`

**Auth** : public
**Description** : Banners actifs de la homepage.

**Query**

| Param | Type | Valeurs |
|---|---|---|
| `position` | string | `TOP`, `MIDDLE`, `BOTTOM`, `SIDEBAR` |

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "banners": [ /* array de banners */ ]
  }
}
```

---

#### `POST /api/v1/homepage/admin/carousel`

**Auth** : admin
**Description** : Crée un slide de carrousel.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `imageRef` | uuid | non |
| `title` | string | non |
| `textContent` | string | non |
| `redirectUrl` | string | non |
| `displayOrder` | integer | non |
| `isMainImage` | boolean | non |
| `isActive` | boolean | non |

**Réponse 201**
```json
{
  "success": true,
  "data": { /* slide créé */ }
}
```

---

#### `PUT /api/v1/homepage/admin/carousel/:id`

**Auth** : admin
**Description** : Met à jour un slide. Mêmes champs que POST, tous optionnels.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "data": { /* slide mis à jour */ }
}
```

---

#### `DELETE /api/v1/homepage/admin/carousel/:id`

**Auth** : admin
**Description** : Supprime un slide.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "message": "Slide supprimé"
}
```

---

#### `POST /api/v1/homepage/admin/featured-products`

**Auth** : admin
**Description** : Ajoute un produit à la section featured de la homepage.

**Body**

| Champ | Type | Requis |
|---|---|---|
| `productId` | uuid | oui |

**Réponse 201**
```json
{
  "success": true,
  "data": {
    "featuredProduct": { /* produit ajouté */ }
  }
}
```

---

#### `DELETE /api/v1/homepage/admin/featured-products/:id`

**Auth** : admin
**Description** : Retire un produit de la section featured.

**Params** : `id` (uuid du produit)

**Réponse 204** : pas de body

---

#### `POST /api/v1/homepage/admin/banners`

**Auth** : admin
**Description** : Crée un banner.

**Body**

| Champ | Type | Requis | Valeurs |
|---|---|---|---|
| `title` | string | oui | — |
| `imageRef` | uuid | oui | — |
| `redirectUrl` | string | non | — |
| `position` | string | oui | `TOP`, `MIDDLE`, `BOTTOM`, `SIDEBAR` |
| `isActive` | boolean | non | — |

**Réponse 201**
```json
{
  "success": true,
  "data": {
    "banner": { /* banner créé */ }
  }
}
```

---

#### `PUT /api/v1/homepage/admin/banners/:id`

**Auth** : admin
**Description** : Met à jour un banner. Mêmes champs que POST, tous optionnels.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "banner": { /* banner mis à jour */ }
  }
}
```

---

#### `DELETE /api/v1/homepage/admin/banners/:id`

**Auth** : admin
**Description** : Supprime un banner.

**Params** : `id` (uuid)

**Réponse 204** : pas de body

---

### 6.16 Admin Users

Base : `/api/v1/admin/users` — toutes les routes sont admin

#### `GET /api/v1/admin/users`

**Auth** : admin
**Description** : Liste tous les utilisateurs avec filtres et pagination.

**Query**

| Param | Type | Défaut | Valeurs |
|---|---|---|---|
| `search` | string | — | Recherche par nom, email |
| `status` | string | — | `active`, `inactive`, `pending` |
| `sortBy` | string | `createdAt` | `name`, `email`, `createdAt`, `lastLoginAt`, `ordersCount`, `totalRevenue` |
| `sortOrder` | string | `desc` | `asc`, `desc` |
| `page` | integer | `1` | — |
| `limit` | integer | `25` | max 100 |

**Réponse 200** (utilise `pagination` au lieu de `meta`)
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "firstName": "Jean",
      "lastName": "Dupont",
      "email": "jean.dupont@example.com",
      "role": "user",
      "status": "active",
      "emailVerifiedAt": "2026-04-03T10:05:00.000Z",
      "lastLoginAt": "2026-04-03T12:00:00.000Z",
      "createdAt": "2026-04-03T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1234,
    "page": 1,
    "limit": 25,
    "totalPages": 50
  }
}
```

---

#### `GET /api/v1/admin/users/:id`

**Auth** : admin
**Description** : Détails complets d'un utilisateur avec commandes, adresses et statistiques.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean.dupont@example.com",
    "role": "user",
    "status": "active",
    "addresses": [ /* ... */ ],
    "orders": [ /* dernières commandes */ ],
    "stats": {
      "totalOrders": 5,
      "totalSpent": 549.95,
      "averageOrderValue": 109.99,
      "lastOrderDate": "2026-04-03T12:00:00.000Z"
    }
  }
}
```

---

#### `PATCH /api/v1/admin/users/:id/status`

**Auth** : admin
**Description** : Change le statut d'un utilisateur.

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis | Valeurs |
|---|---|---|---|
| `status` | string | oui | `active`, `inactive`, `pending` |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* utilisateur mis à jour */ },
  "message": "Statut de l'utilisateur modifié avec succès"
}
```

---

#### `POST /api/v1/admin/users/:id/send-email`

**Auth** : admin
**Description** : Envoie un email personnalisé à un utilisateur.

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `subject` | string | oui | 1–200 caractères |
| `content` | string | oui | 1+ caractères |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* résultat envoi */ },
  "message": "Email envoyé avec succès"
}
```

---

#### `POST /api/v1/admin/users/:id/reset-password`

**Auth** : admin
**Description** : Force la réinitialisation du mot de passe — envoie un email de réinitialisation à l'utilisateur.

**Params** : `id` (uuid)

**Réponse 200**
```json
{
  "success": true,
  "data": { /* résultat */ },
  "message": "Email de réinitialisation envoyé"
}
```

---

#### `DELETE /api/v1/admin/users/:id`

**Auth** : admin
**Description** : Supprime un utilisateur (soft delete avec `deletedAt`).

**Params** : `id` (uuid)

**Body**

| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `reason` | string | non | 1–500 caractères |

**Réponse 200**
```json
{
  "success": true,
  "data": { /* résultat */ },
  "message": "Utilisateur supprimé avec succès"
}
```

**Erreurs possibles**

| Code | Message |
|---|---|
| `403` | Impossible de supprimer cet administrateur |
| `404` | Utilisateur introuvable |

---

## Annexes

### Modèles de données (résumé)

#### User
```
id (uuid), firstName, lastName, email, role (user|admin),
status (pending|active|inactive), emailVerifiedAt, lastLoginAt,
createdAt, updatedAt, deletedAt
```

#### Product
```
id (uuid), categoryId, name, slug, description, technicalSpecs (json),
priceHt (decimal), vatRate (decimal, défaut 20), priceTtc (decimal),
stock (int), status (published|draft), isPriority, isFeatured,
displayOrder, mainImageRef, createdAt, updatedAt, deletedAt
```

#### Order
```
id (uuid), orderNumber, userId, addressSnapshot (json), status,
subtotalHt, totalVat, totalTtc, stripePaymentIntentId,
paymentMethodSnapshot, paymentStatus, paidAt, notes, createdAt, updatedAt
```

#### Invoice
```
id (uuid), invoiceNumber, orderId, userId, status (paid|pending|cancelled),
subtotalHt, totalVat, totalTtc, billingAddressSnapshot, pdfRef,
issuedAt, modifiedAt, cancelledAt
```

#### ChatbotSession
```
id (uuid), userId (nullable), sessionToken, status (open|escalated|closed),
escalatedTo (nullable), createdAt, closedAt
```

#### LegalPage
```
id (uuid), type (cgu|mentions_legales|about), content, lang (défaut 'fr'),
updatedAt, updatedBy
```

### Types enum

| Enum | Valeurs |
|---|---|
| `product_status` | `published`, `draft` |
| `invoice_status` | `paid`, `pending`, `cancelled` |
| `legal_type` | `cgu`, `mentions_legales`, `about` |
| `chatbot_status` | `open`, `escalated`, `closed` |
| `user_status` | `pending`, `active`, `inactive` |
| `user_role` | `user`, `admin` |
| `contact_status` | `unread`, `read`, `processed` |
| `credit_note_reason` | `cancellation`, `refund`, `error` |
