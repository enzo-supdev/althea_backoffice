# Althea Systems — Backoffice : documentation projet complète

Document de synthèse recensant **tout ce que l'application peut faire**, module par module.

---

## 1. Présentation générale

**Althea Systems Backoffice** est l'application d'administration de la plateforme e-commerce Althea Systems, spécialisée dans la vente de matériel médical. Elle permet aux administrateurs de piloter l'activité commerciale, le catalogue, les clients, les commandes, la facturation, la relation client et les paramètres de la boutique depuis une interface unique.

### Stack technique

| Domaine | Choix |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript (mode strict) |
| UI | Tailwind CSS |
| Icônes | Lucide React |
| Graphiques | Recharts |
| Formulaires | React Hook Form + Zod |
| HTTP | Axios (intercepteurs, refresh token) |

### Charte visuelle

- Primary (Turquoise) : `#00a8b5` — hover `#33bfc9`
- Background Light : `#d4f4f7`
- Dark Blue : `#003d5c`
- Success : `#10b981` · Warning : `#f59e0b` · Error : `#ef4444`
- Typographies : Poppins SemiBold (titres), Inter Regular (corps)

---

## 2. Authentification et sécurité

### Connexion ([src/app/login/page.tsx](src/app/login/page.tsx))

- Authentification par e-mail / mot de passe via l'API.
- **Accès réservé aux comptes `admin`** : un compte non-admin est déconnecté automatiquement avec un message d'erreur.
- **Double authentification (2FA)** :
  - Déclenchée après le login si le compte a la 2FA activée.
  - Validation d'un code OTP (TOTP/HOTP) avec `challengeId`.
  - Flags stockés en `localStorage` : `TWO_FACTOR_PENDING_KEY`, `TWO_FACTOR_VERIFIED_AT_KEY`.
- Jetons d'accès et de rafraîchissement persistés (`accessToken`, `refreshToken`).
- Gestion globale via `AuthProvider` / `useAuthContext` ([src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)).

### Inscription ([src/app/register/page.tsx](src/app/register/page.tsx))

- Création de compte via le formulaire `RegisterForm`.

### Protection des routes

- `(dashboard)/layout.tsx` vérifie à chaque navigation :
  - utilisateur authentifié,
  - rôle `admin`,
  - absence de challenge 2FA en attente.
- Redirection automatique vers `/login` sinon.
- Indicateur de chargement pendant la vérification des accès.

### Sécurité applicative

- Intercepteur Axios ([src/lib/api/axiosInstance.ts](src/lib/api/axiosInstance.ts)) : injection du token, refresh automatique, gestion des erreurs typées (`ApiError`).
- Helpers : `src/lib/security.ts`, `src/lib/protectedRoute.tsx`, `src/lib/storageManager.ts`.

---

## 3. Structure de navigation

La sidebar ([src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)) donne accès aux 8 modules principaux :

| Module | Route | Description |
| --- | --- | --- |
| Tableau de bord | `/dashboard` | KPIs, graphiques, actions rapides |
| Produits | `/products` | Catalogue, images, CRUD, bulk |
| Catégories | `/categories` | Hiérarchie, ordre, statuts |
| Utilisateurs | `/users` | Comptes clients, accès |
| Commandes | `/orders` | Cycle de vie des ventes |
| Factures | `/invoices` | Facturation, avoirs, PDF |
| Messages | `/messages` | Contact clients + chatbot |
| Paramètres | `/settings` | Société, 2FA, carrousel |

Navigation responsive avec sidebar coulissante sur mobile, header ([src/components/layout/Header.tsx](src/components/layout/Header.tsx)) avec actions contextuelles, et indicateur de progression ([NavigationProgress.tsx](src/components/ui/NavigationProgress.tsx)).

---

## 4. Tableau de bord (`/dashboard`)

Fichier : [src/app/(dashboard)/dashboard/page.tsx](src/app/(dashboard)/dashboard/page.tsx)

### Cartes de statistiques — `StatsCards`

4 indicateurs clés, calculés à partir de `analyticsApi.getOverview()` et `analyticsApi.getSales()` :

1. **CA jour / semaine / mois** avec variation en %
2. **Commandes du jour** avec variation
3. **Alertes stock** (rupture + stock faible) avec badge d'alerte rouge
4. **Messages non traités** avec badge

### Actions rapides — `QuickActions`

Raccourcis directs :
- Nouvelle commande (`/orders/new`)
- Ajouter un produit (`/products/new`)
- Voir les messages (`/messages`)

### Graphiques

- **Ventes par catégorie** (`SalesByCategoryChart`) — camembert/barres
- **Histogramme des ventes** (`SalesHistogram`) — évolution temporelle
- **Panier moyen** (`AverageBasketChart`) — tendance
- **Commandes récentes** (`RecentOrdersPanel`) — panel d'activité

---

## 5. Module Produits (`/products`)

Fichiers : [page.tsx](src/app/(dashboard)/products/page.tsx), [[id]/page.tsx](src/app/(dashboard)/products/[id]/page.tsx), [new/page.tsx](src/app/(dashboard)/products/new/page.tsx)

### Liste et recherche

- Table paginée avec `DataTable` + `Pagination` (pageSize configurable).
- **Recherche full-text** : nom, description, catégorie, prix HT/TTC, TVA, stock, statut, date.
- **Filtres combinés** :
  - Catégorie
  - Statut (`published` / `draft`)
  - Stock (`in-stock` / `low-stock <10` / `out-of-stock`)
  - Date de création (7 / 30 / 90 jours)
- **Tri** sur toutes les colonnes (nom, catégorie, prix HT, TVA, prix TTC, stock, statut, date).
- Badges stock : `Rupture`, `Faible`, `Disponible`.

### CRUD produit

- **Création** (modal ou page `/products/new`) : nom, description, prix HT, TVA (0/5.5/10/20 %), catégorie, stock, statut par défaut `draft`, slug auto-généré.
- **Modification** (modal ou page `/products/[id]`) : tous les champs + statut `published`/`draft`/`archived`.
- **Validation Zod** : TVA restreinte, champs obligatoires, valeurs positives.
- **Suppression unitaire** avec modal de confirmation.
- **Basculement rapide publié/brouillon** directement depuis la ligne.

### Gestion des images — `ProductImageManager` ([src/components/ui/ProductImageManager.tsx](src/components/ui/ProductImageManager.tsx))

- Upload vers l'endpoint média.
- Sélection d'une image principale (`mainImageRef`).
- Réordonnancement et suppression.
- Résolution d'URL via `resolveMediaUrl`.

### Opérations en masse (bulk)

- Sélection multi-lignes (checkbox + indéterminé).
- **Publier / Mettre en brouillon** en lot.
- **Supprimer** la sélection.
- **Changer de catégorie** en lot.
- **Export** de la sélection en **CSV** ou **Excel** (colonnes : id, nom, description, catégorie, prix HT, TVA, prix TTC, stock, statut, date).

### Erreurs

- Toast d'erreur typé via `ApiError`.
- Bouton « Réessayer » en cas d'indisponibilité de l'API.

---

## 6. Module Catégories (`/categories`)

Fichiers : [page.tsx](src/app/(dashboard)/categories/page.tsx), [[id]/page.tsx](src/app/(dashboard)/categories/[id]/page.tsx)

### Gestion

- Liste triable et paginée avec image, ordre d'affichage, nom, slug, description, nombre de produits, statut.
- Recherche sur nom, slug, description.
- Filtre par statut (`active` / `inactive`).

### CRUD catégorie

- Création et édition via modal : nom, description, slug (regex `[a-z0-9-]`), URL image, statut.
- Validation Zod.
- Mapping des erreurs serveur sur les champs (`fieldErrors`).

### Réordonnancement

- Boutons **Monter / Descendre** par ligne (`categoriesApi.move`).
- **Drag & drop** de lignes — ordre mis à jour en lot via `displayOrder`.

### Bulk

- Activation / désactivation en masse.
- Suppression groupée.

---

## 7. Module Utilisateurs (`/users`)

Fichier : [src/app/(dashboard)/users/page.tsx](src/app/(dashboard)/users/page.tsx)

- Liste des comptes avec : nom complet, e-mail, statut (`active`/`inactive`/`pending`), nombre de commandes, chiffre d'affaires généré, date de création, dernière connexion, adresses.
- Recherche, tri, pagination, filtre par statut.
- **Actions administrateur** :
  - Consultation du détail dans un modal.
  - **Réinitialisation du mot de passe** (envoi d'un mail / reset admin) avec confirmation.
  - **Archivage** d'un utilisateur (soft delete) avec confirmation.
  - **Suppression** unitaire ou en lot avec modal de confirmation.
- Persistance via `usersApi.save` pour les mutations groupées.

---

## 8. Module Commandes (`/orders`)

Fichiers : [page.tsx](src/app/(dashboard)/orders/page.tsx), [[id]/page.tsx](src/app/(dashboard)/orders/[id]/page.tsx), [new/page.tsx](src/app/(dashboard)/orders/new/page.tsx)

### Liste

- Tableau paginé : numéro, client, items, total, statut commande, statut paiement, date.
- Recherche (avec initialisation via `?search=` ou `?query=` dans l'URL — pratique pour linker depuis le dashboard).
- Filtres par **statut de commande** (`pending` / `processing` / `completed` / `cancelled`) et **statut de paiement** (`validated` / `pending` / `failed` / `refunded`).
- Tri multi-colonnes.

### Détail commande (`/orders/[id]`)

- Fiche complète : client, adresses de livraison et facturation, items, mode et statut de paiement, total.

### Création (`/orders/new`)

- Formulaire de saisie d'une nouvelle commande (client, produits, quantités).

### Actions

- Suppression unitaire ou en lot avec confirmation.
- Navigation directe vers la fiche détail.

---

## 9. Module Factures (`/invoices`)

Fichier : [src/app/(dashboard)/invoices/page.tsx](src/app/(dashboard)/invoices/page.tsx)

- Liste des factures avec numéro, commande associée, client, montant, statut (`paid` / `pending` / `cancelled`), date d'émission.
- Recherche, tri, pagination.

### Fonctionnalités

- **Édition de facture** via modal : numéro, montant, date d'émission, statut (validation Zod).
- **Téléchargement PDF** avec logo Althea (`AltheaLogo.png`) et ligne d'items.
- **Envoi par e-mail** au client.
- **Avoirs (Credit Notes)** :
  - Génération d'avoir à partir d'une facture.
  - Numérotation dédiée, raison, montant.
  - Persistance locale (`althea.ui.credit-notes` en `localStorage`).
- Suppression unitaire ou en lot.

---

## 10. Module Messages (`/messages`)

Fichier : [src/app/(dashboard)/messages/page.tsx](src/app/(dashboard)/messages/page.tsx)

Centralise deux canaux de relation client :

### Messages de contact

- Liste paginée des messages entrants (API `messagesApi.listContactMessages`).
- Statuts : `unread` / `read` / `replied` / `closed`.
- Recherche et filtre par statut.
- **Marquer lu / non lu**.
- **Répondre** : éditeur validé (Zod, 1–2000 caractères), historique des réponses affiché.
- Vue détail avec l'intégralité du fil.

### Conversations Chatbot

- Liste des conversations issues de `chatbotApi`.
- Statuts : `open` / `resolved` / `escalated`.
- Affichage de l'historique complet (`user` / `bot`).
- Actions : escalade vers support humain, résolution, assignation.

---

## 11. Module Paramètres (`/settings`)

Fichier : [src/app/(dashboard)/settings/page.tsx](src/app/(dashboard)/settings/page.tsx)

### Informations société

- Nom de la société, e-mail support, téléphone support, adresse de facturation.
- Validation Zod, persistance locale (`althea_backoffice_settings_v1`).

### Notifications

- Toggles : alertes commandes, alertes stock, alertes support.

### Sécurité

- Alertes de connexion (on/off).
- **Session timeout** paramétrable (5 à 180 minutes).
- **Changement de mot de passe** (modal) : mot de passe actuel + nouveau (min 8 car.) + confirmation.
- **Activation / désactivation 2FA** :
  - Méthodes : `totp` ou `hotp`.
  - URI de provisionnement pour scanner QR code.
  - Compteur de codes de récupération.

### Carrousel d'accueil du site vitrine

- Liste des slides (`homepageApi`) avec image, titre, URL de redirection, texte, ordre d'affichage, flag "image principale", statut actif.
- Ajout, édition, suppression de slides.
- **Upload d'image** via `mediaApi` (résolution par `imageRef`).
- **Réordonnancement par drag & drop**.
- Activation / désactivation par slide.

---

## 12. Couche API (`src/lib/api`)

Architecture modulaire, une API par domaine métier :

| Fichier | Responsabilité |
| --- | --- |
| `axiosInstance.ts` | Instance Axios, intercepteurs, refresh token |
| `core.ts` | Helpers (wrappers, extraction d'erreurs) |
| `types.ts` | Types partagés + classe `ApiError` (code, message, fieldErrors) |
| `authApi.ts` | login, logout, register, verifyTwoFactor, refresh |
| `productsApi.ts` | CRUD, bulk (status/category/delete), média |
| `categoriesApi.ts` | CRUD, move, update status, reorder |
| `usersApi.ts` | list, save, reset, archive, delete |
| `ordersApi.ts` | list, save, detail, create, delete |
| `invoicesApi.ts` | list, update, pdf, email, credit notes |
| `messagesApi.ts` | list, reply, mark as read, close |
| `chatbotApi.ts` | conversations, escalate, resolve |
| `mediaApi.ts` | upload, resolveMediaUrl |
| `analyticsApi.ts` | overview, sales timeline |
| `homepageApi.ts` | slides carrousel |
| `cartApi.ts`, `checkoutApi.ts`, `searchApi.ts`, `legalApi.ts` | front public/légal (exposés pour cohérence) |

Gestion d'erreurs uniforme : toutes les API lèvent `ApiError` avec `code`, `message`, `fieldErrors?`.

---

## 13. Composants réutilisables

### UI transverses ([src/components/ui/](src/components/ui/))

- `DataTable` — table générique typée avec tri, sélection, états de chargement.
- `Pagination` — pagination avec `pageSize` configurable.
- `SearchBar` — recherche accessible (`aria-label`).
- `Badge` — variantes `success`, `warning`, `error`, `default`.
- `Modal` — tailles `md`, `lg` ; focus trap, close sur Échap.
- `ToastProvider` + `useToast` — notifications `success`, `error`, `info`.
- `NavigationProgress` — barre de progression lors des navigations.
- `ProductImageManager` — gestionnaire d'images produit.
- `form/FormField`, `form/FormActions`, `form/FormError` — blocs de formulaire cohérents.

### Layout ([src/components/layout/](src/components/layout/))

- `Sidebar` — navigation principale responsive.
- `Header` — barre supérieure avec ouverture sidebar mobile.
- `PageHeader` — en-tête de page (eyebrow, titre, description, actions).

### Dashboard ([src/components/dashboard/](src/components/dashboard/))

- `StatsCards`, `QuickActions`, `SalesByCategoryChart`, `SalesHistogram`, `AverageBasketChart`, `RecentOrdersPanel`.

### Auth ([src/components/auth/](src/components/auth/))

- `LoginForm` (avec flux 2FA), `RegisterForm`.

---

## 14. Hooks et contexts

- [`useAuth`](src/hooks/useAuth.ts) — logique d'authentification (login, register, logout, refresh).
- [`useApi`](src/hooks/useApi.ts), [`useApiWithError`](src/hooks/useApiWithError.ts) — wrappers pour les appels API avec gestion d'état.
- [`AuthContext`](src/contexts/AuthContext.tsx) — provider global.

---

## 15. Types métier ([src/types/index.ts](src/types/index.ts))

Contrats TypeScript stricts : `Product`, `ProductImage`, `Category`, `User`, `Address`, `Order`, `OrderItem`, `Invoice`, `Message`, `MessageReply`, `Stats`.

---

## 16. Export de données

- **Produits** : export CSV et Excel de la sélection depuis la liste.
- **Factures** : téléchargement PDF unitaire avec logo.
- **Avoirs** : génération PDF.

---

## 17. Expérience utilisateur

- Interface 100 % responsive (sidebar coulissante mobile, grilles adaptatives).
- Skeletons de chargement sur les listes.
- États d'erreur avec bouton « Réessayer ».
- Confirmation obligatoire sur toutes les actions destructrices.
- Toasts contextuels sur toutes les mutations.
- Validation côté client (Zod) **et** remontée des erreurs serveur sur les champs concernés.
- Accessibilité : `aria-label`, `role="alert"`, `aria-live`, focus management dans les modals.

---

## 18. Installation et lancement

```bash
npm install          # installation des dépendances
npm run dev          # serveur de développement (http://localhost:3000)
npm run build        # build production
npm run start        # lancement production
npm run lint         # linter Next
npm run clean        # purge .next et .turbo
npm run dev:clean    # clean + dev
npm run build:clean  # clean + build
```

---

## 19. Documentation complémentaire

Dossier [Documentation/](Documentation/) :

- [API_ENDPOINTS.md](Documentation/API_ENDPOINTS.md) — liste des endpoints consommés.
- [API_INTEGRATION_GUIDE.md](Documentation/API_INTEGRATION_GUIDE.md) — guide d'intégration.
- [WORKFLOW_PRODUIT_IMAGE.md](Documentation/WORKFLOW_PRODUIT_IMAGE.md) — cycle de vie des images produit.
- [STRUCTURE.md](Documentation/STRUCTURE.md) — arborescence détaillée.
- [AUDIT_CHECKLIST_BACKOFFICE.md](Documentation/AUDIT_CHECKLIST_BACKOFFICE.md) / [CHECKLIST_AUDIT_BACKOFFICE.md](Documentation/CHECKLIST_AUDIT_BACKOFFICE.md) — conformité.
- [IMPLEMENTATION_PLAN.md](Documentation/IMPLEMENTATION_PLAN.md) — plan d'implémentation.
- [cahier-des-charges-althea-systems.md](Documentation/cahier-des-charges-althea-systems.md) — spécifications.
- [backoffice-althea-systems.md](Documentation/backoffice-althea-systems.md) — specs backoffice.
- [FRONT_100_AVANT_API.md](Documentation/FRONT_100_AVANT_API.md) — état du front.
- Collection Postman : [postman/althea-api.postman_collection.json](postman/althea-api.postman_collection.json).
