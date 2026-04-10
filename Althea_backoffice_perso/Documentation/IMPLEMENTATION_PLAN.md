# Plan d'implémentation API — Althea Systems BackOffice

> **Document de référence pour toutes les modifications du backoffice**
> Version: 1.0 | Date: 2026-04-08
> Ce document doit être consulté avant chaque implémentation de feature API.

---

## 📋 Table des matières

1. [Architecture globale](#1-architecture-globale)
2. [Structure des fichiers API](#2-structure-des-fichiers-api) 
3. [Patterns d'implémentation](#3-patterns-dimplémentation)
4. [Modules à implémenter](#4-modules-à-implémenter)
5. [Checklist de chaque module](#5-checklist-de-chaque-module)
6. [Gestion des erreurs & tokens](#6-gestion-des-erreurs--tokens)
7. [Intégration UI](#7-intégration-ui)

---

## 1. Architecture globale

### 1.1 Stack

```
Frontend: Next.js 15 (App Router) + TypeScript + React
API Client: Axios (core.ts)
Auth: JWT (accessToken + refreshToken)
State Management: Context API / Props (à évaluer pour Global State)
Styling: Tailwind CSS v4
```

### 1.2 Flux de données

```
UI (Components)
    ↓
Custom Hooks (useApi, useAuth, use*)
    ↓
API Adapters (categoriesApi.ts, productsApi.ts, ...)
    ↓
Core API Client (core.ts)
    ↓
HTTP Request (Axios)
    ↓
API Server (https://api-pslt.matheovieilleville.fr/api/v1/)
```

### 1.3 Configuration de base

```typescript
// src/lib/api/core.ts (existant)
const API_BASE_URL = 'https://api-pslt.matheovieilleville.fr/api/v1';
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Interceptor pour token (à implémenter):
// - Ajouter Authorization header si accessToken existe
// - Gérer 401 → refresh token → retry
// - Gérer 403, 404, 500, etc.
```

---

## 2. Structure des fichiers API

### 2.1 Organisation actuelle

```
src/lib/api/
├── core.ts              # Configuration Axios + interceptors
├── types.ts             # Types partagés (ApiResponse, PaginationMeta, etc.)
├── index.ts             # Exports publics
├── categoriesApi.ts     # Endpoints /categories
├── productsApi.ts       # Endpoints /products
├── ordersApi.ts         # Endpoints /orders
├── invoicesApi.ts       # Endpoints /invoices
├── usersApi.ts          # Endpoints /users
├── messagesApi.ts       # Endpoints /contact
└── [autres]
```

### 2.2 Template d'un fichier API

```typescript
// src/lib/api/exampleApi.ts
import { axiosInstance } from './core';
import type { Example, ExampleResponse, PaginationMeta } from './types';

/**
 * Récupère tous les exemples avec pagination
 * GET /api/v1/examples
 */
export const getExamples = async (
  params?: { page?: number; limit?: number; }
): Promise<ExampleResponse> => {
  const { data } = await axiosInstance.get('/examples', { params });
  return data;
};

/**
 * Récupère un exemple par ID
 * GET /api/v1/examples/:id
 */
export const getExampleById = async (id: string): Promise<Example> => {
  const { data } = await axiosInstance.get(`/examples/${id}`);
  return data.data;
};

/**
 * Crée un nouvel exemple
 * POST /api/v1/examples
 */
export const createExample = async (payload: CreateExampleDTO): Promise<Example> => {
  const { data } = await axiosInstance.post('/examples', payload);
  return data.data;
};

/**
 * Met à jour un exemple
 * PUT /api/v1/examples/:id
 */
export const updateExample = async (id: string, payload: UpdateExampleDTO): Promise<Example> => {
  const { data } = await axiosInstance.put(`/examples/${id}`, payload);
  return data.data;
};

/**
 * Supprime un exemple
 * DELETE /api/v1/examples/:id
 */
export const deleteExample = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/examples/${id}`);
};
```

### 2.3 Types partagés (types.ts)

```typescript
// src/lib/api/types.ts

// === Réponses standards ===
export interface ApiResponse<T> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// === Auth ===
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'user' | 'admin';
  status: 'pending' | 'active' | 'suspended';
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// === Autres types (à ajouter par module) ===
// Product, Category, Order, Invoice, Address, etc.
```

---

## 3. Patterns d'implémentation

### 3.1 Gestion de l'authentification

**Règles strictes :**
1. ✅ Les tokens (accessToken, refreshToken) se stockent en **localStorage** ou **cookies httpOnly** (si possible)
2. ✅ À chaque requête, ajouter `Authorization: Bearer <accessToken>` via interceptor
3. ✅ Si réponse 401 : appeler `refresh-token`, puis rejouer la requête
4. ✅ Si `refresh-token` échoue (401) → logout automatique

**Interceptor Axios (core.ts) :**

```typescript
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        // Appeler /auth/refresh-token
        // Stocker nouveaux tokens
        // Rejouer requête originale
      } else {
        // Logout
      }
    }
    return Promise.reject(error);
  }
);
```

### 3.2 Gestion des erreurs

**Codes HTTP à gérer :**

| Code | Action |
|---|---|
| `200, 201, 204` | Succès — parcourir `data` ou `meta` selon le cas |
| `400` | Validation échouée — afficher `errors` à l'utilisateur |
| `401` | Token expiré — refresh + retry OU logout |
| `403` | Accès refusé — afficher message, bloquer l'action |
| `404` | Ressource introuvable — redirect OU afficher "non trouvé" |
| `409` | Conflit (ex. email déjà utilisé) — afficher message spécifique |
| `422` | Validation métier échouée — afficher `message` |
| `429` | Rate limited — afficher "trop de requêtes, réessayez plus tard" |
| `500, 503` | Erreur serveur — afficher message générique, logger |

### 3.3 Composants hooks personnalisés

**À créer (ou améliorer) :**

```typescript
// src/hooks/useApi.ts
export const useApi = <T,>(
  apiCall: () => Promise<T>
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall();
      setData(result);
    } catch (err) {
      setError((err as any).message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, execute };
};

// src/hooks/useAuth.ts
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    setUser(response.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setIsAuthenticated(false);
  };

  return { user, isAuthenticated, login, logout };
};
```

---

## 4. Modules à implémenter

Basé sur la documentation API, les modules prioritaires pour le backoffice sont :

### Pour l'admin :

1. **Auth** (6.1)
   - ✅ Login / Register / Logout
   - ✅ Refresh token
   - ✅ Change password
   - ✅ Forgot password / Reset password

2. **Admin Users** (6.16)
   - Lister tous les utilisateurs (pagination)
   - Créer / Éditer / Supprimer un utilisateur
   - Changer son rôle, status
   - Voir ses commandes, factures

3. **Products** (6.3)
   - Lister, créer, éditer, supprimer produits
   - Gérer images, variants, prix, stock
   - Bulk actions

4. **Categories** (6.4)
   - Lister, créer, éditer, supprimer catégories
   - Gérer hiérarchie, images

5. **Orders** (6.7)
   - Lister avec filtres (status, date)
   - Voir détails des commandes
   - Changer le status (pending → processing → shipped → delivered)
   - Générer facture, avoir, BL

6. **Invoices** (6.8)
   - Lister factures / avoirs
   - Télécharger PDF
   - Créer avoir (refund)

7. **Contact Messages** (6.11)
   - Lister messages
   - Marquer comme traité
   - Supprimer

8. **Analytics** (6.13)
   - Stats globales (chiffre affaires, nb commandes, etc.)
   - Graphiques par période, par catégorie
   - Export données

---

## 5. Checklist de chaque module

Pour **chaque** module implémenté, respecter cette checklist :

- [ ] **Fichier API créé** (`src/lib/api/modulesApi.ts`)
  - Tous les endpoints documentés dans le guide
  - Types importés/définis dans `types.ts`
  - Gestion d'erreurs cohérente

- [ ] **Types définis** (`src/lib/api/types.ts`)
  - DTOs (Create*, Update*)
  - Response types
  - Énums (status, roles, etc.)

- [ ] **Hook personnalisé** (`src/hooks/useModule.ts`)
  - State management (loading, error, data)
  - Méthodes CRUD
  - Format cohérent

- [ ] **Pages créées** (`src/app/(dashboard)/moduleName/`)
  - `page.tsx` : liste avec pagination + filtres
  - `[id]/page.tsx` : détails + édition
  - Loading states, error boundaries
  - Pagination, recherche, tri

- [ ] **Composants réutilisables** (`src/components/moduleName/`)
  - FormModule.tsx, CardModule.tsx, ModalModule.tsx
  - Réutilisable sur plusieurs pages

- [ ] **Tests / Validation**
  - Vérifier chaque endpoint
  - Tester erreurs (401, 404, 422, etc.)
  - Tester pagination, filtres
  - Vérifier rechargement, retry

- [ ] **Documentation intra-code**
  - JSDoc sur les fonctions API
  - Comments clairs sur logique complexe
  - Route expliquée dans le composant

---

## 6. Gestion des erreurs & tokens

### 6.1 Interceptor global (core.ts)

```typescript
import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = 'https://api-pslt.matheovieilleville.fr/api/v1';

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor : ajouter token
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor : gérer 401, erreurs
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si 401 et on a un refreshToken → tenter refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const { data } = await axios.post(
            `${API_BASE_URL}/auth/refresh-token`,
            { refreshToken }
          );
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);

          // Rejouer requête originale
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return axiosInstance(originalRequest);
        } catch {
          // Refresh échoué → logout
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);
```

### 6.2 Hook pour gérer les erreurs

```typescript
// src/hooks/useApiWithError.ts
import { useState } from 'react';
import type { AxiosError } from 'axios';

export const useApiWithError = <T,>(
  apiCall: () => Promise<T>
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall();
      setData(result);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string; errors?: Record<string, string[]> }>;
      
      if (axiosError.response?.status === 422) {
        // Validation échouée
        const fieldErrors = axiosError.response.data?.errors;
        setError(JSON.stringify(fieldErrors));
      } else if (axiosError.response?.status === 409) {
        // Conflit (ex. email déjà utilisé)
        setError(axiosError.response.data?.message || 'Conflit: ressource déjà existante');
      } else if (axiosError.response?.status === 429) {
        // Rate limited
        setError('Trop de requêtes. Veuillez réessayer plus tard.');
      } else if (axiosError.response?.status === 403) {
        // Forbidden
        setError('Vous n\'avez pas accès à cette ressource.');
      } else {
        setError(axiosError.response?.data?.message || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, execute };
};
```

---

## 7. Intégration UI

### 7.1 Pattern UI pour listes

```tsx
// src/app/(dashboard)/moduleName/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/DataTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import * as moduleApi from '@/lib/api/moduleApi';

export default function ModulePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const response = await moduleApi.getModules({ page, limit: 20 });
        setData(response.data);
        setPagination({ total: response.meta.total, totalPages: response.meta.totalPages });
      } catch (err) {
        setError((err as any).message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [page]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'createdAt', label: 'Créé le' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Modules</h1>
      <DataTable columns={columns} data={data} />
      <Pagination
        current={page}
        total={pagination.totalPages}
        onChange={setPage}
      />
    </div>
  );
}
```

### 7.2 Pattern UI pour formulaires

```tsx
// src/components/moduleName/FormModule.tsx
'use client';

import { FormEvent, useState } from 'react';
import { FormField } from '@/components/ui/form/FormField';
import { FormActions } from '@/components/ui/form/FormActions';
import * as moduleApi from '@/lib/api/moduleApi';

export const FormModule = ({ id, onSuccess }: { id?: string; onSuccess: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({ name: '', description: '' });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (id) {
        await moduleApi.updateModule(id, fields);
      } else {
        await moduleApi.createModule(fields);
      }
      onSuccess();
    } catch (err) {
      setError((err as any).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        label="Nom"
        type="text"
        value={fields.name}
        onChange={(value) => setFields({ ...fields, name: value })}
        required
      />
      <FormField
        label="Description"
        type="textarea"
        value={fields.description}
        onChange={(value) => setFields({ ...fields, description: value })}
      />
      {error && <div className="text-red-600">{error}</div>}
      <FormActions loading={loading} onCancel={onSuccess} />
    </form>
  );
};
```

---

## 📝 Résumé des règles d'implémentation

1. **Tous les appels API** passent par `src/lib/api/*.ts`
2. **Tous les types** sont définis dans `src/lib/api/types.ts`
3. **Authentification** gérée via interceptor Axios
4. **Erreurs** catchées et affichées à l'utilisateur
5. **Pagination** supportée sur GET list endpoints
6. **Filtres** (status, sortBy, search) exposés en query params
7. **Loading & errors states** toujours dans les composants
8. **Réutilisabilité** : composants génériques pour DataTable, Modal, Form
9. **Documentation** : JSDoc sur fonctions API, comments sur logique métier
10. **Tests** : tester chaque endpoint AVANT de le merger

---

## 🔗 Référence API

**URL de base** : `https://api-pslt.matheovieilleville.fr/api/v1`

**Fichier complet** : `API_INTEGRATION_GUIDE.md` (ce workspace)

**Modules documentés** :
- 6.1 Auth | 6.2 Users | 6.3 Products | 6.4 Categories
- 6.5 Cart | 6.6 Checkout | 6.7 Orders | 6.8 Invoices
- 6.9 Search | 6.10 Media | 6.11 Contact | 6.12 Chatbot
- 6.13 Analytics | 6.14 Legal | 6.15 Homepage | 6.16 Admin Users

---

## 📊 État d'avancement du projet

### ✅ Ce qui a été DOCUMENTÉ (100% complet)

Le document IMPLEMENTATION_PLAN.md est **100% complete sur le plan théorique** :

| Section | Statut |
|---------|--------|
| 1️⃣ Architecture globale | ✅ Définie (Next.js, Axios, JWT, Context API) |
| 2️⃣ Structure des fichiers API | ✅ Planifiée avec chemin exact |
| 3️⃣ Patterns d'implémentation | ✅ Code templates fournis (interceptors, hooks, composants) |
| 4️⃣ Modules à implémenter | ✅ Listés avec priorités (Auth, Users, Products, etc.) |
| 5️⃣ Checklist par module | ✅ 8 points de vérification définis |
| 6️⃣ Gestion erreurs & tokens | ✅ Code d'interceptor Axios détaillé |
| 7️⃣ Intégration UI | ✅ Patterns React complets (listes, formulaires) |

---

### ❌ Ce qui RESTE À FAIRE dans le code

#### 🔴 **PHASE 1 : Infrastructure API (CRITIQUE)**

| Fichier | Status | Action |
|---------|--------|--------|
| `src/lib/api/core.ts` | ✅ Fait | Interceptors auth + refresh + retry déjà en place |
| `src/lib/api/types.ts` | ✅ Fait | Types étendus pour auth, catalogue, commandes, factures, messages, cart, checkout, search, media, analytics, legal, homepage |
| `src/lib/api/authApi.ts` | ✅ Fait | Auth complète: login, register, refresh, change password, forgot/reset password |
| `src/lib/api/usersApi.ts` | ✅ Fait | CRUD admin users + profil, adresses, moyens de paiement |
| `src/lib/api/productsApi.ts` | ✅ Fait | Endpoints réels + bulk + images + compat legacy |
| `src/lib/api/categoriesApi.ts` | ✅ Fait | CRUD + move + compat legacy |
| `src/lib/api/ordersApi.ts` | ✅ Fait | Liste, détail, status, invoice, refund + compat legacy |
| `src/lib/api/invoicesApi.ts` | ✅ Fait | Liste, PDF, export, crédit note + compat legacy |
| `src/lib/api/messagesApi.ts` | ✅ Fait | Liste, détail, status, reply, delete + compat legacy |
| `src/lib/api/index.ts` | ✅ Fait | Exports centralisés complétés |
| `src/lib/api/cartApi.ts` | ✅ Fait | Module ajouté |
| `src/lib/api/checkoutApi.ts` | ✅ Fait | Module ajouté |
| `src/lib/api/searchApi.ts` | ✅ Fait | Module ajouté |
| `src/lib/api/mediaApi.ts` | ✅ Fait | Module ajouté |
| `src/lib/api/analyticsApi.ts` | ✅ Fait | Module ajouté |
| `src/lib/api/legalApi.ts` | ✅ Fait | Module ajouté |
| `src/lib/api/homepageApi.ts` | ✅ Fait | Module ajouté |
| `src/lib/api/client.ts` | ✅ Fait | Entrypoint de compatibilité ajouté |

**Durée estimée : 0 min**

#### 🟠 **PHASE 2 : Hooks personnalisés**

| Hook | Fichier | Status | Action |
|------|---------|--------|--------|
| `useApi` | `src/hooks/useApi.ts` | ✅ Complété | Hook générique avec loading/error/data |
| `useAuth` | `src/hooks/useAuth.ts` | ✅ Complété | Hook auth avec login/logout/user state |
| `useApiWithError` | `src/hooks/useApiWithError.ts` | ✅ Complété | Gestion détaillée des erreurs |

**Durée estimée : 20 min** → ✅ **COMPLÉTÉE**

#### 🟡 **PHASE 3 : Contexte & Authentification**

| Fichier | Status | Action |
|---------|--------|--------|
| `src/contexts/AuthContext.tsx` | ✅ Complété | Provider global pour auth state |
| `src/lib/storageManager.ts` | ✅ Complété | Gestionnaire localStorage/tokens |
| `src/lib/protectedRoute.tsx` | ✅ Complété | HOC pour protéger routes |
| `src/app/layout.tsx` | ✅ Complété | Providers intégrés |

**Durée estimée : 0 min** → ✅ **COMPLÉTÉE**

#### 🟢 **PHASE 4 : Pages & Composants UI**

| Page | Fichier | Status | Action |
|---|---|---|---|
| Categories | `src/app/(dashboard)/categories/page.tsx` | ✅ Migré | Charge et mutates via `categoriesApi` |
| Products | `src/app/(dashboard)/products/page.tsx` | ✅ Migré | Charge et mutates via `productsApi` |
| Orders | `src/app/(dashboard)/orders/page.tsx` | ✅ Migré | Charge via `ordersApi` |
| Invoices | `src/app/(dashboard)/invoices/page.tsx` | ✅ Migré | Charge via `invoicesApi` |
| Users | `src/app/(dashboard)/users/page.tsx` | ✅ Migré | Charge et mutates via `usersApi` |
| Messages | `src/app/(dashboard)/messages/page.tsx` | ✅ Migré | Charge et mutates via `messagesApi` |

**Durée estimée : 0 min**

---

### 📈 **Progression globale**

```
✅ Documenté 100%        ████████████████████ 100%
├─ ✅ Plan complet
├─ ✅ Patterns définis
├─ ✅ Types pensés
└─ ✅ Checklists prêtes

🚀 Implémentation code    ███████████████████░░  90%
├─ ✅ authApi.ts
├─ ✅ usersApi.ts
├─ ✅ productsApi.ts
├─ ✅ categoriesApi.ts
├─ ✅ ordersApi.ts
├─ ✅ invoicesApi.ts
├─ ✅ messagesApi.ts
├─ ✅ cartApi.ts / checkoutApi.ts / searchApi.ts
├─ ✅ mediaApi.ts / analyticsApi.ts / legalApi.ts / homepageApi.ts
└─ ✅ client.ts / index.ts

📦 Infrastructure        ████████████████████  100%
├─ ✅ Interceptors Axios
├─ ✅ Types complets
├─ ✅ Hooks React
├─ ✅ Contexte Auth
└─ ✅ Routes protégées

🎯 Total du projet       ████████████████░░░░  80%
```

---

### 🎯 **Ordre d'implémentation recommandé**

```
1. PHASE 1 (Infrastructure) ........... ✅ COMPLÉTÉE
  └─ core.ts + types.ts + interceptors

2. PHASE 2 (Hooks) ................... ✅ COMPLÉTÉE
  └─ useApi + useAuth + useApiWithError

3. PHASE 3 (APIs Services) ........... ✅ COMPLÉTÉE
  └─ authApi + usersApi + ordersApi + invoicesApi + messagesApi + productsApi + modules additionnels

4. PHASE 4 (Contexte) ............... ✅ COMPLÉTÉE
  └─ AuthContext + StorageManager + protectedRoute

5. PHASE 5 (Pages UI) ............... ✅ COMPLÉTÉE
  └─ Pages dashboard branchées sur l'API avec compat legacy restante uniquement

─────────────────────────
TOTAL ESTIMÉ : ~10-15 min restantes pour les derniers nettoyages ⏱️
─────────────────────────
```

---

### ✨ **Points clés à retenir**

1. **Chaque modification** doit suivre les patterns définis (sections 3.1 à 3.3)
2. **Aucune donnée factice** ne doit rester dans les parcours critiques; ne conserver que des exemples isolés pour la documentation si nécessaire
3. **Tous les erreurs** HTTP gérées (401, 403, 404, 422, 429, 500)
4. **Loading states** obligatoires dans chaque composant UI
5. **Types stricts** — pas de `any` sauf nécessité absolue
6. **Documentation** — JSDoc sur chaque fonction API
7. **Tests manuels** — vérifier chaque endpoint avant merge

---

**Prêt à commencer ? Suivez cette checklist pour chaque nouveau module ✅**
