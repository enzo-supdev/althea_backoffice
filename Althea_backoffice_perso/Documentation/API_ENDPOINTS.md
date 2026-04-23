# ALTHEA API — Documentation complète des endpoints

**Base URL :** `http://localhost:3000/api/v1`  
**Swagger UI :** `http://localhost:3000/api-docs`

## Authentification

Tous les endpoints protégés requièrent un header :
```
Authorization: Bearer <accessToken>
```

Les endpoints admin requièrent en plus que l'utilisateur ait le rôle `ADMIN`.

## Format des réponses

Toutes les réponses suivent ce format :
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

---

## Sommaire

- [Auth](#auth)
- [Produits](#produits)
- [Catégories](#catégories)
- [Panier](#panier)
- [Commandes](#commandes)
- [Checkout](#checkout)
- [Factures](#factures)
- [Utilisateurs](#utilisateurs)
- [Admin — Utilisateurs](#admin--utilisateurs)
- [Media](#media)
- [Recherche](#recherche)
- [Homepage](#homepage)
- [Chatbot](#chatbot)
- [Contact](#contact)
- [Pages légales](#pages-légales)
- [Analytics](#analytics)

---

## Auth

### `POST /auth/register`
Créer un compte utilisateur. Envoie un email de vérification.

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `email` | string | oui | format email |
| `password` | string | oui | min 8 car., 1 maj., 1 min., 1 chiffre |
| `firstName` | string | oui | max 50 |
| `lastName` | string | oui | max 50 |

**Réponse 201 :**
```json
{
  "success": true,
  "message": "Utilisateur créé avec succès. Veuillez vérifier votre email.",
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Erreurs :** `400` validation, `409` email déjà utilisé

---

### `POST /auth/login`
Connexion. Rate limité.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `email` | string | oui |
| `password` | string | oui |

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Erreurs :** `401` identifiants incorrects, `429` trop de tentatives

---

### `POST /auth/logout`
**Auth requise.**  
Déconnecte l'utilisateur et invalide le refresh token.

**Réponse 200 :**
```json
{ "success": true, "message": "Déconnexion réussie" }
```

---

### `POST /auth/refresh-token`
Génère un nouveau access token.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `refreshToken` | string | oui |

**Réponse 200 :**
```json
{ "success": true, "data": { "accessToken": "eyJ..." } }
```

**Erreurs :** `401` refresh token invalide ou expiré

---

### `GET /auth/verify-email/:token`
Vérifie l'email via le token reçu par email.

**Path params :** `token` (string)

**Réponse 200 :**
```json
{ "success": true, "message": "Email vérifié avec succès" }
```

**Erreurs :** `400` token invalide ou expiré

---

### `POST /auth/resend-verification`
Renvoie l'email de vérification. Rate limité.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `email` | string | oui |

**Réponse 200 :**
```json
{ "success": true, "message": "Email de vérification envoyé" }
```

---

### `POST /auth/forgot-password`
Envoie un email avec un lien de réinitialisation. Rate limité.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `email` | string | oui |

**Réponse 200 :**
```json
{ "success": true, "message": "Email de réinitialisation envoyé" }
```

---

### `POST /auth/reset-password/:token`
Réinitialise le mot de passe via le token reçu par email.

**Path params :** `token` (string)

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `password` | string | oui | min 8 car., 1 maj., 1 min., 1 chiffre |

**Réponse 200 :**
```json
{ "success": true, "message": "Mot de passe réinitialisé avec succès" }
```

---

### `POST /auth/change-password`
**Auth requise.**  
Change le mot de passe de l'utilisateur connecté.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `currentPassword` | string | oui |
| `newPassword` | string | oui |

**Réponse 200 :**
```json
{ "success": true, "message": "Mot de passe changé avec succès" }
```

**Erreurs :** `401` mot de passe actuel incorrect

---

## Produits

### `GET /products`
Liste des produits publiés avec pagination.

**Query params :**
| Param | Type | Défaut | Description |
|---|---|---|---|
| `page` | integer | 1 | |
| `limit` | integer | 20 | |
| `search` | string | — | Recherche par nom |
| `category` | string | — | Slug de catégorie |
| `sortBy` | enum | — | `name`, `priceHt`, `createdAt`, `displayOrder` |
| `sortOrder` | enum | — | `asc`, `desc` |
| `status` | enum | — | `draft`, `published` |
| `availability` | enum | — | Disponibilité |
| `minPrice` | number | — | |
| `maxPrice` | number | — | |
| `vatRate` | number | — | |

**Réponse 200 :**
```json
{
  "success": true,
  "data": [ { ...Product, "category": {...}, "images": [...] } ],
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

---

### `GET /products/top`
Produits vedettes (`isFeatured = true`).

**Query params :** `limit` (integer, défaut : 6)

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Product } ] }
```

---

### `GET /products/:slug`
Détail d'un produit par son slug.

**Path params :** `slug` (string)

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "product": { ...Product },
    "images": [ { "id": "uuid", "imageRef": "...", "displayOrder": 0, "isMain": true } ]
  }
}
```

**Erreurs :** `404` produit non trouvé

---

### `GET /products/:id/similar`
6 produits de la même catégorie que le produit donné.

**Path params :** `id` (UUID)

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Product } ] }
```

---

### `GET /products/category/:categorySlug`
Produits d'une catégorie.

**Path params :** `categorySlug` (string)

**Query params :** `page`, `limit`, `search`, `sortBy`, `sortOrder`

**Réponse 200 :**
```json
{
  "success": true,
  "data": [ { ...Product } ],
  "meta": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
}
```

---

### `GET /products/admin` *(Admin)*
**Auth admin requise.**  
Liste tous les produits, tous statuts confondus. Mêmes query params que `GET /products`.

---

### `GET /products/admin/export` *(Admin)*
**Auth admin requise.**  
Export CSV des produits.

**Réponse 200 :** Fichier `text/csv`

---

### `GET /products/admin/export/advanced` *(Admin)*
**Auth admin requise.**  
Export avancé avec filtres.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `format` | enum | `csv` — `csv`, `json` |
| `categoryId` | UUID | — |
| `status` | enum | — |
| `minPrice` | number | — |
| `maxPrice` | number | — |
| `minStock` | integer | — |
| `maxStock` | integer | — |

**Réponse 200 :** Fichier CSV ou JSON

---

### `GET /products/admin/:id` *(Admin)*
**Auth admin requise.**  
Détail complet d'un produit par ID.

**Path params :** `id` (UUID)

**Réponse 200 :**
```json
{ "success": true, "data": { "product": { ...Product }, "images": [...] } }
```

---

### `POST /products/admin` *(Admin)*
**Auth admin requise.**  
Créer un produit.

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `name` | string | oui | max 200 |
| `slug` | string | oui | `^[a-z0-9-]+$`, max 220 |
| `description` | string | non | max 5000 |
| `technicalSpecs` | `{key, value}[]` | non | max 50 items |
| `categoryId` | UUID | oui | |
| `priceHt` | number | oui | min 0 |
| `vatRate` | number | non | `0`, `5.5`, `10`, `20` — défaut `20` |
| `stock` | integer | non | min 0 — défaut `0` |
| `status` | enum | non | `draft`, `published` |
| `isPriority` | boolean | non | défaut `false` |
| `isFeatured` | boolean | non | défaut `false` |
| `displayOrder` | integer | non | min 0 |
| `mainImageRef` | string | non | référence fichier media |

**Réponse 201 :**
```json
{ "success": true, "data": { ...Product } }
```

> **Note :** `mainImageRef` doit être la valeur `ref` retournée par `POST /media/upload`, pas l'URL complète.

---

### `PUT /products/admin/:id` *(Admin)*
**Auth admin requise.**  
Modifier un produit. Tous les champs sont optionnels.

**Path params :** `id` (UUID)

**Body :** Mêmes champs que la création, tous optionnels.

**Réponse 200 :**
```json
{ "success": true, "data": { ...Product } }
```

---

### `PATCH /products/admin/:id/status` *(Admin)*
**Auth admin requise.**  
Changer le statut de publication.

**Path params :** `id` (UUID)

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `status` | enum | oui — `draft`, `published` |

**Réponse 200 :**
```json
{ "success": true, "data": { ...Product } }
```

---

### `PUT /products/admin/:id/stock` *(Admin)*
**Auth admin requise.**  
Mettre à jour le stock.

**Path params :** `id` (UUID)

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `stock` | integer | oui | min 0 |
| `operation` | enum | non | `set` (défaut), `increment`, `decrement` |

**Réponse 200 :**
```json
{ "success": true, "data": { "id": "uuid", "name": "...", "stock": 42 } }
```

---

### `POST /products/admin/:id/duplicate` *(Admin)*
**Auth admin requise.**  
Dupliquer un produit.

**Path params :** `id` (UUID)

**Body :**
| Champ | Type | Requis | Défaut |
|---|---|---|---|
| `name` | string | non | nom original + " (copie)" |
| `copyImages` | boolean | non | `false` |
| `copyVariants` | boolean | non | `false` |

**Réponse 201 :**
```json
{ "success": true, "data": { "product": { ...Product } } }
```

---

### `DELETE /products/admin/:id` *(Admin)*
**Auth admin requise.**  
Soft delete d'un produit.

**Path params :** `id` (UUID)

**Réponse 200 :**
```json
{ "success": true, "data": { "success": true } }
```

---

### `DELETE /products/admin/bulk` *(Admin)*
**Auth admin requise.**  
Suppression groupée.

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `ids` | UUID[] | oui | min 1 item |

**Réponse 200 :**
```json
{ "success": true, "data": { "success": true, "deletedCount": 5 } }
```

---

### `PATCH /products/admin/bulk/status` *(Admin)*
**Auth admin requise.**  
Modification groupée du statut.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `ids` | UUID[] | oui |
| `status` | enum | oui |

**Réponse 200 :**
```json
{ "success": true, "data": { "success": true, "updatedCount": 5 } }
```

---

### `PATCH /products/admin/bulk/category` *(Admin)*
**Auth admin requise.**  
Modification groupée de la catégorie.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `ids` | UUID[] | oui |
| `categoryId` | UUID | oui |

**Réponse 200 :**
```json
{ "success": true, "data": { "success": true, "updatedCount": 5 } }
```

---

### `POST /products/admin/:id/images` *(Admin)*
**Auth admin requise.**  
Associer des images existantes (déjà uploadées via `/media/upload`) à un produit.

**Path params :** `id` (UUID)

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `imageRefs` | string[] | oui | min 1 — références media |

**Réponse 201 :**
```json
{ "success": true, "data": [ { "id": "uuid", "imageRef": "...", "displayOrder": 0, "isMain": false } ] }
```

---

### `DELETE /products/admin/:id/images/:imageId` *(Admin)*
**Auth admin requise.**  
Supprimer une image d'un produit.

**Path params :** `id` (UUID), `imageId` (UUID)

**Réponse 200 :**
```json
{ "success": true, "data": { "success": true } }
```

---

### `PUT /products/admin/:id/images/reorder` *(Admin)*
**Auth admin requise.**  
Réordonner les images d'un produit.

**Path params :** `id` (UUID)

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `imageIds` | UUID[] | oui | min 1 — dans l'ordre voulu |

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...ProductImage } ] }
```

---

## Catégories

### `GET /categories`
Liste des catégories actives.

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Category } ] }
```

---

### `GET /categories/:slug`
Détail d'une catégorie et ses produits.

**Path params :** `slug` (string)

**Réponse 200 :**
```json
{ "success": true, "data": { "category": { ...Category }, "products": [...] } }
```

---

### `GET /categories/admin` *(Admin)*
**Auth admin requise.**  
Liste toutes les catégories (actives et inactives).

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Category } ] }
```

---

### `POST /categories/admin` *(Admin)*
**Auth admin requise.**  
Créer une catégorie.

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `name` | string | oui | max 100 |
| `slug` | string | oui | `^[a-z0-9-]+$`, max 120 |
| `description` | string | non | max 2000 |
| `imageRef` | string | non | référence fichier media |
| `status` | enum | non | `active`, `inactive` |
| `displayOrder` | integer | non | min 0 |

**Réponse 201 :**
```json
{ "success": true, "data": { ...Category } }
```

---

### `PUT /categories/admin/:id` *(Admin)*
**Auth admin requise.**  
Modifier une catégorie. Tous les champs sont optionnels.

**Path params :** `id` (UUID)

**Réponse 200 :**
```json
{ "success": true, "data": { ...Category } }
```

---

### `PATCH /categories/admin/:id/status` *(Admin)*
**Auth admin requise.**  
Activer ou désactiver une catégorie.

**Path params :** `id` (UUID)

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `status` | enum | oui — `active`, `inactive` |

**Réponse 200 :**
```json
{ "success": true, "data": { ...Category } }
```

---

### `PUT /categories/admin/reorder` *(Admin)*
**Auth admin requise.**  
Réordonner les catégories.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `categories` | `{id: UUID, displayOrder: integer}[]` | oui |

**Réponse 200 :**
```json
{ "success": true, "data": { "success": true } }
```

---

### `POST /categories/admin/:id/image` *(Admin)*
**Auth admin requise.**  
Associer une image à une catégorie.

**Path params :** `id` (UUID)

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `imageRef` | string | oui — référence media |

**Réponse 200 :**
```json
{ "success": true, "data": { ...Category } }
```

---

### `DELETE /categories/admin/:id` *(Admin)*
**Auth admin requise.**  
Supprimer une catégorie. Échoue si des produits y sont associés.

**Path params :** `id` (UUID)

**Réponse 200 :**
```json
{ "success": true, "data": { "success": true } }
```

**Erreurs :** `400` si produits associés

---

## Panier

### `GET /cart`
**Auth requise.**  
Récupérer le panier complet de l'utilisateur.

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "items": [ { "id": 1, "product": {...}, "quantity": 2 } ],
    "totalItems": 3,
    "subtotal": 99.99
  }
}
```

---

### `GET /cart/summary`
**Auth requise.**  
Résumé du panier (compteurs uniquement).

**Réponse 200 :**
```json
{ "success": true, "data": { "totalItems": 5, "subtotal": 149.95, "itemCount": 3 } }
```

---

### `POST /cart/items`
**Auth requise.**  
Ajouter un produit au panier.

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `productId` | integer | oui | |
| `quantity` | integer | oui | min 1 |

**Réponse 201 :**
```json
{ "success": true, "message": "Produit ajouté au panier", "data": { ...CartItem } }
```

---

### `PUT /cart/items/:id`
**Auth requise.**  
Modifier la quantité d'un article.

**Path params :** `id` (integer)

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `quantity` | integer | oui | min 1 |

**Réponse 200 :**
```json
{ "success": true, "message": "Quantité mise à jour", "data": { ...CartItem } }
```

---

### `DELETE /cart/items/:id`
**Auth requise.**  
Supprimer un article du panier.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "message": "Article supprimé du panier" }
```

---

### `DELETE /cart`
**Auth requise.**  
Vider le panier.

**Réponse 200 :**
```json
{ "success": true, "message": "Panier vidé avec succès" }
```

---

### `POST /cart/merge`
**Auth requise.**  
Fusionner un panier anonyme (stocké côté client) avec le panier de l'utilisateur.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `anonymousCartItems` | `{productId: integer, quantity: integer}[]` | oui |

**Réponse 200 :**
```json
{ "success": true, "message": "Paniers fusionnés avec succès", "data": { ...Cart } }
```

---

## Commandes

### `GET /orders/me`
**Auth requise.**  
Liste des commandes de l'utilisateur connecté.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `page` | integer | 1 |
| `limit` | integer | 10 |
| `status` | enum | — — `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED` |

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Order } ], "meta": { ...pagination } }
```

---

### `GET /orders/:id`
**Auth requise.**  
Détail d'une commande. Vérifie que la commande appartient à l'utilisateur.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "data": { ...Order } }
```

**Erreurs :** `403` si la commande n'appartient pas à l'utilisateur

---

### `POST /orders/:id/cancel`
**Auth requise.**  
Annuler une commande.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "message": "Commande annulée avec succès", "data": { ...Order } }
```

**Erreurs :** `400` si la commande ne peut pas être annulée (ex: déjà expédiée)

---

### `POST /orders/checkout`
**Auth requise.**  
Créer une commande depuis le panier.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `shippingAddressId` | integer | oui |
| `paymentMethodId` | integer | oui |
| `shippingMethod` | enum | oui — `STANDARD`, `EXPRESS`, `PICKUP` |
| `couponCode` | string | non |

**Réponse 201 :**
```json
{ "success": true, "message": "Commande créée avec succès", "data": { ...Order } }
```

---

### `GET /orders/admin` *(Admin)*
**Auth admin requise.**  
Liste toutes les commandes.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `page` | integer | 1 |
| `limit` | integer | 20 |
| `status` | enum | — |
| `search` | string | — — numéro ou email |
| `startDate` | date | — |
| `endDate` | date | — |

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Order } ], "meta": { ...pagination } }
```

---

### `GET /orders/admin/:id` *(Admin)*
**Auth admin requise.**  
Détail d'une commande.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "data": { ...Order } }
```

---

### `PUT /orders/admin/:id/status` *(Admin)*
**Auth admin requise.**  
Changer le statut d'une commande.

**Path params :** `id` (integer)

**Body :**
| Champ | Type | Requis | Notes |
|---|---|---|---|
| `status` | enum | oui | `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED` |
| `trackingNumber` | string | non | obligatoire si `status = SHIPPED` |
| `notes` | string | non | |

**Réponse 200 :**
```json
{ "success": true, "message": "Statut de la commande mis à jour", "data": { ...Order } }
```

---

### `GET /orders/admin/export` *(Admin)*
**Auth admin requise.**  
Export CSV des commandes.

**Query params :** `startDate`, `endDate`, `status`

**Réponse 200 :** Fichier `text/csv`

---

## Checkout

### `POST /checkout/validate`
**Auth requise.**  
Valider le panier avant de procéder au paiement.

**Réponse 200 :**
```json
{ "success": true, "data": { "isValid": true, "issues": [] } }
```

---

### `GET /checkout/shipping-options`
Liste les options de livraison disponibles.

**Réponse 200 :**
```json
{
  "success": true,
  "data": [
    { "id": "STANDARD", "name": "Livraison standard", "price": 5.99, "estimatedDays": "3-5 jours ouvrés" },
    { "id": "EXPRESS", "name": "Livraison express", "price": 12.99, "estimatedDays": "1-2 jours ouvrés" }
  ]
}
```

---

### `POST /checkout/shipping`
**Auth requise.**  
Créer une session de checkout.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `shippingMethod` | enum | oui — `STANDARD`, `EXPRESS`, `PICKUP` |
| `shippingAddressId` | integer | oui |

**Réponse 201 :**
```json
{ "success": true, "data": { "sessionId": "...", "totalAmount": 150.00, "shippingCost": 5.99 } }
```

---

### `POST /checkout/calculate-total`
**Auth requise.**  
Calculer le total avec frais de livraison et code promo.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `shippingMethod` | enum | oui |
| `couponCode` | string | non |

**Réponse 200 :**
```json
{ "success": true, "data": { "subtotal": 99.99, "shippingCost": 5.99, "discount": 10.00, "total": 95.98 } }
```

---

### `POST /checkout/apply-coupon`
**Auth requise.**  
Appliquer un code promotionnel.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `couponCode` | string | oui |

**Réponse 200 :**
```json
{ "success": true, "data": { "discountAmount": 10.00, "discountPercentage": 10 } }
```

---

### `POST /checkout/payment-intent`
**Auth requise.**  
Créer un Payment Intent Stripe.

**Body :**
| Champ | Type | Requis | Défaut |
|---|---|---|---|
| `amount` | number | oui | |
| `currency` | string | non | `eur` |
| `paymentMethodId` | string | non | ID Stripe |

**Réponse 201 :**
```json
{ "success": true, "data": { "clientSecret": "pi_xxx_secret_xxx", "paymentIntentId": "pi_xxx" } }
```

---

### `POST /checkout/confirm`
**Auth requise.**  
Confirmer le paiement et créer la commande.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `paymentIntentId` | string | oui |
| `sessionId` | string | non |

**Réponse 200 :**
```json
{
  "success": true,
  "message": "Paiement confirmé et commande créée",
  "data": { "orderId": 1, "orderNumber": "ORD-2024-00001", "order": { ...Order } }
}
```

---

### `GET /checkout/session/:id`
**Auth requise.**  
Récupérer une session de checkout.

**Path params :** `id` (string)

**Réponse 200 :**
```json
{ "success": true, "data": { ...CheckoutSession } }
```

---

### `DELETE /checkout/session`
**Auth requise.**  
Annuler la session de checkout en cours.

**Réponse 200 :**
```json
{ "success": true, "message": "Session annulée" }
```

---

### `GET /checkout/payment-methods`
**Auth requise.**  
Récupérer les moyens de paiement enregistrés.

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...PaymentMethod } ] }
```

---

### `POST /checkout/webhook`
Webhook Stripe. **Corps brut (raw body) requis.**  
Ne pas appeler manuellement — utilisé par Stripe uniquement.

**Réponse 200 :**
```json
{ "success": true, "received": true }
```

---

## Factures

### `GET /invoices/me`
**Auth requise.**  
Liste des factures de l'utilisateur connecté.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `page` | integer | 1 |
| `limit` | integer | 10 |
| `status` | enum | — — `PENDING`, `PAID`, `CANCELLED`, `REFUNDED` |
| `startDate` | date | — |
| `endDate` | date | — |

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Invoice } ], "meta": { ...pagination } }
```

---

### `GET /invoices/:id`
**Auth requise.**  
Détail d'une facture.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoiceNumber": "INV-2024-00001",
    "orderId": 1,
    "status": "PAID",
    "items": [...],
    "subtotal": 100.00,
    "tax": 20.00,
    "totalAmount": 120.00,
    "issueDate": "2024-03-20",
    "paidAt": "2024-03-25T10:30:00Z"
  }
}
```

---

### `GET /invoices/:id/pdf`
**Auth requise.**  
Télécharger le PDF d'une facture.

**Path params :** `id` (integer)

**Réponse 200 :** Fichier `application/pdf`

**Erreurs :** `403` si la facture n'appartient pas à l'utilisateur

---

### `GET /invoices/admin` *(Admin)*
**Auth admin requise.**  
Liste toutes les factures.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `page` | integer | 1 |
| `limit` | integer | 20 |
| `status` | enum | — |
| `search` | string | — — numéro, email ou nom client |
| `startDate` | date | — |
| `endDate` | date | — |
| `minAmount` | number | — |
| `maxAmount` | number | — |
| `sortBy` | enum | `createdAt` |
| `order` | enum | `desc` |

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Invoice } ], "meta": { ...pagination } }
```

---

### `GET /invoices/admin/:id` *(Admin)*
**Auth admin requise.**  
Détail d'une facture (sans vérification de propriété).

**Path params :** `id` (integer)

---

### `POST /invoices/admin/:id/credit-note` *(Admin)*
**Auth admin requise.**  
Créer un avoir sur une facture.

**Path params :** `id` (integer)

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `amount` | number | oui |
| `reason` | string | oui |
| `items` | array | non |
| `sendEmail` | boolean | non — défaut `true` |

**Réponse 201 :**
```json
{
  "success": true,
  "data": { "id": 1, "creditNoteNumber": "CN-2024-00001", "invoiceId": 1, "amount": 50.00 }
}
```

---

### `GET /invoices/admin/export` *(Admin)*
**Auth admin requise.**  
Export CSV/XLSX des factures.

**Query params :** `startDate`, `endDate`, `status`, `format` (`csv` ou `xlsx`, défaut `csv`)

**Réponse 200 :** Fichier CSV ou XLSX

---

## Utilisateurs

### `GET /users/me`
**Auth requise.**  
Profil de l'utilisateur connecté.

**Réponse 200 :**
```json
{ "success": true, "data": { ...User } }
```

---

### `PUT /users/me`
**Auth requise.**  
Mettre à jour le profil.

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `firstName` | string | non | max 50 |
| `lastName` | string | non | max 50 |
| `phone` | string | non | nullable |

**Réponse 200 :**
```json
{ "success": true, "data": { ...User } }
```

---

### `PUT /users/me/email`
**Auth requise.**  
Changer l'adresse email. Envoie un email de vérification.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `email` | string | oui |

**Réponse 200 :**
```json
{ "success": true, "message": "Email modifié. Veuillez vérifier votre nouvel email." }
```

**Erreurs :** `409` email déjà utilisé

---

### `GET /users/me/orders`
**Auth requise.**  
Commandes de l'utilisateur. Query params : `page`, `limit`, `status`.

---

### `GET /users/me/invoices`
**Auth requise.**  
Factures de l'utilisateur. Query params : `page`, `limit`.

---

### `GET /users/me/addresses`
**Auth requise.**  
Adresses enregistrées.

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Address } ] }
```

---

### `POST /users/me/addresses`
**Auth requise.**  
Créer une adresse.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `street` | string | oui |
| `city` | string | oui |
| `postalCode` | string | oui |
| `country` | string | oui |
| `isDefault` | boolean | non — défaut `false` |

**Réponse 201 :**
```json
{ "success": true, "data": { ...Address } }
```

---

### `PUT /users/me/addresses/:id`
**Auth requise.**  
Modifier une adresse. Tous les champs optionnels.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "data": { ...Address } }
```

---

### `DELETE /users/me/addresses/:id`
**Auth requise.**  
Supprimer une adresse.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "message": "Adresse supprimée" }
```

---

### `GET /users/me/payment-methods`
**Auth requise.**  
Moyens de paiement enregistrés.

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...PaymentMethod } ] }
```

---

### `POST /users/me/payment-methods`
**Auth requise.**  
Enregistrer un moyen de paiement Stripe.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `paymentMethodId` | string | oui — ID Stripe |
| `isDefault` | boolean | non — défaut `false` |

**Réponse 201 :**
```json
{ "success": true, "data": { ...PaymentMethod } }
```

---

### `PUT /users/me/payment-methods/:id/default`
**Auth requise.**  
Définir un moyen de paiement par défaut.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "data": { ...PaymentMethod } }
```

---

### `DELETE /users/me/payment-methods/:id`
**Auth requise.**  
Supprimer un moyen de paiement.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "message": "Moyen de paiement supprimé" }
```

---

## Admin — Utilisateurs

### `GET /admin/users` *(Admin)*
**Auth admin requise.**  
Liste tous les utilisateurs avec filtres.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `search` | string | — — nom, email ou ID |
| `role` | enum | — — `USER`, `ADMIN` |
| `emailVerified` | boolean | — |
| `status` | enum | — — `ACTIVE`, `SUSPENDED`, `DELETED` |
| `startDate` | date | — |
| `endDate` | date | — |
| `page` | integer | 1 |
| `limit` | integer | 20 |
| `sortBy` | enum | `createdAt` |
| `order` | enum | `desc` |

**Réponse 200 :**
```json
{
  "success": true,
  "data": [ { ...User, "status": "ACTIVE", "ordersCount": 5, "totalSpent": 450.00 } ],
  "meta": { ...pagination }
}
```

---

### `GET /admin/users/:id` *(Admin)*
**Auth admin requise.**  
Détail complet d'un utilisateur.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "...User fields",
    "addresses": [...],
    "orders": [...],
    "stats": {
      "totalOrders": 10,
      "totalSpent": 1500.50,
      "averageOrderValue": 150.05,
      "lastOrderDate": "2024-03-20T10:30:00Z"
    }
  }
}
```

---

### `PATCH /admin/users/:id/status` *(Admin)*
**Auth admin requise.**  
Modifier le statut d'un utilisateur.

**Path params :** `id` (integer)

**Body :**
| Champ | Type | Requis | Notes |
|---|---|---|---|
| `status` | enum | oui | `ACTIVE`, `SUSPENDED`, `DELETED` |
| `reason` | string | conditionnel | obligatoire si `SUSPENDED` ou `DELETED` |
| `sendEmail` | boolean | non | défaut `true` |

**Réponse 200 :**
```json
{ "success": true, "message": "Statut de l'utilisateur modifié", "data": { ...User } }
```

---

### `POST /admin/users/:id/send-email` *(Admin)*
**Auth admin requise.**  
Envoyer un email personnalisé à un utilisateur.

**Path params :** `id` (integer)

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `subject` | string | oui | max 200 |
| `message` | string | oui | HTML supporté |
| `template` | enum | non | `NOTIFICATION` (défaut), `MARKETING`, `SUPPORT` |

**Réponse 200 :**
```json
{ "success": true, "message": "Email envoyé avec succès" }
```

---

### `POST /admin/users/:id/reset-password` *(Admin)*
**Auth admin requise.**  
Forcer la réinitialisation du mot de passe d'un utilisateur.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "message": "Email de réinitialisation envoyé avec succès" }
```

---

### `DELETE /admin/users/:id` *(Admin)*
**Auth admin requise.**  
Supprimer un utilisateur.

**Path params :** `id` (integer)

**Body :**
| Champ | Type | Requis | Notes |
|---|---|---|---|
| `deleteType` | enum | oui | `SOFT`, `HARD` |
| `reason` | string | oui | |
| `anonymize` | boolean | non | pour `HARD` uniquement — défaut `false` |

**Réponse 200 :**
```json
{ "success": true, "message": "Utilisateur supprimé avec succès" }
```

---

## Media

### `POST /media/upload`
**Auth requise.**  
Uploader un fichier. Les fichiers sont stockés dans **MongoDB GridFS**.

**Body :** `multipart/form-data`
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `file` | binary | oui | max 10 MB, types autorisés : jpeg, png, webp, gif, mp4, webm, mov, pdf, doc, docx |

**Réponse 201 :**
```json
{
  "success": true,
  "data": {
    "ref": "1745000000000-uuid.jpg",
    "url": "/api/v1/media/1745000000000-uuid.jpg",
    "mimetype": "image/jpeg",
    "size": 102400
  }
}
```

> La valeur `ref` est ce qu'il faut passer dans `mainImageRef`, `imageRef`, etc. sur les autres endpoints.

---

### `GET /media/:ref`
Récupérer un fichier (stream direct). Pas d'auth requise. Cache 1 an.

**Path params :** `ref` (string — valeur du champ `ref` retourné à l'upload)

**Réponse 200 :** Contenu binaire du fichier avec le bon `Content-Type`

**Erreurs :** `404` fichier non trouvé

---

### `DELETE /media/:ref`
**Auth requise.**  
Supprimer un fichier.

**Path params :** `ref` (string)

**Réponse 200 :**
```json
{ "success": true, "message": "Fichier supprimé avec succès" }
```

---

### `POST /media/admin/bulk-upload` *(Admin)*
**Auth admin requise.**  
Upload multiple (max 10 fichiers).

**Body :** `multipart/form-data`
| Champ | Type | Requis |
|---|---|---|
| `files` | binary[] | oui — max 10 |

**Réponse 201 :**
```json
{
  "success": true,
  "data": {
    "files": [ { "ref": "...", "url": "...", "filename": "...", "size": 0, "mimeType": "..." } ],
    "count": 3
  }
}
```

---

### `GET /media/admin/all` *(Admin)*
**Auth admin requise.**  
Liste tous les fichiers avec pagination.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `type` | enum | — — `image`, `video`, `document` |
| `search` | string | — — recherche par nom original |
| `uploadedBy` | string | — — ID utilisateur |
| `page` | integer | 1 |
| `limit` | integer | 20 |

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "media": [ { "id": "...", "originalName": "...", "filename": "...", "url": "...", "mimeType": "...", "size": 0 } ],
    "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
  }
}
```

---

## Recherche

### `GET /search/products`
Recherche avancée de produits.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `q` | string | — — terme de recherche |
| `category` | string | — — slug |
| `minPrice` | number | — |
| `maxPrice` | number | — |
| `inStock` | boolean | — |
| `featured` | boolean | — |
| `sort` | enum | `relevance` — `name`, `price`, `createdAt`, `relevance` |
| `order` | enum | `asc` |
| `page` | integer | 1 |
| `limit` | integer | 20 |

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "results": [ { ...Product } ],
    "facets": {
      "categories": [ { "name": "...", "count": 5 } ],
      "priceRanges": [...]
    },
    "pagination": { "total": 100, "page": 1, "limit": 20, "totalPages": 5 }
  }
}
```

---

### `GET /search/suggest`
Autocomplétion de recherche.

**Query params :**
| Param | Type | Requis | Contraintes |
|---|---|---|---|
| `q` | string | oui | min 2 caractères |
| `limit` | integer | non | défaut 10 |

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      { "type": "product", "text": "Laptop Dell", "slug": "laptop-dell" },
      { "type": "category", "text": "Laptops", "slug": "laptops" }
    ]
  }
}
```

---

## Homepage

### `GET /homepage/carousel`
Slides du carrousel actifs.

**Réponse 200 :**
```json
{ "success": true, "data": [ { "id": 1, "title": "...", "imageRef": "...", "link": "...", "displayOrder": 0 } ] }
```

---

### `GET /homepage/config`
Configuration générale de la homepage.

**Réponse 200 :**
```json
{ "success": true, "data": { ...HomepageConfig } }
```

---

### `GET /homepage/featured-products`
Produits mis en avant.

**Query params :** `limit` (integer, défaut 8)

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Product } ] }
```

---

### `GET /homepage/banners`
Banners actifs.

**Query params :** `position` (enum — `TOP`, `MIDDLE`, `BOTTOM`, `SIDEBAR`)

**Réponse 200 :**
```json
{ "success": true, "data": [ { ...Banner } ] }
```

---

### `GET /homepage/admin/carousel` *(Admin)*
**Auth admin requise.**  
Tous les slides (actifs et inactifs).

---

### `POST /homepage/admin/carousel` *(Admin)*
**Auth admin requise.**  
Créer un slide.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `imageRef` | string | oui — référence media |
| `title` | string | non |
| `textContent` | string | non |
| `redirectUrl` | string | non |
| `displayOrder` | integer | non |
| `isActive` | boolean | non — défaut `true` |
| `isMainImage` | boolean | non — défaut `false` |

**Réponse 201 :**
```json
{ "success": true, "data": { ...CarouselSlide } }
```

---

### `PUT /homepage/admin/carousel/:id` *(Admin)*
**Auth admin requise.**  
Modifier un slide. Tous les champs optionnels.

**Path params :** `id` (UUID)

---

### `DELETE /homepage/admin/carousel/:id` *(Admin)*
**Auth admin requise.**  
Supprimer un slide.

**Path params :** `id` (UUID)

**Réponse 200 :**
```json
{ "success": true, "message": "Slide supprimé" }
```

---

### `GET /homepage/admin/banners` *(Admin)*
**Auth admin requise.**  
Tous les banners.

---

### `POST /homepage/admin/banners` *(Admin)*
**Auth admin requise.**  
Créer un banner.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `imageRef` | string | oui |
| `title` | string | non |
| `position` | enum | oui — `TOP`, `MIDDLE`, `BOTTOM`, `SIDEBAR` |
| `redirectUrl` | string | non |
| `isActive` | boolean | non |

---

### `PUT /homepage/admin/banners/:id` *(Admin)*
**Auth admin requise.**  
Modifier un banner.

---

### `DELETE /homepage/admin/banners/:id` *(Admin)*
**Auth admin requise.**  
Supprimer un banner.

---

### `POST /homepage/admin/featured-products` *(Admin)*
**Auth admin requise.**  
Mettre un produit en avant.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `productId` | integer | oui |

---

### `DELETE /homepage/admin/featured-products/:id` *(Admin)*
**Auth admin requise.**  
Retirer un produit mis en avant.

**Path params :** `id` (integer)

---

## Chatbot

### `POST /chatbot/sessions`
Créer une nouvelle session de chatbot.

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `userId` | UUID | non |

**Réponse 201 :**
```json
{ "sessionId": "uuid", "status": "open", "createdAt": "..." }
```

---

### `POST /chatbot/sessions/:sessionId/messages`
Envoyer un message dans une session.

**Path params :** `sessionId` (UUID)

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `message` | string | oui | min 1, max 2000 |
| `sender` | enum | oui | `user`, `bot` |

**Réponse 200 :**
```json
{
  "userMessage": { "id": "uuid", "message": "...", "sender": "user", "timestamp": "..." },
  "botResponse": { "id": "uuid", "message": "...", "sender": "bot", "timestamp": "..." }
}
```

---

### `GET /chatbot/sessions/:sessionId/messages`
Récupérer l'historique d'une session.

**Path params :** `sessionId` (UUID)

**Query params :** `limit` (integer, défaut 50, max 200)

**Réponse 200 :**
```json
{ "sessionId": "uuid", "messages": [...], "totalMessages": 12 }
```

---

### `GET /chatbot/admin/sessions` *(Admin)*
**Auth admin requise.**  
Lister toutes les sessions.

**Query params :**
| Param | Type |
|---|---|
| `status` | enum — `open`, `closed`, `escalated` |
| `userId` | UUID |
| `page` | integer — défaut 1 |
| `limit` | integer — défaut 20, max 100 |

**Réponse 200 :**
```json
{
  "sessions": [ { "sessionId": "...", "status": "open", "messageCount": 8, ... } ],
  "pagination": { "currentPage": 1, "totalPages": 5, "totalSessions": 94 }
}
```

---

### `PUT /chatbot/admin/sessions/:sessionId/escalate` *(Admin)*
**Auth admin requise.**  
Escalader une session vers le support humain.

**Path params :** `sessionId` (UUID)

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `assignedTo` | UUID | non — ID de l'agent |

**Réponse 200 :**
```json
{ "sessionId": "uuid", "status": "escalated", "assignedTo": null, "escalatedAt": "..." }
```

---

## Contact

### `POST /contact/submit`
Soumettre un formulaire de contact. Rate limité.

**Body :**
| Champ | Type | Requis | Contraintes |
|---|---|---|---|
| `name` | string | oui | max 100 |
| `email` | string | oui | format email |
| `phone` | string | non | |
| `subject` | string | oui | max 200 |
| `message` | string | oui | min 10, max 2000 |

**Réponse 201 :**
```json
{
  "success": true,
  "message": "Votre message a été envoyé. Nous vous répondrons dans les plus brefs délais.",
  "data": { "id": 1, "ticketNumber": "CONTACT-2024-00001" }
}
```

**Erreurs :** `429` trop de tentatives

---

### `GET /contact/admin/messages` *(Admin)*
**Auth admin requise.**  
Liste tous les messages de contact.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `status` | enum | — — `NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `search` | string | — |
| `startDate` | date | — |
| `endDate` | date | — |
| `page` | integer | 1 |
| `limit` | integer | 20 |
| `sortBy` | enum | `createdAt` |
| `order` | enum | `desc` |

---

### `GET /contact/admin/messages/:id` *(Admin)*
**Auth admin requise.**  
Détail d'un message.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "ticketNumber": "CONTACT-2024-00001",
    "name": "Jean Dupont",
    "email": "jean@example.com",
    "subject": "...",
    "message": "...",
    "status": "NEW",
    "response": null,
    "respondedAt": null
  }
}
```

---

### `PUT /contact/admin/messages/:id/status` *(Admin)*
**Auth admin requise.**  
Mettre à jour le statut d'un message et optionnellement y répondre.

**Path params :** `id` (integer)

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `status` | enum | oui — `NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |
| `response` | string | non — réponse envoyée au client |
| `notes` | string | non — notes internes |

**Réponse 200 :**
```json
{ "success": true, "message": "Statut du message mis à jour", "data": { ...ContactMessage } }
```

---

### `DELETE /contact/admin/messages/:id` *(Admin)*
**Auth admin requise.**  
Supprimer un message.

**Path params :** `id` (integer)

**Réponse 200 :**
```json
{ "success": true, "message": "Message supprimé avec succès" }
```

---

## Pages légales

### `GET /legal/:type`
Récupérer une page légale.

**Path params :** `type` (enum) — `CGV`, `CGU`, `MENTIONS_LEGALES`, `POLITIQUE_CONFIDENTIALITE`, `COOKIES`

**Réponse 200 :**
```json
{
  "success": true,
  "data": { "type": "CGV", "title": "Conditions Générales de Vente", "content": "...", "version": "1.0", "updatedAt": "..." }
}
```

**Erreurs :** `404` page non trouvée

---

### `GET /legal/admin` *(Admin)*
**Auth admin requise.**  
Liste toutes les pages légales.

---

### `PUT /legal/admin/:type` *(Admin)*
**Auth admin requise.**  
Créer ou mettre à jour une page légale.

**Path params :** `type` (enum)

**Body :**
| Champ | Type | Requis |
|---|---|---|
| `title` | string | oui |
| `content` | string | oui — HTML ou Markdown |
| `version` | string | non |

**Réponse 200 ou 201 :**
```json
{ "success": true, "data": { ...LegalPage } }
```

---

### `GET /legal/admin/:type/history` *(Admin)*
**Auth admin requise.**  
Historique des versions d'une page légale.

**Path params :** `type` (enum)

**Réponse 200 :**
```json
{
  "success": true,
  "data": [ { "version": "1.0", "updatedAt": "...", "updatedBy": { ...User } } ]
}
```

---

## Analytics

### `GET /analytics/admin/overview` *(Admin)*
**Auth admin requise.**  
KPI globaux.

**Query params :** `startDate`, `endDate`, `compareWithPrevious` (boolean, défaut `true`)

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "revenue": { "total": 125000.50, "change": 15.5 },
    "orders": { "total": 458, "change": 12.3 },
    "customers": { "total": 1234, "new": 156, "change": 8.7 },
    "products": { "total": 89, "outOfStock": 5, "lowStock": 12 },
    "averageOrderValue": 273.14,
    "conversionRate": 3.45
  }
}
```

---

### `GET /analytics/admin/sales` *(Admin)*
**Auth admin requise.**  
Analyse des ventes avec timeline.

**Query params :**
| Param | Type | Défaut |
|---|---|---|
| `startDate` | date | — |
| `endDate` | date | — |
| `groupBy` | enum | `day` — `day`, `week`, `month`, `year` |
| `includeRefunds` | boolean | `false` |

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "summary": { "totalRevenue": 125000.50, "totalOrders": 458, "averageOrderValue": 273.14 },
    "timeline": [ { "period": "2024-03-01", "revenue": 4500.00, "orders": 15 } ],
    "topProducts": [ { "productId": 1, "productName": "...", "revenue": 5000.00, "quantitySold": 50 } ]
  }
}
```

---

### `GET /analytics/admin/products` *(Admin)*
**Auth admin requise.**  
Analyse des performances produits.

**Query params :** `startDate`, `endDate`, `limit` (défaut 10), `sortBy` (`revenue`, `quantity`, `views`, `conversionRate`), `categoryId`

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "topSellers": [ { "productId": 1, "name": "...", "revenue": 50000.00, "quantitySold": 500, "conversionRate": 5.0 } ],
    "underperforming": [...],
    "inventory": { "outOfStock": [...], "lowStock": [...] }
  }
}
```

---

### `GET /analytics/admin/customers` *(Admin)*
**Auth admin requise.**  
Analyse des clients.

**Query params :** `startDate`, `endDate`, `limit` (défaut 10), `segment` (`all`, `new`, `returning`, `vip`, `inactive`)

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "summary": { "total": 1234, "new": 156, "returning": 890 },
    "topCustomers": [ { "customerId": 1, "name": "...", "totalSpent": 5000.00, "ordersCount": 10 } ],
    "segments": { "vip": 45, "regular": 567 },
    "retention": { "rate": 68.5, "churnRate": 31.5 }
  }
}
```

---

### `GET /analytics/admin/export` *(Admin)*
**Auth admin requise.**  
Exporter un rapport.

**Query params :**
| Param | Type | Requis | Valeurs |
|---|---|---|---|
| `reportType` | enum | oui | `overview`, `sales`, `products`, `customers` |
| `format` | enum | non | `csv` (défaut), `json`, `xlsx` |
| `startDate` | date | non | |
| `endDate` | date | non | |
| `groupBy` | enum | non | pour `sales` uniquement — `day`, `week`, `month` |

**Réponse 200 :** Fichier CSV, JSON ou XLSX