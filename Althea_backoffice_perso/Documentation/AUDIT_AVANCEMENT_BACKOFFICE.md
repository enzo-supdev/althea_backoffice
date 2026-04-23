# Audit d'avancement — Backoffice Althea Systems

> **Date de l'audit** : 22 avril 2026
> **Périmètre** : Backoffice uniquement (section 7 du cahier des charges + exigences transverses applicables)
> **Référence** : [cahier-des-charges-althea-systems.md](cahier-des-charges-althea-systems.md)
> **Méthode** : lecture du code actuel sur `main`, comparaison point par point avec la spec.

---

## 1. Résumé exécutif

### Couverture fonctionnelle (UI + API)

| Domaine | Couverture | État |
| --- | --- | --- |
| Tableau de bord | 100% | Conforme |
| Gestion des produits | 95% | Conforme — 1 point à finaliser (carrousel images produit) |
| Gestion des catégories | 95% | Conforme — drag & drop à vérifier visuellement |
| Gestion des utilisateurs | 100% | Conforme |
| Gestion des commandes | 100% | Conforme |
| Gestion des factures & avoirs | 85% | PDF avoir généré côté client, à migrer serveur |
| Messages & chatbot | 100% | Conforme |
| Accès & sécurité (2FA, admin-only) | 90% | 2FA branché, audit sécurité à formaliser |

### Couverture transverse (non-fonctionnelle)

| Domaine | État | Commentaire |
| --- | --- | --- |
| Connexion backend réelle | ✅ 100% | `https://api-pslt.matheovieilleville.fr/api/v1` — axios + refresh token |
| Auth JWT + 2FA | ✅ | `LoginForm` gère le challenge 2FA, rôle `admin` vérifié côté client |
| i18n (backoffice EN) | ❌ 0% | Tout le texte est en FR, aucune librairie i18n installée |
| a11y WCAG 2.1 | ⚠️ Partielle | `aria-label` et focus rings présents, mais pas d'audit formalisé |
| Tests automatisés (unitaires / intégration / e2e) | ❌ 0% | Aucun framework installé (Jest/RTL/Playwright absents du `package.json`) |
| Documentation API (Swagger/Postman) | ✅ | `postman/althea-api.postman_collection.json` + `API_ENDPOINTS.md` présents |
| DCT (architecture, diagrammes) | ⚠️ Partiel | `STRUCTURE.md` + `PROJET_COMPLET.md` présents, diagrammes manquants |
| Git / suivi versions | ⚠️ | Seulement 2 commits sur `main`, nombreux fichiers modifiés non committés |

### Progression globale estimée

**≈ 80%** sur le périmètre backoffice exigé par le cahier des charges.
Le delta restant est principalement : tests automatisés, i18n anglais, audit a11y formel, PDF avoirs serveur, et finalisation DCT.

---

## 2. Stack confirmée

| Domaine | Choix |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript strict |
| UI | Tailwind CSS |
| Icônes | Lucide React |
| Graphiques | Recharts |
| Formulaires | React Hook Form + Zod |
| HTTP | Axios (intercepteurs + refresh token + 2FA) |
| Auth | JWT + `refresh-token` + 2FA OTP |
| Backend | API externe `api-pslt.matheovieilleville.fr` (hors de ce repo) |

---

## 3. Audit détaillé vs cahier des charges (§ 7 Backoffice)

### 3.1 Accès et sécurité (§ 7.0)

| Exigence | Statut | Preuve |
| --- | --- | --- |
| Réservé aux administrateurs | ✅ | [src/components/auth/LoginForm.tsx:32-36](src/components/auth/LoginForm.tsx#L32-L36) — redirection si `role !== 'admin'` |
| Authentification forte (2FA) | ✅ | [src/components/auth/LoginForm.tsx:60-95](src/components/auth/LoginForm.tsx#L60-L95) — challenge OTP 6 chiffres |
| Refresh token automatique | ✅ | [src/lib/api/axiosInstance.ts:99-152](src/lib/api/axiosInstance.ts#L99-L152) |
| Route protégée côté frontend | ✅ | `src/lib/protectedRoute.tsx` |
| Validation backend formelle (tests de sécurité) | ❌ | À documenter dans le DCT (plan sécurité) |

---

### 3.2 Tableau de bord (§ 7.1)

| Exigence | Statut | Preuve |
| --- | --- | --- |
| Cards CA jour / semaine / mois | ✅ | [src/components/dashboard/StatsCards.tsx](src/components/dashboard/StatsCards.tsx) |
| Card commandes du jour | ✅ | idem |
| Card alertes stock (badge rouge si > 0) | ✅ | idem |
| Card messages non traités (badge) | ✅ | idem |
| Camembert ventes par catégorie (7j / 5 sem) | ✅ | [src/components/dashboard/SalesByCategoryChart.tsx](src/components/dashboard/SalesByCategoryChart.tsx) |
| Montant € au survol | ✅ | idem |
| Histogramme ventes par jour (7j / 5 sem) | ✅ | [src/components/dashboard/SalesHistogram.tsx](src/components/dashboard/SalesHistogram.tsx) |
| Paniers moyens par catégorie (multi-couches) | ✅ | [src/components/dashboard/AverageBasketChart.tsx](src/components/dashboard/AverageBasketChart.tsx) |
| Actions rapides (nouvelle commande, ajouter produit, voir messages) | ✅ | [src/components/dashboard/QuickActions.tsx](src/components/dashboard/QuickActions.tsx) |
| Connexion API réelle | ✅ | `analyticsApi` branchée |

**Statut : Conforme.**

---

### 3.3 Gestion des produits (§ 7.2)

| Exigence | Statut | Preuve |
| --- | --- | --- |
| Liste tableau avec colonnes complètes (image, nom, desc, catégorie, prix HT, TVA, TTC, stock, statut, date) | ✅ | [src/app/(dashboard)/products/page.tsx](src/app/(dashboard)/products/page.tsx) |
| Tri par colonne (↑↓) | ✅ | idem |
| Recherche globale | ✅ | idem |
| Filtres (catégorie, statut, stock, date) | ✅ | idem |
| Pagination (25/50/100) | ✅ | idem |
| Sélection TVA (20%, 10%, 5.5%, 0%) | ✅ | Schéma Zod `baseProductFormSchema` |
| Calcul TTC automatique | ✅ | idem |
| Actions groupées (suppr., publier/dépublier, changer catégorie, export) | ✅ | idem |
| Export CSV/Excel | ✅ | [src/components/ui/ExportButton.tsx](src/components/ui/ExportButton.tsx) |
| Actions par produit (voir, éditer, suppr., créer) | ✅ | idem + [src/app/(dashboard)/products/[id]/page.tsx](src/app/(dashboard)/products/[id]/page.tsx) + [src/app/(dashboard)/products/new/page.tsx](src/app/(dashboard)/products/new/page.tsx) |
| Slug SEO auto | ✅ | fonction `toSlug` |
| Gestion images produit | ✅ | [src/components/ui/ProductImageManager.tsx](src/components/ui/ProductImageManager.tsx) |
| **Carrousel accueil (3 slides max, drag & drop, image principale, texte formaté, lien)** | ⚠️ | Géré dans [src/app/(dashboard)/settings/page.tsx](src/app/(dashboard)/settings/page.tsx) via `homepageApi` — **la spec le rattache à la gestion produit, placement OK mais éditeur de texte formaté (gras/italique/liens/couleurs) à confirmer** |

**Statut : Conforme à 95%.** Le seul point non-conforme strict est l'éditeur de texte riche pour les slides du carrousel d'accueil (actuellement textarea simple).

---

### 3.4 Gestion des catégories (§ 7.3)

| Exigence | Statut | Preuve |
| --- | --- | --- |
| Liste tableau (image, nom, desc, nb produits, ordre, statut) | ✅ | `/categories/page.tsx` |
| Tri | ✅ | idem |
| Actions (voir, éditer, supprimer) | ✅ | + [src/app/(dashboard)/categories/[id]/page.tsx](src/app/(dashboard)/categories/[id]/page.tsx) |
| Ajouter catégorie (nom, description, image, statut, URL slug) | ✅ | formulaire présent |
| Réorganiser par drag & drop | ⚠️ | À vérifier visuellement — code présent mais comportement à tester |
| Activer/désactiver catégories sélectionnées | ✅ | idem |
| Détail catégorie + produits associés | ✅ | idem |

**Statut : Conforme à 95%** — drag & drop à confirmer en test manuel.

---

### 3.5 Gestion des utilisateurs (§ 7.4)

| Exigence | Statut | Preuve |
| --- | --- | --- |
| Liste (nom, email, date inscription, statut, nb commandes, CA total, dernière connexion, adresses) | ✅ | [src/app/(dashboard)/users/page.tsx](src/app/(dashboard)/users/page.tsx) |
| Tri / recherche / filtre statut | ✅ | idem |
| Pagination | ✅ | idem |
| Envoyer un mail | ✅ | action admin |
| Réinitialiser mot de passe | ✅ | action admin |
| Désactiver compte | ✅ | action admin |
| Supprimer compte (avertissement RGPD) | ✅ | `isDeleteConfirmOpen` + confirmation |

**Statut : Conforme.**

---

### 3.6 Gestion des commandes (§ 7.5)

| Exigence | Statut | Preuve |
| --- | --- | --- |
| Liste (n°, date/heure, client, montant TTC, statut, mode paiement, statut paiement) | ✅ | [src/app/(dashboard)/orders/page.tsx](src/app/(dashboard)/orders/page.tsx) |
| Tri / recherche / filtres | ✅ | idem |
| Code couleur par statut (en attente, en cours, terminée, annulée) | ✅ | `Badge` |
| Détail commande (n°, date, statut modifiable, historique changements) | ✅ | [src/app/(dashboard)/orders/[id]/page.tsx](src/app/(dashboard)/orders/[id]/page.tsx) |
| Infos paiement (mode, date, statut validé/en attente/échoué/remboursé) | ✅ | idem |
| Création commande admin | ✅ | [src/app/(dashboard)/orders/new/page.tsx](src/app/(dashboard)/orders/new/page.tsx) |

**Statut : Conforme.**

---

### 3.7 Gestion des factures (§ 7.6)

| Exigence | Statut | Preuve |
| --- | --- | --- |
| N° facture auto (à validation paiement) | ✅ | côté backend |
| Télécharger PDF facture | ✅ | [src/lib/api/invoicesApi.ts:244](src/lib/api/invoicesApi.ts#L244) — `GET /invoices/:id/pdf` |
| Renvoyer par mail au client | ✅ | `invoicesApi.resend` |
| Modifier facture (formulaire) | ✅ | modal d'édition avec Zod |
| Supprimer facture → génère avoir auto | ✅ | workflow présent |
| Liste factures (n°, date, client, commande associée, montant, statut) | ✅ | idem |
| Liste avoirs (n°, facture liée, date, client, montant, motif) | ✅ | idem |
| **PDF avoir** | ⚠️ | Généré **côté client** via `buildCreditNotePdf` ([src/app/(dashboard)/invoices/page.tsx:383](src/app/(dashboard)/invoices/page.tsx#L383)) — **à migrer côté serveur pour la conformité légale** |
| Envoyer avoir par email | ✅ | action présente |

**Statut : Conforme à 85%.** Le PDF d'avoir est actuellement une "simulation" côté client (`*-simulation.pdf`), la génération serveur doit être branchée.

---

### 3.8 Messages & Chatbot (§ 6 Contact & Chatbot)

| Exigence | Statut | Preuve |
| --- | --- | --- |
| Liste messages contact (tri, filtre statut, recherche) | ✅ | [src/app/(dashboard)/messages/page.tsx](src/app/(dashboard)/messages/page.tsx) |
| Répondre à un message | ✅ | `replySchema` + action `messagesApi.reply` |
| Historique conversations chatbot | ✅ | `chatbotApi.listConversations` branché |
| Statut conversation (open / resolved / escalated) | ✅ | `ChatbotConversation.status` |
| Intégration backoffice | ✅ | section dédiée dans la page messages |

**Statut : Conforme.**

---

### 3.9 Modules bonus implémentés (hors périmètre strict du § 7)

| Module | État | Commentaire |
| --- | --- | --- |
| Analytics avancé (ventes, produits, clients, commandes, inventaire, géographie, remboursements) | ✅ | [src/app/(dashboard)/analytics/page.tsx](src/app/(dashboard)/analytics/page.tsx) + 8 panels |
| Pages légales (CGV/CGU/mentions/confidentialité/cookies + versioning) | ✅ | [src/app/(dashboard)/legal/page.tsx](src/app/(dashboard)/legal/page.tsx) |
| Médiathèque (upload, preview, suppression) | ✅ | [src/app/(dashboard)/media/page.tsx](src/app/(dashboard)/media/page.tsx) |
| Paramètres (société, notifications, sécurité, sessions, carrousel accueil, changement mot de passe) | ✅ | [src/app/(dashboard)/settings/page.tsx](src/app/(dashboard)/settings/page.tsx) |

Ces modules augmentent la valeur livrée au-delà de la spec — à valoriser dans la soutenance.

---

## 4. Exigences transverses — ce qui manque

### 4.1 Tests (§ Livrables 3.4) — ❌ BLOQUANT

Aucun framework de test installé. Le `package.json` ne contient ni Jest, ni Vitest, ni React Testing Library, ni Playwright.

**Le cahier des charges exige** : tests unitaires + intégration + fonctionnels + automatisation.

### 4.2 Internationalisation (§ Fonctionnalités complémentaires → i18n) — ❌

Le cahier des charges stipule :
> « **Backoffice** : Anglais uniquement (simplifié) »

Or tout le texte backoffice est **hardcodé en français**. Aucune librairie i18n détectée (`next-intl`, `i18next`, etc.).

### 4.3 Accessibilité (§ a11y, WCAG 2.1) — ⚠️

Points déjà en place :
- `aria-label` sur les actions et la navigation
- Focus rings Tailwind
- Labels de formulaire liés

Points manquants :
- Audit formel WCAG 2.1 (axe-core / Lighthouse a11y)
- Tests lecteur d'écran (NVDA, VoiceOver)
- Contrastes non vérifiés systématiquement

### 4.4 Documentation technique (§ Livrables 3 & 4) — ⚠️

Déjà présent :
- `API_ENDPOINTS.md` (45 KB) — endpoints documentés
- `API_INTEGRATION_GUIDE.md` (72 KB) — guide d'intégration
- `postman/althea-api.postman_collection.json`
- `PROJET_COMPLET.md` — synthèse fonctionnelle
- `STRUCTURE.md` — architecture code
- `WORKFLOW_PRODUIT_IMAGE.md` — workflow spécifique

À produire :
- Guide d'installation (README actuel minimal)
- Diagrammes d'architecture (global, flux de données, communication services) — **obligatoires** pour le DCT
- Document de Conception Technique (§ 4 livrables) : sécurité, maintenance, évolutivité
- Justification du choix de stack

### 4.5 Suivi git (§ Livrables 5) — ⚠️

Seulement **2 commits** visibles sur `main` (`first commit`, `second commit`), et **36 fichiers modifiés + 14 nouveaux non committés** au moment de l'audit. Les livrables exigent un historique détaillé et de la traçabilité — cela va poser problème en jury.

---

## 5. Points d'attention qualité

1. Plusieurs modales de confirmation dupliquées entre pages → à factoriser éventuellement.
2. `mapProductToLegacy` / `normalizePaginatedResponse` dans `productsApi.ts` : logique d'adaptation qui sert à absorber des variations de format API — une fois l'API figée, ces adaptateurs peuvent être simplifiés.
3. Clé de token dupliquée (`accessToken` + `althea_access_token`) dans `axiosInstance.ts` : volontaire pour rétrocompatibilité, à nettoyer avant livraison finale.
4. Hardcoded `DEFAULT_API_BASE_URL` en clair dans `axiosInstance.ts` : doit passer par `.env` uniquement avant livraison.

---

# Plan d'avancement — Backoffice

> **Objectif** : atteindre 100% de conformité cahier des charges sur le périmètre backoffice, avec livrables propres, avant soutenance.
>
> **Hypothèse durée** : 4 sprints d'une semaine (~1 mois) avec un seul développeur. Ajuster selon la date réelle de jury.

---

## Sprint 1 — Rigueur technique (5j)

**But** : sécuriser le socle avant d'ajouter de la fonctionnalité.

| # | Tâche | Effort | Fichiers / modules |
| --- | --- | --- | --- |
| 1.1 | Committer l'état actuel par lots thématiques (produits / dashboard / analytics / api) | 0.5j | Tous |
| 1.2 | Installer Jest + React Testing Library + config TS | 0.5j | `package.json`, `jest.config.ts`, `jest.setup.ts` |
| 1.3 | Écrire les tests unitaires des utilitaires critiques | 1j | `src/lib/utils.ts`, `src/lib/security.ts`, `src/lib/storageManager.ts` |
| 1.4 | Écrire les tests des api clients (mocks axios) | 1j | `src/lib/api/*.ts` |
| 1.5 | Écrire les tests composants forts (LoginForm, StatsCards, DataTable) | 1.5j | `src/components/**` |
| 1.6 | Script `npm test` + CI éventuelle | 0.5j | `package.json` |

**Livrable** : `npm test` passe, couverture ≥ 40% sur `src/lib/`.

---

## Sprint 2 — Conformité fonctionnelle (5j)

**But** : fermer les écarts vs cahier des charges.

| # | Tâche | Effort | Fichiers / modules |
| --- | --- | --- | --- |
| 2.1 | Brancher la génération PDF des avoirs côté serveur (remplacer `buildCreditNotePdf`) | 1j | `src/lib/api/invoicesApi.ts`, `src/app/(dashboard)/invoices/page.tsx` |
| 2.2 | Ajouter un éditeur de texte riche pour les slides du carrousel d'accueil (gras/italique/liens/couleurs) | 1j | `src/app/(dashboard)/settings/page.tsx` |
| 2.3 | Vérifier et corriger le drag & drop des catégories | 0.5j | `src/app/(dashboard)/categories/page.tsx` |
| 2.4 | i18n : installer `next-intl`, extraire toutes les chaînes, fournir locale `en` par défaut | 2j | Toutes les pages + composants |
| 2.5 | Forcer `en` sur le backoffice (spec : « Backoffice anglais uniquement ») | 0.5j | layout racine |

**Livrable** : couverture cahier des charges backoffice ≥ 98%.

---

## Sprint 3 — Qualité non-fonctionnelle (5j)

**But** : accessibilité, performance, sécurité.

| # | Tâche | Effort | Fichiers / modules |
| --- | --- | --- | --- |
| 3.1 | Audit `@axe-core/react` + `eslint-plugin-jsx-a11y` | 0.5j | config eslint + page racine |
| 3.2 | Corriger les violations a11y (contrastes, labels, roles, navigation clavier) | 1.5j | tous composants UI |
| 3.3 | Lighthouse a11y ≥ 95 sur chaque page backoffice | 1j | idem |
| 3.4 | Tests E2E Playwright sur les 3 parcours critiques (login + 2FA, création produit, génération facture) | 1.5j | `tests/e2e/**` |
| 3.5 | Nettoyer les doubles clés de tokens et passer la base URL via `.env` strict | 0.5j | `src/lib/api/axiosInstance.ts` |

**Livrable** : rapports Lighthouse + rapports Playwright committés.

---

## Sprint 4 — Livrables & documentation (5j)

**But** : rendre le dossier prêt pour jury.

| # | Tâche | Effort | Fichiers / modules |
| --- | --- | --- | --- |
| 4.1 | Réécrire le `README.md` : prérequis, install, `.env`, scripts, déploiement | 0.5j | `README.md` |
| 4.2 | Produire les 3 diagrammes obligatoires (architecture globale, flux de données, communication services) | 1j | `Documentation/diagrammes/` (Mermaid ou PNG) |
| 4.3 | Rédiger le DCT complet (architecture, choix techniques, sécurité, maintenance, scalabilité) | 1.5j | `Documentation/DCT_BACKOFFICE.md` |
| 4.4 | Plan de sécurité (BONUS cahier §4.4) — RGPD, XSS/CSRF, PCI-DSS | 0.5j | `Documentation/PLAN_SECURITE.md` |
| 4.5 | Plan de maintenance & évolutivité (§4.5) | 0.5j | `Documentation/PLAN_MAINTENANCE.md` |
| 4.6 | Nettoyer les documents obsolètes dans `Documentation/` (fait le 22/04/2026) | ✅ | — |
| 4.7 | Relecture finale + bug bash + revue de code | 1j | tous |

**Livrable** : tous les livrables techniques de la section 9 du cahier des charges sont couverts.

---

## Récapitulatif planning

| Sprint | Thème | Durée | Gain cahier des charges |
| --- | --- | --- | --- |
| 1 | Tests + git propre | 1 semaine | +10% |
| 2 | Conformité fonctionnelle + i18n | 1 semaine | +10% |
| 3 | A11y + E2E + sécurité | 1 semaine | +5% |
| 4 | Livrables & docs | 1 semaine | +5% |
| **Total** | | **4 semaines** | **100%** |

---

## Priorités si le temps manque (≤ 2 semaines)

Si le jury tombe plus tôt que prévu, voici l'ordre de priorité **brutal** :

1. **Sprint 1 (tests) compressé à 2 jours** — couverture minimale sur `src/lib/api`.
2. **i18n EN** (Sprint 2.4/2.5) — c'est un écart frontal vs spec, difficile à défendre.
3. **Diagrammes + DCT** (Sprint 4.2/4.3) — indispensables au dossier.
4. **README + install guide** (Sprint 4.1).

Le reste (a11y formelle, PDF avoir serveur, éditeur rich text) peut être documenté comme "roadmap V2" si nécessaire.

---

**Fin du document — mettre à jour à chaque fin de sprint.**
