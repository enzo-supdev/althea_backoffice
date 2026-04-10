# Althea Systems - Backoffice

Backoffice de gestion pour la plateforme e-commerce Althea Systems, spécialisée dans le materiel medical.

## Objectif

Cette application centralise les operations administratives du backoffice :

- suivi de l'activite commerciale
- gestion des produits et categories
- gestion des utilisateurs
- suivi des commandes et factures
- traitement des messages entrants

## Stack technique

| Domaine | Choix |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript |
| UI | Tailwind CSS |
| Composants icones | Lucide React |
| Graphiques | Recharts |

## Charte visuelle

### Palette

- Primary (Turquoise) : `#00a8b5`
- Primary Hover : `#33bfc9`
- Background Light : `#d4f4f7`
- Dark Blue : `#003d5c`
- Success : `#10b981`
- Warning : `#f59e0b`
- Error : `#ef4444`

### Typographie

- Titres : Poppins SemiBold
- Corps : Inter Regular

## Prerequis

- Node.js 18+
- npm 9+

## Installation et lancement

```bash
# 1) Installer les dependances
npm install

# 2) Lancer en developpement
npm run dev
```

Application disponible sur : `http://localhost:3000`

## Scripts utiles

```bash
# Developpement
npm run dev

# Developpement avec nettoyage des caches (.next, .turbo)
npm run dev:clean

# Build production
npm run build

# Build production avec nettoyage des caches
npm run build:clean

# Lancer l'application en mode production
npm run start

# Lint
npm run lint

# Nettoyage manuel des artefacts Next/Turbo
npm run clean
```

## Structure du projet

```text
src/
	app/
		(dashboard)/
			categories/
			dashboard/
			invoices/
			messages/
			orders/
			products/
			settings/
			users/
			layout.tsx
		globals.css
		layout.tsx
		page.tsx
	components/
		dashboard/
			AverageBasketChart.tsx
			QuickActions.tsx
			SalesByCategoryChart.tsx
			SalesHistogram.tsx
			StatsCards.tsx
		layout/
			Header.tsx
			PageHeader.tsx
			Sidebar.tsx
		ui/
			Badge.tsx
			DataTable.tsx
			Modal.tsx
			Pagination.tsx
			SearchBar.tsx
			ToastProvider.tsx
	lib/
		adapters/
			index.ts
		api/
			core.ts
			index.ts
			types.ts
			categoriesApi.ts
			invoicesApi.ts
			messagesApi.ts
			ordersApi.ts
			productsApi.ts
			usersApi.ts
		utils.ts
	types/
		index.ts
```

## Fonctionnalites

### Dashboard

- indicateurs cles (CA, commandes, alertes, messages)
- visualisation des ventes par categorie
- histogramme des ventes
- actions rapides

### Modules metier

- Produits
- Categories
- Utilisateurs
- Commandes
- Factures
- Messages
- Parametres

## Architecture fonctionnelle (front)

- `app/` : routing et layouts Next.js (App Router)
- `components/layout/` : structure d'interface (navigation, en-tetes)
- `components/dashboard/` : widgets metier du tableau de bord
- `components/ui/` : composants reutilisables transverses
- `lib/api/` : couche d'acces API par domaine
- `lib/adapters/` : adaptation/mapping des donnees
- `types/` : contrats TypeScript partages

## Qualite et conventions

- TypeScript strict et typage explicite des objets metier
- composants React decouples et reutilisables
- style unifie via Tailwind et charte Althea Systems
- separation claire entre presentation, logique d'acces donnees et types

## Roadmap recommandee

1. Brancher les appels API reels sur tous les modules
2. Ajouter l'authentification et la gestion des roles
3. Finaliser les parcours CRUD complets (validation + erreurs)
4. Renforcer la recherche, les filtres et la pagination serveur
5. Ajouter la couverture de tests (unitaire + integration)
6. Mettre en place monitoring front et suivi des erreurs

## Documentation complementaire

- `cahier-des-charges-althea-systems.md`
- `backoffice-althea-systems.md`
- `audit-conformite-backoffice.md`
- `STRUCTURE.md`
