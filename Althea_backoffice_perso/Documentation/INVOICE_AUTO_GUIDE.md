# Guide — Facturation automatique

## Vue d'ensemble

Chaque commande créée génère automatiquement une facture liée dans la **même transaction PostgreSQL**. Il est donc impossible d'avoir une commande sans facture.

La numérotation suit le format `INV-YYYY-NNNNN` (séquence annuelle continue), calculée dans la transaction avec isolation `Serializable` pour garantir l'unicité sans trou.

---

## Flux automatique (Option A)

### Déclenchement

La facture est créée dans `createOrderFromCart` (`orders.service.ts`), systématiquement, quelle que soit la source de la commande :

| Source | Moment de création |
|---|---|
| Webhook Stripe `payment_intent.succeeded` | Dans la transaction de création de commande |
| `POST /checkout/confirm` (frontend) | Dans la transaction de création de commande |
| Toute autre création via `createOrderFromCart` | Dans la transaction de création de commande |

### Statut initial de la facture

| `paymentStatus` de la commande | `status` de la facture |
|---|---|
| `paid` | `paid` — `paidAt` renseigné |
| `pending` | `pending` — `paidAt` null |

### Annulation

Quand une commande passe à `CANCELLED` (`POST /api/v1/orders/:id/cancel`), la facture associée passe automatiquement à `cancelled` avec `cancelledAt = now()`, dans la même transaction.

---

## Contenu d'une facture

Chaque facture contient des **snapshots figés au moment de la création** — ils ne changent jamais même si le client, l'adresse ou le produit est modifié ultérieurement.

| Champ | Contenu |
|---|---|
| `invoiceNumber` | `INV-YYYY-NNNNN` |
| `status` | `paid` / `pending` / `cancelled` |
| `customerSnapshot` | `firstName`, `lastName`, `email` au moment T |
| `billingAddressSnapshot` | Adresse de facturation complète au moment T |
| `subtotalHt` | Total HT |
| `totalVat` | Total TVA |
| `totalTtc` | Total TTC |
| `issuedAt` | Date d'émission |
| `paidAt` | Date de paiement (null si pending) |
| `cancelledAt` | Date d'annulation (null si non annulée) |

---

## Endpoint admin — Backfill

Pour les commandes existantes créées avant ce système, ou en cas d'incident (webhook raté, migration) :

### Créer une facture manuellement

```
POST /api/v1/invoices/admin/from-order/:orderId
```

**Authentification :** JWT Bearer + rôle admin  
**Body :** aucun (tout est dérivé de la commande)

**Réponses :**

| Code | Cas |
|---|---|
| `201` | Facture créée avec succès |
| `404` | Commande introuvable |
| `409` | Une facture existe déjà pour cette commande |

**Exemple 201 :**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "invoiceNumber": "INV-2026-00042",
    "orderId": "uuid",
    "userId": "uuid",
    "status": "paid"
  }
}
```

**Exemple 409 :**
```json
{
  "message": "Une facture existe déjà pour cette commande",
  "data": { ...facture existante }
}
```

### Récupérer toutes les commandes sans facture (côté front)

Pour identifier les commandes à backfiller, requête admin :

```
GET /api/v1/orders/admin?page=1&limit=100
```

Filtrer côté client les entrées où `invoice` est absent, puis appeler `POST /admin/from-order/:orderId` pour chacune.

---

## Garanties techniques

**Atomicité** — La paire Order + Invoice est créée dans une seule transaction. Si la création de la facture échoue, la commande n'est pas persistée.

**Numérotation continue** — La séquence `INV-YYYY-NNNNN` est calculée dans la transaction avec `isolationLevel: Serializable`. Deux transactions simultanées ne peuvent pas obtenir le même numéro : l'une sera annulée par PostgreSQL et retryée par l'appelant.

**Snapshots immuables** — `customerSnapshot` et `billingAddressSnapshot` sont figés à l'émission. Toute modification ultérieure du client ou de l'adresse n'affecte pas les factures existantes.

**Idempotence du webhook** — Si Stripe rejoue `payment_intent.succeeded`, `createOrderFromCart` détecte la commande existante via `stripePaymentIntentId` et retourne sans créer de doublon.
