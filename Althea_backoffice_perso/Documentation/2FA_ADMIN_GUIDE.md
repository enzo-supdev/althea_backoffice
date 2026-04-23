# Guide 2FA Admin — Althea Systems API

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Flux complets](#3-flux-complets)
4. [Référence des endpoints](#4-référence-des-endpoints)
5. [Guide d'intégration frontend](#5-guide-dintégration-frontend)
6. [Sécurité](#6-sécurité)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Vue d'ensemble

Le 2FA (Two-Factor Authentication) est un mécanisme d'authentification à deux facteurs basé sur le protocole **TOTP** (Time-based One-Time Password, RFC 6238). Il est activable **uniquement pour les comptes admin**.

**Principe :** après avoir saisi son email et mot de passe, l'admin doit saisir un code à 6 chiffres généré par une application mobile (Google Authenticator, Authy, etc.). Ce code change toutes les 30 secondes.

**Comportement selon le profil :**

| Profil | Comportement au login |
|--------|-----------------------|
| Utilisateur standard | Login normal → `accessToken` + `refreshToken` directement |
| Admin sans 2FA activé | Login normal → `accessToken` + `refreshToken` directement |
| Admin avec 2FA activé | Login en deux étapes → `tempToken` puis code TOTP |

---

## 2. Architecture technique

### Bibliothèque

- **`otplib`** v12 — implémentation TOTP standard RFC 6238
- **`qrcode`** — génération du QR code en base64 data URL
- Compatible avec : Google Authenticator, Authy, Microsoft Authenticator, 1Password, Bitwarden

### Champs DB (déjà présents dans `User`)

```prisma
twoFaSecret   String?  // Secret TOTP encodé en base32 (nullable)
twoFaEnabled  Boolean  // 2FA activé ou non (défaut: false)
```

### Fichiers ajoutés / modifiés

| Fichier | Rôle |
|---------|------|
| `src/modules/auth/twoFa.service.ts` | Logique TOTP : génération secret, vérification code, setup/confirm/disable |
| `src/modules/auth/auth.service.ts` | `login()` modifié + `verifyTwoFaLogin()` ajouté |
| `src/modules/auth/auth.controller.ts` | 4 handlers 2FA + `login` mis à jour |
| `src/modules/auth/auth.routes.ts` | 4 routes 2FA |
| `src/modules/auth/auth.validator.ts` | 3 schémas Zod 2FA |
| `src/middlewares/rateLimiter.middleware.ts` | `twoFaLimiter` (5 req / 15 min) |

### Token temporaire (`tempToken`)

Le `tempToken` est un JWT court-lived distinct du token d'accès normal :

```json
{
  "id": "uuid-admin",
  "type": "2fa_pending",
  "exp": "<maintenant + 5 minutes>"
}
```

Il ne donne accès à **aucune route protégée**. Il sert uniquement à identifier l'admin entre l'étape 1 et l'étape 2 du login.

---

## 3. Flux complets

### 3.1 Login avec 2FA activé (2 étapes)

```
┌─────────┐                        ┌─────────┐                    ┌────────┐
│ Frontend│                        │   API   │                    │   DB   │
└────┬────┘                        └────┬────┘                    └───┬────┘
     │                                  │                             │
     │  POST /auth/login                │                             │
     │  { email, password }             │                             │
     │ ────────────────────────────────>│                             │
     │                                  │  findUnique(email)          │
     │                                  │ ───────────────────────────>│
     │                                  │<────────────────────────────│
     │                                  │                             │
     │                                  │  comparePassword()          │
     │                                  │  role=admin, twoFaEnabled=true
     │                                  │                             │
     │  { twoFaRequired: true,          │                             │
     │    tempToken: "eyJ..." }         │                             │
     │<─────────────────────────────────│                             │
     │                                  │                             │
     │  [Afficher écran code 2FA]       │                             │
     │                                  │                             │
     │  POST /auth/2fa/verify           │                             │
     │  { tempToken, code: "123456" }   │                             │
     │ ────────────────────────────────>│                             │
     │                                  │  verifyTempToken()          │
     │                                  │  findUnique(userId)         │
     │                                  │ ───────────────────────────>│
     │                                  │<────────────────────────────│
     │                                  │  verifyCode(secret, code)   │
     │                                  │  generateTokens()           │
     │                                  │  refreshToken.create()      │
     │                                  │ ───────────────────────────>│
     │  { user, accessToken,            │                             │
     │    refreshToken }                │                             │
     │<─────────────────────────────────│                             │
```

### 3.2 Setup 2FA (première activation)

```
┌─────────┐                        ┌─────────┐
│  Admin  │                        │   API   │
└────┬────┘                        └────┬────┘
     │                                  │
     │  POST /auth/2fa/setup            │
     │  Authorization: Bearer <token>   │
     │ ────────────────────────────────>│
     │                                  │  generateSecret()
     │                                  │  → secret base32 aléatoire
     │                                  │  → otpauth:// URI
     │                                  │  → QR code data URL (PNG base64)
     │                                  │  user.twoFaSecret = secret (DB)
     │                                  │  user.twoFaEnabled reste false
     │                                  │
     │  { secret, qrCodeDataUrl }       │
     │<─────────────────────────────────│
     │                                  │
     │  [Afficher QR code]              │
     │  [Admin scanne avec son app]     │
     │                                  │
     │  POST /auth/2fa/confirm          │
     │  { code: "123456" }              │
     │ ────────────────────────────────>│
     │                                  │  verifyCode(secret, code)
     │                                  │  user.twoFaEnabled = true (DB)
     │                                  │
     │  { success: true }               │
     │<─────────────────────────────────│
     │                                  │
     │  [2FA activé, login en 2 étapes] │
```

### 3.3 Désactivation 2FA

```
POST /auth/2fa/disable
{ code: "123456", password: "MonMotDePasse123" }

→ Vérifie le mot de passe (bcrypt)
→ Vérifie le code TOTP
→ twoFaEnabled = false, twoFaSecret = null
→ { success: true }
```

---

## 4. Référence des endpoints

### `POST /api/v1/auth/2fa/verify`

Vérifie le code TOTP et retourne les tokens d'accès définitifs.

**Authentification :** aucune (utilise le `tempToken` dans le body)

**Rate limiting :** 5 tentatives par 15 minutes par IP

**Request body :**
```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "code": "123456"
}
```

| Champ | Type | Contraintes |
|-------|------|-------------|
| `tempToken` | `string` | JWT `type: '2fa_pending'`, valide 5 min |
| `code` | `string` | Exactement 6 chiffres numériques |

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "admin@example.com",
      "firstName": "Jean",
      "lastName": "Dupont",
      "role": "admin",
      "status": "active",
      "twoFaEnabled": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Erreurs :**
| Code HTTP | Code erreur | Cause |
|-----------|-------------|-------|
| 400 | `VALIDATION_ERROR` | `code` absent ou non numérique |
| 401 | `INVALID_TOKEN` | `tempToken` invalide ou expiré (> 5 min) |
| 401 | `INVALID_CODE` | Code TOTP incorrect |
| 429 | `RATE_LIMIT_EXCEEDED` | Trop de tentatives (5 / 15 min) |
| 500 | `TWO_FA_VERIFY_FAILED` | Erreur serveur |

---

### `POST /api/v1/auth/2fa/setup`

Génère un secret TOTP et le QR code à scanner dans l'application mobile.

**Authentification :** JWT Bearer + rôle Admin

**Request body :** aucun

**Réponse 200 :**
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

| Champ | Description |
|-------|-------------|
| `secret` | Secret base32 à afficher en fallback (saisie manuelle dans l'app) |
| `qrCodeDataUrl` | Image PNG encodée en base64 — à injecter dans `<img src="...">` |

> **Important :** appeler `/setup` ne active pas encore le 2FA. Il faut confirmer avec `/confirm`. Tant que `/confirm` n'est pas appelé, `twoFaEnabled` reste `false`.

**Erreurs :**
| Code HTTP | Code erreur | Cause |
|-----------|-------------|-------|
| 401 | `UNAUTHORIZED` | Token absent ou expiré |
| 403 | `FORBIDDEN` | Rôle non admin |
| 500 | `TWO_FA_SETUP_FAILED` | Erreur serveur |

---

### `POST /api/v1/auth/2fa/confirm`

Confirme que l'application mobile lit correctement le secret, puis active le 2FA.

**Authentification :** JWT Bearer + rôle Admin

**Request body :**
```json
{
  "code": "123456"
}
```

| Champ | Type | Contraintes |
|-------|------|-------------|
| `code` | `string` | Exactement 6 chiffres numériques |

**Réponse 200 :**
```json
{
  "success": true,
  "data": { "success": true }
}
```

> Après cette réponse, tous les prochains logins de cet admin nécessiteront le code TOTP.

**Erreurs :**
| Code HTTP | Code erreur | Cause |
|-----------|-------------|-------|
| 400 | `TWO_FA_NOT_CONFIGURED` | `/setup` n'a pas été appelé avant |
| 401 | `INVALID_CODE` | Code incorrect (mauvais scan, décalage horloge) |
| 409 | `TWO_FA_ALREADY_ENABLED` | 2FA déjà activé |
| 500 | `TWO_FA_CONFIRM_FAILED` | Erreur serveur |

---

### `POST /api/v1/auth/2fa/disable`

Désactive le 2FA. Nécessite le code TOTP **et** le mot de passe courant.

**Authentification :** JWT Bearer + rôle Admin

**Request body :**
```json
{
  "code": "123456",
  "password": "MonMotDePasse123"
}
```

| Champ | Type | Contraintes |
|-------|------|-------------|
| `code` | `string` | Exactement 6 chiffres numériques |
| `password` | `string` | Mot de passe courant du compte |

**Réponse 200 :**
```json
{
  "success": true,
  "data": { "success": true }
}
```

> Après cette réponse, le login redevient à une seule étape. `twoFaSecret` est effacé de la DB.

**Erreurs :**
| Code HTTP | Code erreur | Cause |
|-----------|-------------|-------|
| 400 | `TWO_FA_NOT_ENABLED` | Le 2FA n'est pas activé |
| 401 | `INVALID_CREDENTIALS` | Mot de passe incorrect |
| 401 | `INVALID_CODE` | Code TOTP incorrect |
| 500 | `TWO_FA_DISABLE_FAILED` | Erreur serveur |

---

### `POST /api/v1/auth/login` — comportement modifié

Le endpoint login existant a un nouveau comportement conditionnel pour les admins.

**Réponse standard (inchangée) — utilisateur ou admin sans 2FA :**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Nouvelle réponse — admin avec 2FA activé :**
```json
{
  "success": true,
  "data": {
    "twoFaRequired": true,
    "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Le front détecte la présence de `twoFaRequired: true` pour afficher l'écran de saisie du code.

---

## 5. Guide d'intégration frontend

### Détecter si le 2FA est requis

```typescript
const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

const { data } = await response.json();

if (data.twoFaRequired) {
  // Stocker tempToken temporairement (state React, pas localStorage)
  setTempToken(data.tempToken);
  // Naviguer vers l'écran de saisie du code
  navigate('/admin/login/2fa');
} else {
  // Login normal
  storeTokens(data.accessToken, data.refreshToken);
  navigate('/admin/dashboard');
}
```

> **Ne jamais stocker le `tempToken` dans `localStorage` ou `sessionStorage`.** Le garder en mémoire (state React) uniquement. Il expire dans 5 minutes.

### Valider le code TOTP

```typescript
const verifyResponse = await fetch('/api/v1/auth/2fa/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tempToken, code }),
});

if (verifyResponse.status === 429) {
  // Afficher message : "Trop de tentatives, réessayez dans 15 minutes"
  return;
}

if (verifyResponse.status === 401) {
  const { error } = await verifyResponse.json();
  if (error.code === 'INVALID_TOKEN') {
    // tempToken expiré → renvoyer vers /login
    navigate('/admin/login');
  }
  if (error.code === 'INVALID_CODE') {
    // Code incorrect → afficher erreur, laisser ressaisir
    setError('Code incorrect');
  }
  return;
}

const { data } = await verifyResponse.json();
storeTokens(data.accessToken, data.refreshToken);
navigate('/admin/dashboard');
```

### Activer le 2FA (écran Settings admin)

```typescript
// Étape 1 : récupérer le QR code
const setupResponse = await fetch('/api/v1/auth/2fa/setup', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
});
const { data } = await setupResponse.json();

// Afficher le QR code
<img src={data.qrCodeDataUrl} alt="Scanner avec Google Authenticator" />
// Afficher le secret en fallback
<code>{data.secret}</code>

// Étape 2 : après scan, confirmer avec le code
const confirmResponse = await fetch('/api/v1/auth/2fa/confirm', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ code }),
});
```

### Désactiver le 2FA

```typescript
const response = await fetch('/api/v1/auth/2fa/disable', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ code, password }),
});
```

---

## 6. Sécurité

### Mesures en place

| Mesure | Détail |
|--------|--------|
| Rate limiting sur `/2fa/verify` | 5 tentatives par 15 min par IP — brute force bloqué |
| `tempToken` court-lived | Expire en 5 minutes, type JWT distinct (`2fa_pending`) |
| `tempToken` sans accès API | Ne passe pas `authMiddleware`, inutilisable sur les routes protégées |
| Désactivation double facteur | Nécessite code TOTP **et** mot de passe — empêche une prise de contrôle si session volée |
| Secret effacé à la désactivation | `twoFaSecret = null` en DB, re-setup obligatoire si réactivation |
| TOTP standard RFC 6238 | Fenêtre de 30 secondes, algorithme HMAC-SHA1, 6 chiffres |

### Recommandations

- Forcer le 2FA pour tous les nouveaux admins via un middleware dédié si besoin
- Logger les tentatives 2FA échouées (audit trail) — non implémenté actuellement
- Stocker le `tempToken` côté frontend en mémoire (state React) uniquement, jamais en storage persistant
- Implémenter des codes de secours (backup codes) si l'admin perd accès à son app — non implémenté actuellement

---

## 7. Troubleshooting

### "Code incorrect" alors que l'app affiche un code

**Cause probable :** décalage d'horloge entre le serveur et l'appareil mobile. TOTP repose sur l'heure système. Si l'écart dépasse ~30 secondes, le code est rejeté.

**Solution :**
- Vérifier que l'heure système du serveur est synchronisée (NTP)
- Sur l'app mobile : aller dans Paramètres → Correction de l'heure (Google Authenticator) ou activer la synchronisation automatique

### "Token temporaire expiré"

Le `tempToken` expire après 5 minutes. L'admin doit relancer le login complet (email + mot de passe puis code).

**Solution frontend :** détecter `INVALID_TOKEN` et rediriger vers `/login` avec un message explicatif.

### "Le 2FA n'est pas configuré" lors de `/confirm`

Appeler `/setup` avant `/confirm`. Le setup initialise le secret en DB, sans lequel la confirmation est impossible.

### Impossible de désactiver le 2FA (app perdue)

Si l'admin a perdu son application mobile, la désactivation via l'API est impossible (le code TOTP est requis). Action à effectuer directement en base de données par un super-admin :

```sql
UPDATE users
SET two_fa_enabled = false, two_fa_secret = NULL
WHERE id = '<uuid-admin>';
```

> Cette opération doit être tracée dans les logs d'administration.
