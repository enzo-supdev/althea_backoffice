# API Client — Althea Systems Backoffice

Client Axios intégré pour l'API Althea Systems avec gestion automatique des JWT tokens.

## Structure

```
src/lib/api/
├── axiosInstance.ts       # Instance Axios + Interceptors (JWT, refresh token)
├── types.ts               # Types TypeScript (ApiResponse, User, Product, etc.)
├── authApi.ts             # Auth (register, login, logout, forgot password)
├── usersApi.ts            # Profil utilisateur, adresses, paiements
├── productsApi.ts         # Produits (CRUD admin)
├── categoriesApi.ts       # Catégories (CRUD admin)
├── ordersApi.ts           # Commandes
├── invoicesApi.ts         # Factures
├── messagesApi.ts         # Messages de contact
├── index.ts               # Exports centralisés
└── README.md              # Ce fichier
```

## Configuration

### Variables d'environnement

```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api-pslt.matheovieilleville.fr/api/v1
```

### Initialisation

Les tokens JWT sont stockés dans le `localStorage` :
- `accessToken` : Token courte durée (15 min)
- `refreshToken` : Token longue durée (7 jours)

L'instance Axios gère automatiquement :
1. ✅ Ajout du token JWT dans le header `Authorization`
2. ✅ Refresh token automatique (401)
3. ✅ Redirection vers login si refresh échoue

## Utilisation

### Authentification

```typescript
import { authApi } from '@/lib/api';

// Inscription
const { user, accessToken, refreshToken } = await authApi.register({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: 'Password123!',
});

// Stocker les tokens
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Connexion
const { user, accessToken, refreshToken } = await authApi.login({
  email: 'john@example.com',
  password: 'Password123!',
});

// Récupérer le profil
const user = await usersApi.getProfile();

// Logout
await authApi.logout();
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
```

### Produits (Public)

```typescript
import { productsApi } from '@/lib/api';

// Lister les produits
const { data, meta } = await productsApi.list({
  category: 'electronics',
  page: 1,
  limit: 20,
  sortBy: 'name',
  sortOrder: 'asc',
});

// Détail d'un produit
const product = await productsApi.getBySlug('iphone-15-pro');

// Top 10 produits featured
const topProducts = await productsApi.getTopFeatured();
```

### Catégories (Admin)

```typescript
import { categoriesApi } from '@/lib/api';

// Lister
const { data, meta } = await categoriesApi.list({
  page: 1,
  limit: 50,
  sortBy: 'displayOrder',
});

// Créer
const category = await categoriesApi.create({
  name: 'Electronics',
  slug: 'electronics',
  description: '...',
});

// Mettre à jour
const updated = await categoriesApi.update(categoryId, {
  name: 'New Name',
});

// Supprimer
await categoriesApi.delete(categoryId);

// Déplacer (up/down)
const moved = await categoriesApi.move(categoryId, 'up');
```

### Commandes (User)

```typescript
import { usersApi } from '@/lib/api';

// Récupérer mes commandes
const { data, meta } = await usersApi.getOrders({
  status: 'delivered',
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc',
});
```

### Factures (User)

```typescript
import { usersApi } from '@/lib/api';

// Récupérer mes factures
const { data, meta } = await usersApi.getInvoices({
  status: 'paid',
  page: 1,
  limit: 10,
});
```

### Gestion d'erreurs

```typescript
try {
  const product = await productsApi.getBySlug('invalid-slug');
} catch (error) {
  if (error.response?.status === 404) {
    console.log('Produit non trouvé');
  } else if (error.response?.status === 401) {
    console.log('Non authentifié');
  } else {
    console.log('Erreur:', error.message);
  }
}
```

## Types TypeScript

Tous les types sont disponibles dans `types.ts` :

```typescript
// Exemples
User
Product
Category
Order
Invoice
ApiResponse<T>
PaginatedResponse<T>
```

## Notes

- L'instance Axios est exportée par défaut pour accès direct si nécessaire
- Les tokens sont automatiquement rafraîchis sur 401
- La redirection vers login se fait sur erreur de refresh
- Tous les timestamps sont en ISO 8601 (UTC)

## TODO

- [ ] Chatbot API (chat, messages)
- [ ] Webhooks pour certains events

## Deja couvert dans le code

- Adresses API (GET, POST, PUT, DELETE)
- Payment methods API (GET, POST, PUT, DELETE)
- File uploads (images, documents)
- Search endpoints
