# Plan Front 100% Avant API - Althea BackOffice

## Objectif
Amener le frontend a un niveau production-ready autonome, avec comportement complet et coherent, avant branchement du backend.

## Avancement Actuel
- [x] Couche API mock centralisee pour les pages metier
- [x] Gestion d'erreur unifiee via `ApiError` et toasts globaux
- [x] Persistance locale versionnee via `localStorage` envelope
- [x] Pages Produits, Categories, Utilisateurs, Commandes, Factures et Messages branchees sur `src/lib/api/`
- [x] Layout dashboard responsive avec sidebar mobile, header adapte et toasts globaux
- [x] Validation lint/build verte apres migration

## Recap chiffré (03/04/2026)

### Avancement global
- Progression globale estimee: **73.5%** (61 items coches / 83 items).

### Avancement par priorite
| Priorite | Fait | Total | Progression |
|---|---:|---:|---:|
| P0 | 18 | 18 | **100%** |
| P1 | 29 | 30 | **96.7%** |
| P2 | 13 | 17 | **76.5%** |
| P3 | 1 | 18 | **5.6%** |

### Avancement par sprint
| Sprint | Perimetre | Progression |
|---|---|---:|
| Sprint A | Items 1 a 4 | **100%** |
| Sprint B | Items 5, 6, 8, 9 | **100%** |
| Sprint C | Items 7, 10, 11 | **90.9%** |
| Sprint D | Items 12, 13, 14, 15 | **76.5%** |
| Sprint E | Items 16 a 20 | **5.6%** |

### Points restants critiques pour atteindre 100% Front-Ready
- [ ] 10 - Inbox operable en autonomie complete
- [ ] 16 - Memoisation filtres lourds + virtualisation + validation dataset massif
- [ ] 17 - Suite E2E Playwright des parcours critiques
- [ ] 18 - Tests unitaires utilitaires critiques
- [ ] 19 - CI Front complete (lint + typecheck + build + e2e smoke)
- [ ] 20 - Documentation de transition API complete

## Definition de "100% Front-Ready"
- Toutes les actions visibles ont un comportement concret (pas de bouton inactif).
- Tous les formulaires critiques sont valides, persistants localement et testables.
- Les etats UX sont complets: chargement, vide, succes, erreur, confirmation.
- Les parcours metier principaux sont couverts par tests E2E.
- Le socle de remplacement API est en place (service layer + contrats).
- Lint et build passent en continu.

## Priorite Globale
- P0: Bloquants qualite et architecture de transition API.
- P1: Parcours metiers indispensables.
- P2: Robustesse UX, accessibilite, observabilite front.
- P3: Optimisations, polish et dette technique residuelle.

---

## P0 - Fondations obligatoires (a faire en premier)

### 1. Couche API mock centralisee
- [x] Creer `src/lib/api/` avec modules: `productsApi`, `categoriesApi`, `usersApi`, `ordersApi`, `invoicesApi`, `messagesApi`.
- [x] Exposer des fonctions CRUD coherentes: `list/get/create/update/delete`.
- [x] Simuler latence reseau et erreurs standardisees.
- [x] Supprimer la logique CRUD inline dans les pages et utiliser cette couche.
- Criteres d'acceptation:
- [x] Toutes les pages utilisent le service layer.
- [x] Aucun `setState` metier direct hors hooks/services pour les operations CRUD.

### 2. Contrats de donnees front
- [x] Introduire des types DTO front (`*Dto`) separes des types UI.
- [x] Ajouter adaptateurs DTO -> modele UI dans `src/lib/adapters/`.
- Criteres d'acceptation:
- [x] Les pages consomment des modeles UI adaptes.
- [x] Le remplacement backend se fait sans refactor massif UI.

### 3. Gestion d'erreur unifiee
- [x] Definir un format unique: `{ code, message, fieldErrors? }`.
- [x] Mapper toutes les erreurs mock vers toasts + erreurs de formulaire.
- Criteres d'acceptation:
- [x] Toute erreur actionnable affiche un feedback clair.
- [x] Aucun `catch` silencieux.

### 4. Persistance locale versionnee
- [x] Ajouter un schema versionne `localStorage` par domaine (`schemaVersion`, `updatedAt`).
- [x] Ajouter migration simple v1 -> v2.
- Criteres d'acceptation:
- [x] Donnees locales robustes apres evolutions de schema.
- [x] Aucune corruption non geree.

---

## P1 - Parcours metiers indispensables

### 5. Produits
- [x] Finaliser create/delete avec validations completes.
- [x] Ajouter gestion du statut et export selection.
- [x] Ajouter edition complete (pas seulement toggle statut).
- [x] Ajouter preview image locale si upload simulé.
- Criteres d'acceptation:
- [x] CRUD principal disponible depuis UI.
- [x] Filtres et pagination conservent l'etat apres action.

### 6. Categories
- [x] Base de gestion liste/creation/suppression/statut.
- [x] Finaliser edition categorie.
- [x] Simuler reordonnancement (up/down ou drag persiste localement).
- Criteres d'acceptation:
- [x] Nom/slug/description visibles dans l'UI.
- [x] Ordre persistant apres refresh.

### 7. Utilisateurs
- [x] Actions admin simulées de base: desactivation, mise en attente, suppression.
- [x] Completer reactivation, reset mot de passe confirme, archivage.
- Criteres d'acceptation:
- [x] Toute action du tableau a un resultat visible et feedback.

### 8. Commandes
- [x] Simuler transitions de statut avec garde-fous (workflow simple).
- [x] Completer vue detail commande (items, adresses, timeline statut).
- Criteres d'acceptation:
- [x] Workflow statut coherent et testable de bout en bout.

### 9. Factures
- [x] Conserver preview/export simulé et ajout de suppression confirmée.
- [x] Statut facture modifiable.
- [x] Ajouter edition metadata facture.
- [x] Ajouter creation d'avoir simulée lors suppression/annulation.
- Criteres d'acceptation:
- [x] Flux facture -> avoir visible dans onglets.

### 10. Messages & support
- [x] Lecture, marquage lu et reponse locale.
- [x] Ajouter historique de reponses local.
- [x] Ajouter statut "clos" et filtres associes.
- Criteres d'acceptation:
- [ ] Inbox operable en autonomie complete.

### 11. Parametres
- [x] Page de parametres completement maquettée.
- [x] Persister tous les blocs (entreprise, notifications, securite) localement.
- [x] Ajouter validations et reset usine.
- Criteres d'acceptation:
- [x] Donnees conservees au refresh, messages de succes/erreur coherents.

---

## P2 - Robustesse UX / Accessibilite / Qualite

### 12. Etats UX systematiques
- [x] Ajouter skeleton/loading sur toutes les vues liste/detail.
- [x] Ajouter etats vides avec CTA explicite sur plusieurs vues.
- [x] Ajouter etat erreur avec action "Reessayer".
- Criteres d'acceptation:
- [x] Aucune vue sans etat loading/empty/error.

### 13. Accessibilite (WCAG cible AA)
- [x] Focus trap complet sur modales.
- [x] Navigation clavier tables/actions.
- [x] `aria-live` sur feedback critiques.
- [x] Contrastes et labels conformes.
- Criteres d'acceptation:
- [x] Parcours clavier principaux sans blocage.
- Audit accessibilite interne valide.

### 14. Formulaires standards
- [x] Uniformiser via `react-hook-form + zod`.
- [x] Composants reutilisables `FormField`, `FormError`, `FormActions`.
- Criteres d'acceptation:
- [x] Validation coherente sur tous les formulaires.
- [x] Messages d'erreur homogenes.

### 15. Toasts et confirmations
- [x] Conserver toasts globaux et harmoniser types/messages.
- [x] Politique de confirmation sur les suppressions irreversibles majeures.
- Criteres d'acceptation:
- [x] Aucun delete irreversibe sans confirmation.

---

## P3 - Performance, tests et industrialisation

### 16. Performance front
- [x] Debounce recherche listes (200-300ms).
- [ ] Memoisation des filtres lourds.
- [ ] Virtualisation de tableaux si volumetrie > 500 lignes.
- Criteres d'acceptation:
- [ ] Navigation fluide sur dataset massif simule.

### 17. Tests E2E prioritaires (Playwright)
- [ ] Produits: creation, edition, suppression, bulk action.
- [ ] Categories: creation, activation/desactivation, suppression.
- [ ] Commandes: changement statut, preview detail, suppression.
- [ ] Factures: preview/export simule, statut, suppression + avoir.
- [ ] Messages: lecture, reponse, filtrage.
- Criteres d'acceptation:
- [ ] Suite E2E verte sur parcours critiques.

### 18. Tests unitaires utilitaires
- [ ] Adapters, validators, helpers date/prix.
- Criteres d'acceptation:
- [ ] Couverture minimum des utilitaires critiques.

### 19. CI Front
- [ ] Pipeline: lint + typecheck + build + e2e smoke.
- Criteres d'acceptation:
- [ ] PR bloquee si regression critique.

### 20. Documentation de transition API
- [ ] Matrice endpoint attendu par ecran.
- [ ] Payloads de requete/reponse.
- [ ] Mapping erreurs backend -> erreurs UI.
- Criteres d'acceptation:
- [ ] Backend peut brancher sans ambiguite fonctionnelle.

---

## Ordre d'execution recommande (sprint plan)

### Sprint A - Stabilisation socle
- Items: 1, 2, 3, 4.
- Sortie attendue: architecture front prete au switch API.

### Sprint B - Parcours metiers critiques
- Items: 5, 6, 8, 9.
- Sortie attendue: coeur ecommerce backoffice complet.

### Sprint C - Parcours support et admin
- Items: 7, 10, 11.
- Sortie attendue: operations quotidiennes completes.

### Sprint D - Qualite produit
- Items: 12, 13, 14, 15.
- Sortie attendue: UX robuste et accessible.

### Sprint E - Industrialisation
- Items: 16, 17, 18, 19, 20.
- Sortie attendue: front verifiable, monitorable, branchable backend.

---

## Checklist Go/No-Go avant API
- [ ] Tous les items P0 et P1 termines.
- [x] Lint/build verts sur branche principale.
- [ ] E2E critiques verts.
- [x] Aucun bouton/action sans effet visible.
- [x] Aucun formulaire critique sans validation.
- [x] Erreurs utilisateur couvertes et explicites.
- [ ] Documentation de transition API disponible.

## Notes d'implementation
- Favoriser changements incrementaux avec petits PRs.
- Ne pas multiplier les abstractions sans besoin concret.
- Prioriser la coherence UX et la testabilite.
- Progression item 14: formulaires Parametres et Categories migres vers `react-hook-form + zod` avec composants reutilisables `FormField`, `FormError` et `FormActions`.
- Progression item 14: formulaires Produits, Factures (edition metadata) et Messages (reponse support) migres vers `react-hook-form + zod` avec messages d'erreur homogenes.
