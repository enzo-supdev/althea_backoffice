# 📁 Structure du Projet - Althea Systems Backoffice

## Architecture Globale

```
PSLT-Althea.BackOffice/
├── .next/                      # Build Next.js (généré)
├── node_modules/               # Dépendances npm (généré)
├── public/                     # Assets statiques
│   └── images/                # Images et logos
├── src/                       # Code source
│   ├── app/                   # App Router Next.js 14
│   │   ├── (dashboard)/      # Groupe de routes dashboard
│   │   │   ├── layout.tsx    # Layout avec sidebar et header
│   │   │   ├── dashboard/    # Page tableau de bord
│   │   │   ├── products/     # Gestion produits
│   │   │   ├── categories/   # Gestion catégories
│   │   │   ├── users/        # Gestion utilisateurs
│   │   │   ├── orders/       # Gestion commandes
│   │   │   ├── invoices/     # Gestion factures & avoirs
│   │   │   ├── messages/     # Support & messages
│   │   │   └── settings/     # Paramètres
│   │   ├── layout.tsx        # Layout racine (fonts, metadata)
│   │   ├── page.tsx          # Redirect vers /dashboard
│   │   └── globals.css       # Styles globaux + Tailwind
│   ├── components/           # Composants React
│   │   ├── layout/          # Layout components
│   │   │   ├── Sidebar.tsx  # Navigation sidebar
│   │   │   └── Header.tsx   # Header avec recherche
│   │   ├── dashboard/       # Composants dashboard
│   │   │   ├── StatsCards.tsx
│   │   │   ├── QuickActions.tsx
│   │   │   ├── SalesByCategoryChart.tsx
│   │   │   └── SalesHistogram.tsx
│   │   └── ui/              # Composants UI réutilisables (à créer)
│   ├── lib/                 # Utilitaires
│   │   └── utils.ts         # Fonctions helpers
│   ├── types/               # Types TypeScript
│   │   └── index.ts         # Types principaux
│   └── hooks/               # Custom React hooks (à créer)
├── .env.example             # Variables d'environnement exemple
├── .eslintrc.json          # Configuration ESLint
├── .gitignore              # Fichiers à ignorer par Git
├── next.config.js          # Configuration Next.js
├── package.json            # Dépendances npm
├── postcss.config.js       # Configuration PostCSS
├── tailwind.config.ts      # Configuration Tailwind
├── tsconfig.json           # Configuration TypeScript
└── README.md               # Documentation projet
```

## 🎨 Conventions de Nommage

### Fichiers
- **Components**: PascalCase (Ex: `StatsCards.tsx`)
- **Pages**: lowercase (Ex: `page.tsx`, `layout.tsx`)
- **Utilities**: camelCase (Ex: `utils.ts`)
- **Types**: PascalCase (Ex: `Product`, `Order`)

### Composants
- **Client Components**: Utiliser `'use client'` en haut du fichier
- **Server Components**: Par défaut (pas de directive)

## 🎯 Routes Disponibles

| Route | Description | Statut |
|-------|-------------|---------|
| `/` | Redirect vers dashboard | ✅ |
| `/dashboard` | Tableau de bord principal | ✅ |
| `/products` | Gestion des produits | 🔄 Structure créée |
| `/categories` | Gestion des catégories | 🔄 Structure créée |
| `/users` | Gestion des utilisateurs | 🔄 Structure créée |
| `/orders` | Gestion des commandes | 🔄 Structure créée |
| `/invoices` | Gestion des factures | 🔄 Structure créée |
| `/messages` | Messages & support | 🔄 Structure créée |
| `/settings` | Paramètres | 🔄 Structure créée |

## 🧩 Composants Créés

### Layout
- ✅ **Sidebar** - Navigation principale avec menu et user info
- ✅ **Header** - Barre de recherche et notifications

### Dashboard
- ✅ **StatsCards** - 4 cartes d'indicateurs clés
- ✅ **QuickActions** - Actions rapides (nouvelle commande, produit, messages)
- ✅ **SalesByCategoryChart** - Graphique camembert des ventes
- ✅ **SalesHistogram** - Histogramme des ventes par jour

## 🎨 Charte Graphique Implémentée

### Couleurs Tailwind
```typescript
colors: {
  primary: {
    DEFAULT: '#00a8b5',    // Turquoise principal
    hover: '#33bfc9',       // Turquoise hover
    light: '#d4f4f7',       // Fond clair
  },
  dark: '#003d5c',          // Bleu foncé titres/nav
  status: {
    success: '#10b981',     // Vert disponibilité
    warning: '#F59E0B',     // Orange alerte
    error: '#ef4444',       // Rouge erreur
  },
}
```

### Classes Utilitaires CSS
- `.btn-primary` - Bouton principal turquoise
- `.btn-secondary` - Bouton secondaire bleu foncé
- `.card` - Carte blanche avec ombre
- `.badge-success` - Badge vert
- `.badge-warning` - Badge orange
- `.badge-error` - Badge rouge

### Typographie
- **Headings**: Poppins Semibold (`font-heading`)
- **Body**: Inter Regular (`font-body`)

## 📦 Dépendances Installées

### Production
- `next` (^14.2.0) - Framework React
- `react` (^18.3.0) - Bibliothèque UI
- `react-dom` (^18.3.0) - React DOM
- `lucide-react` (^0.344.0) - Icônes
- `recharts` (^2.12.0) - Graphiques
- `clsx` (^2.1.0) - Utility pour classes CSS

### Développement
- `typescript` (^5.3.0)
- `tailwindcss` (^3.4.1)
- `@types/node`, `@types/react`, `@types/react-dom`
- `eslint`, `eslint-config-next`
- `postcss`, `autoprefixer`

## 🚀 Scripts Disponibles

```bash
npm run dev      # Démarrer le serveur de développement
npm run build    # Build de production
npm run start    # Démarrer en production
npm run lint     # Vérifier le code avec ESLint
```

## 📝 Prochaines Étapes

### Phase 1 - CRUD Produits ⏳
- [ ] Créer la liste des produits avec tableau
- [ ] Ajouter filtres et recherche
- [ ] Formulaire d'ajout de produit
- [ ] Formulaire d'édition de produit
- [ ] Upload d'images (drag & drop)
- [ ] Gestion du stock

### Phase 2 - Catégories ⏳
- [ ] Liste des catégories avec hiérarchie
- [ ] Drag & drop pour réorganiser
- [ ] Formulaire CRUD catégories
- [ ] Association produits ↔ catégories

### Phase 3 - Commandes & Factures ⏳
- [ ] Liste des commandes avec filtres
- [ ] Détail d'une commande
- [ ] Changement de statut
- [ ] Génération facture PDF
- [ ] Gestion des avoirs

### Phase 4 - Utilisateurs ⏳
- [ ] Liste des utilisateurs
- [ ] Recherche et filtres
- [ ] Détail d'un utilisateur
- [ ] Actions admin (désactiver, email)

### Phase 5 - Messages & Support ⏳
- [ ] Liste des messages
- [ ] Conversations chatbot
- [ ] Répondre aux messages
- [ ] Statuts (lu/non lu/répondu)

### Phase 6 - Backend API 🔜
- [ ] Définir l'architecture API
- [ ] Connexion base de données
- [ ] Endpoints CRUD
- [ ] Authentification admin
- [ ] Upload fichiers

### Phase 7 - Sécurité & Auth 🔜
- [ ] NextAuth.js
- [ ] Protection des routes
- [ ] Gestion des rôles
- [ ] 2FA (optionnel)

## 🔧 Configuration Technique

### TypeScript
- Strict mode activé
- Path alias: `@/*` → `./src/*`
- Types complets pour tous les composants

### Tailwind CSS
- Purge CSS en production
- Classes personnalisées charte Althea
- Responsive mobile-first

### Next.js
- App Router (Next.js 14)
- Server Components par défaut
- Image optimization
- Métadonnées SEO

## 📚 Ressources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/)
- [Recharts](https://recharts.org/)

---

**Projet**: Althea Systems E-commerce Backoffice  
**Date de création**: Février 2026  
**Framework**: Next.js 14 + TypeScript + Tailwind CSS
