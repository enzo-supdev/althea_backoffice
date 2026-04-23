# Guide — Intégration des factures côté Front-Office

Destiné à l'équipe front-office (site client) pour afficher, télécharger et prévisualiser les factures de l'utilisateur connecté.

**Base URL :** `https://api-pslt.matheovieilleville.fr/api/v1`
**Authentification :** JWT Bearer token obligatoire sur tous les endpoints
```
Authorization: Bearer <accessToken>
```

---

## 1. Endpoints disponibles côté client

| Méthode | Route | Usage |
|---|---|---|
| GET | `/users/me/invoices` | Liste paginée des factures de l'utilisateur connecté |
| GET | `/invoices/me` | Alias équivalent de la route ci-dessus |
| GET | `/invoices/:id` | Détail d'une facture (propriétaire uniquement) |
| GET | `/invoices/:id/pdf` | Flux PDF binaire de la facture |

> Les routes `/invoices/admin/*` sont réservées au back-office — **ne pas les appeler** depuis le site client.

---

## 2. Lister les factures d'un utilisateur

### Requête

```
GET /api/v1/users/me/invoices?page=1&limit=10
Authorization: Bearer <accessToken>
```

**Query params :**
| Param | Type | Défaut | Notes |
|---|---|---|---|
| `page` | integer | `1` | |
| `limit` | integer | `10` | max conseillé `50` |
| `status` | enum | — | `pending`, `paid`, `cancelled`, `refunded` |
| `startDate` | ISO date | — | filtre sur `issuedAt` |
| `endDate` | ISO date | — | filtre sur `issuedAt` |

### Réponse 200

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "invoiceNumber": "INV-2026-00042",
      "orderId": "uuid",
      "userId": "uuid",
      "status": "paid",
      "subtotalHt": 290.83,
      "totalVat": 58.16,
      "totalTtc": 348.99,
      "issuedAt": "2026-04-23T10:48:00.000Z",
      "paidAt": "2026-04-23T10:48:30.000Z",
      "cancelledAt": null,
      "customerSnapshot": {
        "firstName": "Alice",
        "lastName": "Martin",
        "email": "alice@example.com"
      },
      "billingAddressSnapshot": {
        "address1": "12 rue des Lilas",
        "city": "Paris",
        "postalCode": "75002",
        "country": "FR"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 12,
    "totalPages": 2
  }
}
```

### Exemple React + fetch

```tsx
import { useEffect, useState } from 'react';

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  totalTtc: number;
  issuedAt: string;
};

function useMyInvoices(accessToken: string, page = 1, limit = 10) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchInvoices = async () => {
      try {
        const res = await fetch(
          `/api/v1/users/me/invoices?page=${page}&limit=${limit}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!cancelled) setInvoices(body.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchInvoices();
    return () => {
      cancelled = true;
    };
  }, [accessToken, page, limit]);

  return { invoices, loading, error };
}
```

---

## 3. Détail d'une facture

### Requête

```
GET /api/v1/invoices/:id
Authorization: Bearer <accessToken>
```

### Réponse 200 (complète)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "invoiceNumber": "INV-2026-00042",
    "orderId": "uuid",
    "userId": "uuid",
    "status": "paid",

    "subtotalHt": 290.83,
    "totalVat": 58.16,
    "totalTtc": 348.99,

    "issuedAt": "2026-04-23T10:48:00.000Z",
    "dueAt": "2026-05-23T10:48:00.000Z",
    "paidAt": "2026-04-23T10:48:30.000Z",
    "cancelledAt": null,

    "customerSnapshot": {
      "firstName": "Alice",
      "lastName": "Martin",
      "email": "alice@example.com"
    },

    "billingAddressSnapshot": {
      "firstName": "Alice",
      "lastName": "Martin",
      "address1": "12 rue des Lilas",
      "address2": "Apt 3B",
      "city": "Paris",
      "postalCode": "75002",
      "region": "Île-de-France",
      "country": "FR",
      "phone": "+33 6 12 34 56 78"
    },

    "items": [
      {
        "id": "uuid-item-1",
        "productId": "uuid-product-1",
        "productName": "Produit A",
        "quantity": 2,
        "priceHt": 41.67,
        "vatRate": 0.2,
        "priceTtc": 50.00
      },
      {
        "id": "uuid-item-2",
        "productId": "uuid-product-2",
        "productName": "Produit B",
        "quantity": 1,
        "priceHt": 207.49,
        "vatRate": 0.2,
        "priceTtc": 248.99
      }
    ],

    "order": {
      "id": "uuid",
      "orderNumber": "ORD-2026-000042",
      "status": "completed",
      "shippingCost": 5.99,
      "shippingMethod": "STANDARD"
    },

    "createdAt": "2026-04-23T10:48:00.000Z",
    "updatedAt": "2026-04-23T10:48:30.000Z"
  }
}
```

### Structure des articles (`items`)

Chaque entrée du tableau `items` correspond à une ligne d'article de la commande :

| Champ | Type | Description |
|---|---|---|
| `id` | string (uuid) | Identifiant unique de la ligne |
| `productId` | string (uuid) | Référence au produit |
| `productName` | string | **Snapshot du nom** au moment de la facturation (reste figé même si le produit est renommé ensuite) |
| `quantity` | integer | Quantité commandée |
| `priceHt` | number | Prix unitaire HT |
| `vatRate` | number | Taux de TVA (ex: `0.2` pour 20%) |
| `priceTtc` | number | Prix unitaire TTC |

**Calculs utiles côté client :**
```ts
// Total ligne HT
const lineTotalHt = item.priceHt * item.quantity;

// Montant de TVA de la ligne
const lineVat = lineTotalHt * item.vatRate;

// Total ligne TTC (à afficher au client)
const lineTotalTtc = item.priceTtc * item.quantity;

// Pourcentage de TVA pour l'affichage
const vatPercent = `${(item.vatRate * 100).toFixed(0)}%`;
```

### Structure des snapshots

**`customerSnapshot`** : nom et email du client **figés au moment de l'émission**. Ne jamais utiliser `user.firstName` (qui pourrait avoir changé) — toujours lire depuis ce snapshot pour respecter la valeur légale de la facture.

**`billingAddressSnapshot`** : adresse de facturation complète, également figée. Utile pour le bloc "Facturer à" dans l'UI et sur le PDF.

### Erreurs

| Code | Cause |
|---|---|
| `401` | Token absent ou expiré |
| `403` | La facture appartient à un autre utilisateur |
| `404` | Facture introuvable |

---

## 4. Télécharger le PDF

### Endpoint

```
GET /api/v1/invoices/:id/pdf
Authorization: Bearer <accessToken>
```

**Réponse 200 :** flux binaire `application/pdf` (streamé, pas stocké sur disque)

Le PDF est généré à la volée avec **PDFKit** côté serveur, au format A4. Il contient : en-tête ALTHEA, numéro de facture, date, adresse de facturation figée, infos client, tableau des articles, totaux HT/TVA/TTC, statut de paiement, mentions légales.

### Cas 1 — Bouton "Télécharger"

```tsx
const downloadInvoice = async (invoiceId: string, invoiceNumber: string, accessToken: string) => {
  const res = await fetch(`/api/v1/invoices/${invoiceId}/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Téléchargement impossible (HTTP ${res.status})`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoiceNumber.toLowerCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
```

### Cas 2 — Aperçu inline dans un iframe

```tsx
import { useEffect, useState } from 'react';

function InvoicePreview({ invoiceId, accessToken }: { invoiceId: string; accessToken: string }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string;

    const loadPdf = async () => {
      const res = await fetch(`/api/v1/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    };

    void loadPdf();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoiceId, accessToken]);

  if (!pdfUrl) return <p>Chargement...</p>;

  return (
    <iframe
      src={pdfUrl}
      title="Aperçu facture"
      width="100%"
      height="800px"
      style={{ border: 'none' }}
    />
  );
}
```

### Cas 3 — Ouvrir dans un nouvel onglet

Simple si le navigateur a déjà la session/token (ex: cookie). Sinon passer par la méthode blob ci-dessus.

```tsx
<a
  href={`/api/v1/invoices/${invoiceId}/pdf`}
  target="_blank"
  rel="noopener noreferrer"
>
  Ouvrir la facture
</a>
```

---

## 5. Statuts de facture — affichage

| Statut backend | Libellé client | Couleur suggérée |
|---|---|---|
| `paid` | Payée | Vert |
| `pending` | En attente | Orange |
| `cancelled` | Annulée | Rouge |
| `refunded` | Remboursée | Gris |

```tsx
const statusLabels = {
  paid: { label: 'Payée', color: 'text-green-600 bg-green-100' },
  pending: { label: 'En attente', color: 'text-orange-600 bg-orange-100' },
  cancelled: { label: 'Annulée', color: 'text-red-600 bg-red-100' },
  refunded: { label: 'Remboursée', color: 'text-gray-600 bg-gray-100' },
};
```

---

## 6. Flux recommandé — page "Mes factures"

1. **Page liste** : appelle `GET /users/me/invoices?page=1&limit=10`
   - Affiche tableau : numéro, date, montant TTC, statut, actions
   - Actions par ligne : bouton "Télécharger PDF" + bouton "Voir le détail"
2. **Page détail** : appelle `GET /invoices/:id`
   - Affiche les infos de la facture + liste des articles
   - Intègre un iframe avec l'aperçu PDF
   - Bouton "Télécharger PDF"
3. **Pagination** : utiliser `meta.totalPages` pour le composant de pagination

---

## 7. Bonnes pratiques

- **Toujours libérer les blob URLs** via `URL.revokeObjectURL(url)` après usage pour éviter les fuites mémoire.
- **Token expiré** : le backend répond `401`. Intercepter et rediriger vers la page de login (ou tenter un refresh token via `POST /auth/refresh-token`).
- **Cache** : les montants et snapshots d'une facture ne changent **jamais** une fois émise → cache agressif possible côté client (ex: React Query avec `staleTime: Infinity` sur le détail).
- **Sécurité** : ne jamais exposer l'ID d'une facture sans vérifier que l'utilisateur est bien propriétaire — le backend le vérifie (403 sinon), mais masquer les liens non-autorisés côté UI améliore l'UX.
- **Mobile** : certains navigateurs mobiles ne supportent pas l'affichage PDF dans un iframe. Fallback conseillé : bouton "Télécharger" direct.

---

## 8. Points de vigilance — montants

Les factures contiennent **trois montants distincts** :

| Champ | Description |
|---|---|
| `subtotalHt` | Total Hors Taxes |
| `totalVat` | Montant total de la TVA |
| `totalTtc` | **Montant final à afficher au client (HT + TVA)** |

Pour l'affichage client, utiliser exclusivement `totalTtc`. Les autres valeurs sont utiles sur la page détail ou le PDF.

---

## 9. Exemple complet — page "Mes factures"

```tsx
'use client';

import { useState, useEffect } from 'react';

type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  status: 'paid' | 'pending' | 'cancelled' | 'refunded';
  totalTtc: number;
  issuedAt: string;
};

export default function MyInvoicesPage({ accessToken }: { accessToken: string }) {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/users/me/invoices?page=1&limit=20', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((body) => setInvoices(body.data ?? []))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const downloadPdf = async (inv: InvoiceListItem) => {
    const res = await fetch(`/api/v1/invoices/${inv.id}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${inv.invoiceNumber.toLowerCase()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p>Chargement...</p>;

  return (
    <div>
      <h1>Mes factures</h1>
      <table>
        <thead>
          <tr>
            <th>Numéro</th>
            <th>Date</th>
            <th>Montant TTC</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td>
                <a href={`/mes-factures/${inv.id}`}>{inv.invoiceNumber}</a>
              </td>
              <td>{new Date(inv.issuedAt).toLocaleDateString('fr-FR')}</td>
              <td>{inv.totalTtc.toFixed(2)} €</td>
              <td>{inv.status}</td>
              <td>
                <button onClick={() => downloadPdf(inv)}>PDF</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 10. Exemple complet — page détail facture (articles, adresse, totaux)

```tsx
'use client';

import { useEffect, useState } from 'react';

type InvoiceItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  priceHt: number;
  vatRate: number;
  priceTtc: number;
};

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  orderId: string;
  status: 'paid' | 'pending' | 'cancelled' | 'refunded';
  subtotalHt: number;
  totalVat: number;
  totalTtc: number;
  issuedAt: string;
  paidAt: string | null;
  items: InvoiceItem[];
  customerSnapshot: { firstName: string; lastName: string; email: string };
  billingAddressSnapshot: {
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    postalCode: string;
    region?: string;
    country: string;
    phone?: string;
  };
  order?: { orderNumber: string };
};

const formatPrice = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const statusLabels: Record<InvoiceDetail['status'], { label: string; className: string }> = {
  paid: { label: 'Payée', className: 'badge-green' },
  pending: { label: 'En attente', className: 'badge-orange' },
  cancelled: { label: 'Annulée', className: 'badge-red' },
  refunded: { label: 'Remboursée', className: 'badge-gray' },
};

export default function InvoiceDetailPage({
  invoiceId,
  accessToken,
}: {
  invoiceId: string;
  accessToken: string;
}) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Récupère le détail de la facture
  useEffect(() => {
    fetch(`/api/v1/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((body) => setInvoice(body.data))
      .finally(() => setLoading(false));
  }, [invoiceId, accessToken]);

  // 2. Récupère le PDF en parallèle pour l'aperçu inline
  useEffect(() => {
    let objectUrl: string;
    fetch(`/api/v1/invoices/${invoiceId}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoiceId, accessToken]);

  const downloadPdf = async () => {
    if (!invoice) return;
    const res = await fetch(`/api/v1/invoices/${invoice.id}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${invoice.invoiceNumber.toLowerCase()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p>Chargement...</p>;
  if (!invoice) return <p>Facture introuvable.</p>;

  const status = statusLabels[invoice.status];

  return (
    <div className="invoice-detail">
      {/* --- En-tête --- */}
      <header className="invoice-header">
        <div>
          <h1>Facture {invoice.invoiceNumber}</h1>
          <p>Émise le {new Date(invoice.issuedAt).toLocaleDateString('fr-FR')}</p>
          {invoice.order && <p>Commande : {invoice.order.orderNumber}</p>}
        </div>
        <div>
          <span className={status.className}>{status.label}</span>
          {invoice.paidAt && (
            <p>Payée le {new Date(invoice.paidAt).toLocaleDateString('fr-FR')}</p>
          )}
          <button onClick={downloadPdf}>Télécharger le PDF</button>
        </div>
      </header>

      {/* --- Bloc facturer à --- */}
      <section className="invoice-billing">
        <h2>Facturer à</h2>
        <p>
          {invoice.customerSnapshot.firstName} {invoice.customerSnapshot.lastName}
          <br />
          {invoice.customerSnapshot.email}
        </p>
        <address>
          {invoice.billingAddressSnapshot.address1}
          {invoice.billingAddressSnapshot.address2 && (
            <>
              <br />
              {invoice.billingAddressSnapshot.address2}
            </>
          )}
          <br />
          {invoice.billingAddressSnapshot.postalCode} {invoice.billingAddressSnapshot.city}
          <br />
          {invoice.billingAddressSnapshot.country}
          {invoice.billingAddressSnapshot.phone && (
            <>
              <br />
              Tél : {invoice.billingAddressSnapshot.phone}
            </>
          )}
        </address>
      </section>

      {/* --- Tableau des articles --- */}
      <section className="invoice-items">
        <h2>Articles</h2>
        <table>
          <thead>
            <tr>
              <th>Désignation</th>
              <th>Qté</th>
              <th>PU HT</th>
              <th>TVA</th>
              <th>PU TTC</th>
              <th>Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productName}</td>
                <td>{item.quantity}</td>
                <td>{formatPrice(item.priceHt)}</td>
                <td>{(item.vatRate * 100).toFixed(0)}%</td>
                <td>{formatPrice(item.priceTtc)}</td>
                <td>{formatPrice(item.priceTtc * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* --- Totaux --- */}
      <section className="invoice-totals">
        <dl>
          <dt>Sous-total HT</dt>
          <dd>{formatPrice(invoice.subtotalHt)}</dd>

          <dt>TVA</dt>
          <dd>{formatPrice(invoice.totalVat)}</dd>

          <dt className="total">Total TTC</dt>
          <dd className="total">{formatPrice(invoice.totalTtc)}</dd>
        </dl>
      </section>

      {/* --- Aperçu PDF --- */}
      {pdfUrl && (
        <section className="invoice-preview">
          <h2>Aperçu</h2>
          <iframe
            src={pdfUrl}
            title={`Aperçu ${invoice.invoiceNumber}`}
            width="100%"
            height="600"
          />
        </section>
      )}
    </div>
  );
}
```

### Rendu visuel attendu

```
┌────────────────────────────────────────────────┐
│ Facture INV-2026-00042              [Payée]   │
│ Émise le 23/04/2026                           │
│ Commande : ORD-2026-000042         [Télécharger] │
│────────────────────────────────────────────────│
│ FACTURER À                                     │
│   Alice Martin                                 │
│   alice@example.com                            │
│   12 rue des Lilas, Apt 3B                     │
│   75002 Paris                                  │
│   FR — +33 6 12 34 56 78                       │
│────────────────────────────────────────────────│
│ ARTICLES                                       │
│ Désignation   Qté  PU HT  TVA  PU TTC  Total   │
│ Produit A      2  41.67€  20%  50.00€  100.00€ │
│ Produit B      1 207.49€  20% 248.99€  248.99€ │
│────────────────────────────────────────────────│
│                Sous-total HT :        290.83 € │
│                         TVA :          58.16 € │
│                  Total TTC :          348.99 € │
└────────────────────────────────────────────────┘
```

---

## 11. Références internes

- Format et contenu du PDF : [INVOICE_PDF_GUIDE.md](./INVOICE_PDF_GUIDE.md)
- Création automatique côté backend : [INVOICE_AUTO_GUIDE.md](./INVOICE_AUTO_GUIDE.md)
- Référence complète API : [API_ENDPOINTS.md](./API_ENDPOINTS.md) — section *Factures*

Pour toute question sur le format de réponse ou les champs exacts, inspecter une réponse réelle via l'onglet Network du navigateur ou via `curl` avec un token admin.
