# Guide — Afficher et télécharger une facture PDF

## Vue d'ensemble

L'API génère les factures à la volée avec **PDFKit** au format A4. Le PDF est streamé directement dans la réponse HTTP — aucun fichier n'est stocké sur disque.

Le comportement actuel force le téléchargement (`Content-Disposition: attachment`). Ce guide explique comment :
- Télécharger le fichier
- L'afficher en aperçu dans le navigateur (inline)
- L'intégrer comme image dans une interface

---

## Endpoint

```
GET /api/v1/invoices/:id/pdf
```

**Authentification :** JWT Bearer requis  
**Restriction :** l'utilisateur ne peut accéder qu'à **ses propres** factures

**Headers de réponse actuels :**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice-INV-2026-00001.pdf"
```

**Erreurs :**
| Code | Cause |
|------|-------|
| 401 | Token absent ou expiré |
| 403 | La facture appartient à un autre utilisateur |
| 404 | Facture introuvable |

---

## Ce que contient le PDF

Le PDF généré est un A4 avec les éléments suivants :

| Section | Contenu |
|---------|---------|
| En-tête | Logo texte ALTHEA SYSTEMS, adresse, SIRET |
| Titre | "FACTURE" + numéro (`INV-YYYY-NNNNN`) + date d'émission |
| Adresse de facturation | Snapshot de l'adresse au moment de la commande |
| Informations client | Nom, email, numéro de commande |
| Tableau des articles | Désignation, quantité, prix HT, TVA, total TTC |
| Totaux | Sous-total HT, TVA, total TTC |
| Statut de paiement | PAYÉ (vert) ou EN ATTENTE (rouge) + date de paiement |
| Mentions légales | SIRET, TVA intracommunautaire, conditions de paiement |

---

## Cas 1 — Télécharger le fichier

Comportement par défaut. Le navigateur propose une boîte de dialogue de téléchargement.

### Via un lien HTML

```html
<a
  href="/api/v1/invoices/{id}/pdf"
  download="facture.pdf"
>
  Télécharger la facture
</a>
```

> Ce cas ne fonctionne que si le cookie de session est présent. Si l'auth est gérée par token Bearer, utiliser le cas JavaScript ci-dessous.

### Via JavaScript (avec Bearer token)

```typescript
const downloadInvoicePDF = async (invoiceId: string, invoiceNumber: string) => {
  const response = await fetch(`/api/v1/invoices/${invoiceId}/pdf`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Impossible de récupérer la facture');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  // Créer un lien invisible et cliquer dessus
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice-${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Libérer la mémoire
  URL.revokeObjectURL(url);
};
```

---

## Cas 2 — Afficher le PDF en aperçu inline (dans le navigateur)

Le navigateur sait afficher les PDF nativement. Pour afficher le PDF dans la page plutôt que le télécharger, on crée une **Blob URL** et on l'injecte dans un `<iframe>` ou `<embed>`.

### Avec React

```tsx
import { useState, useEffect } from 'react';

const InvoicePreview = ({ invoiceId, accessToken }: { invoiceId: string; accessToken: string }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string;

    const fetchPDF = async () => {
      try {
        const response = await fetch(`/api/v1/invoices/${invoiceId}/pdf`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) throw new Error('Erreur de chargement');

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err) {
        setError('Impossible de charger la facture');
      } finally {
        setLoading(false);
      }
    };

    fetchPDF();

    // Nettoyage : libérer la mémoire quand le composant est démonté
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [invoiceId, accessToken]);

  if (loading) return <p>Chargement de la facture...</p>;
  if (error) return <p>{error}</p>;

  return (
    <iframe
      src={pdfUrl!}
      title="Aperçu facture"
      width="100%"
      height="800px"
      style={{ border: 'none' }}
    />
  );
};
```

### Résultat visuel

```
┌─────────────────────────────────────────┐
│  ALTHEA SYSTEMS          FACTURE        │
│  123 Avenue de la Tech   N° INV-2026-.. │
│  75001 Paris             Date: 22/04/26 │
│─────────────────────────────────────────│
│  FACTURER À :            Client :       │
│  Jean Dupont             Jean Dupont    │
│  12 rue des lilas        jean@mail.com  │
│  75002 Paris             CMD-2026-00042 │
│─────────────────────────────────────────│
│  Article         Qté  HT    TVA  TTC   │
│  Produit A        1   41.67  20%  50€  │
│─────────────────────────────────────────│
│              Sous-total HT :   41.67 €  │
│              TVA :              8.33 €  │
│  ┌─────────────────────────────────┐   │
│  │  TOTAL TTC :          50.00 €   │   │
│  └─────────────────────────────────┘   │
│  Statut : PAYÉ — 22/04/2026            │
└─────────────────────────────────────────┘
```

---

## Cas 3 — Afficher comme image (conversion PDF → image)

Si tu veux afficher la facture comme une image (PNG/JPEG) plutôt qu'un PDF, deux options :

### Option A — PDF.js (rendu côté client, recommandé)

```bash
npm install pdfjs-dist
```

```tsx
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const renderPDFAsImage = async (invoiceId: string, accessToken: string): Promise<string> => {
  // 1. Récupérer le PDF
  const response = await fetch(`/api/v1/invoices/${invoiceId}/pdf`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const arrayBuffer = await response.arrayBuffer();

  // 2. Charger le document PDF
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1); // première page

  // 3. Rendre sur un canvas
  const viewport = page.getViewport({ scale: 2 }); // scale 2 = haute résolution
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: canvas.getContext('2d')!,
    viewport,
  }).promise;

  // 4. Exporter en PNG
  return canvas.toDataURL('image/png');
};

// Usage dans un composant
const InvoiceImage = ({ invoiceId, accessToken }: { invoiceId: string; accessToken: string }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    renderPDFAsImage(invoiceId, accessToken).then(setImgSrc);
  }, [invoiceId]);

  if (!imgSrc) return <p>Génération de l'aperçu...</p>;
  return <img src={imgSrc} alt="Aperçu facture" style={{ width: '100%' }} />;
};
```

### Option B — Conversion côté serveur (si besoin d'une vraie image stockée)

Ajouter un endpoint `GET /api/v1/invoices/:id/image` qui convertit le PDF en PNG via **sharp** ou **puppeteer** côté serveur. Non implémenté actuellement — à faire si besoin (email automatique avec aperçu image, miniature dans les listings, etc.).

---

## Modifier le comportement inline vs téléchargement

Actuellement le header est `attachment` (force téléchargement). Pour afficher directement dans le navigateur sans passer par du JavaScript, changer dans `invoices.controller.ts` :

```typescript
// Téléchargement forcé (actuel)
res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.number}.pdf"`);

// Affichage inline (navigateur décide)
res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.number}.pdf"`);
```

Avec `inline`, un `<a href="...">` ouvre directement le PDF dans un nouvel onglet si le navigateur supporte l'affichage PDF (Chrome, Firefox, Safari — oui. Mobile — variable).

---

## Récapitulatif des approches

| Besoin | Approche | Complexité |
|--------|----------|------------|
| Bouton "Télécharger" | `fetch` → blob → lien auto-cliqué | Faible |
| Aperçu dans la page | `fetch` → blob URL → `<iframe>` | Faible |
| Aperçu image PNG dans la page | `fetch` → PDF.js → canvas → `<img>` | Moyenne |
| Image PNG stockée (email, miniature) | Endpoint serveur + sharp/puppeteer | Haute |
| Ouvrir dans un nouvel onglet | `<a href="..." target="_blank">` + `Content-Disposition: inline` | Très faible |
