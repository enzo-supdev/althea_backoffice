/**
 * Gestion sécurisée du stockage (localStorage)
 * Tokens JWT, user data, preferences
 */

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'althea_access_token',
  REFRESH_TOKEN: 'althea_refresh_token',
  USER_DATA: 'althea_user_data',
  PREFERENCES: 'althea_preferences',
} as const;

export const storageManager = {
  /**
   * Tokens JWT
   */
  token: {
    setAccessToken(token: string): void {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
      }
    },

    getAccessToken(): string | null {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      }
      return null;
    },

    setRefreshToken(token: string): void {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
      }
    },

    getRefreshToken(): string | null {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      }
      return null;
    },

    clear(): void {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      }
    },

    hasTokens(): boolean {
      if (typeof window !== 'undefined') {
        return !!(
          localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) &&
          localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
        );
      }
      return false;
    },
  },

  /**
   * Données utilisateur (cache)
   */
  user: {
    setUser(user: any): void {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      }
    },

    getUser(): any {
      if (typeof window !== 'undefined') {
        const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        return data ? JSON.parse(data) : null;
      }
      return null;
    },

    clear(): void {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      }
    },
  },

  /**
   * Préférences utilisateur
   */
  preferences: {
    setTheme(theme: 'light' | 'dark'): void {
      if (typeof window !== 'undefined') {
        const prefs = this.getAll() || {};
        prefs.theme = theme;
        localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(prefs));
      }
    },

    getTheme(): 'light' | 'dark' | null {
      if (typeof window !== 'undefined') {
        const prefs = this.getAll();
        return prefs?.theme || null;
      }
      return null;
    },

    getAll(): any {
      if (typeof window !== 'undefined') {
        const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
        return data ? JSON.parse(data) : null;
      }
      return null;
    },

    clear(): void {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
      }
    },
  },

  /**
   * Logout complet
   */
  logout(): void {
    if (typeof window !== 'undefined') {
      Object.values(STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
    }
  },
};
