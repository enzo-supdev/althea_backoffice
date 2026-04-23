import { storageManager } from '../storageManager'

describe('storageManager.token', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stocke et récupère l\'access token', () => {
    storageManager.token.setAccessToken('access-abc')
    expect(storageManager.token.getAccessToken()).toBe('access-abc')
  })

  it('stocke et récupère le refresh token', () => {
    storageManager.token.setRefreshToken('refresh-abc')
    expect(storageManager.token.getRefreshToken()).toBe('refresh-abc')
  })

  it('hasTokens() exige access ET refresh', () => {
    expect(storageManager.token.hasTokens()).toBe(false)
    storageManager.token.setAccessToken('a')
    expect(storageManager.token.hasTokens()).toBe(false)
    storageManager.token.setRefreshToken('r')
    expect(storageManager.token.hasTokens()).toBe(true)
  })

  it('clear() supprime access et refresh', () => {
    storageManager.token.setAccessToken('a')
    storageManager.token.setRefreshToken('r')
    storageManager.token.clear()
    expect(storageManager.token.getAccessToken()).toBeNull()
    expect(storageManager.token.getRefreshToken()).toBeNull()
  })
})

describe('storageManager.user', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stocke et récupère un objet user sérialisé', () => {
    const user = { id: 'u-1', email: 'a@b.c', role: 'admin' }
    storageManager.user.setUser(user)
    expect(storageManager.user.getUser()).toEqual(user)
  })

  it('retourne null si pas d\'utilisateur', () => {
    expect(storageManager.user.getUser()).toBeNull()
  })

  it('clear() supprime l\'utilisateur', () => {
    storageManager.user.setUser({ id: 'x' })
    storageManager.user.clear()
    expect(storageManager.user.getUser()).toBeNull()
  })
})

describe('storageManager.preferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stocke et lit le thème', () => {
    storageManager.preferences.setTheme('dark')
    expect(storageManager.preferences.getTheme()).toBe('dark')
  })

  it('retourne null quand aucune préférence n\'est stockée', () => {
    expect(storageManager.preferences.getTheme()).toBeNull()
  })

  it('préserve les autres préférences lors d\'un setTheme', () => {
    localStorage.setItem(
      'althea_preferences',
      JSON.stringify({ language: 'fr', theme: 'light' }),
    )
    storageManager.preferences.setTheme('dark')
    const all = storageManager.preferences.getAll()
    expect(all).toEqual({ language: 'fr', theme: 'dark' })
  })
})

describe('storageManager.logout', () => {
  it('supprime toutes les clés althea_*', () => {
    storageManager.token.setAccessToken('a')
    storageManager.token.setRefreshToken('r')
    storageManager.user.setUser({ id: 'x' })
    storageManager.preferences.setTheme('dark')

    storageManager.logout()

    expect(localStorage.getItem('althea_access_token')).toBeNull()
    expect(localStorage.getItem('althea_refresh_token')).toBeNull()
    expect(localStorage.getItem('althea_user_data')).toBeNull()
    expect(localStorage.getItem('althea_preferences')).toBeNull()
  })
})
