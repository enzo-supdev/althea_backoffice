import { authApi } from '../authApi'
import axiosInstance from '../axiosInstance'

jest.mock('../axiosInstance', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}))

const mockedInstance = axiosInstance as unknown as { post: jest.Mock; get: jest.Mock }

describe('authApi', () => {
  beforeEach(() => {
    mockedInstance.post.mockReset()
    mockedInstance.get.mockReset()
  })

  it('login() POST /auth/login et retourne data.data', async () => {
    const payload = {
      user: { id: 'u-1', email: 'a@b.c', role: 'admin' },
      accessToken: 'a',
      refreshToken: 'r',
    }
    mockedInstance.post.mockResolvedValueOnce({ data: { success: true, data: payload } })

    const result = await authApi.login({ email: 'a@b.c', password: 'pwd' })

    expect(mockedInstance.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.c',
      password: 'pwd',
    })
    expect(result).toEqual(payload)
  })

  it('register() POST /auth/register', async () => {
    mockedInstance.post.mockResolvedValueOnce({ data: { success: true, data: { user: {} } } })
    await authApi.register({ firstName: 'A', lastName: 'B', email: 'a@b.c', password: 'pwd' } as any)
    expect(mockedInstance.post).toHaveBeenCalledWith(
      '/auth/register',
      expect.objectContaining({ email: 'a@b.c' }),
    )
  })

  it('verifyEmail() GET /auth/verify-email/:token', async () => {
    mockedInstance.get.mockResolvedValueOnce({ data: { success: true, data: { message: 'ok' } } })
    const result = await authApi.verifyEmail('tok-123')
    expect(mockedInstance.get).toHaveBeenCalledWith('/auth/verify-email/tok-123')
    expect(result).toEqual({ message: 'ok' })
  })

  it('refreshToken() envoie le refresh token', async () => {
    mockedInstance.post.mockResolvedValueOnce({
      data: { success: true, data: { accessToken: 'new-a', refreshToken: 'new-r' } },
    })
    const result = await authApi.refreshToken('old-r')
    expect(mockedInstance.post).toHaveBeenCalledWith('/auth/refresh-token', { refreshToken: 'old-r' })
    expect(result.accessToken).toBe('new-a')
  })

  it('forgotPassword() POST /auth/forgot-password', async () => {
    mockedInstance.post.mockResolvedValueOnce({ data: { success: true, data: { message: 'sent' } } })
    await authApi.forgotPassword('a@b.c')
    expect(mockedInstance.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.c' })
  })

  it('resetPassword() POST /auth/reset-password/:token', async () => {
    mockedInstance.post.mockResolvedValueOnce({ data: { success: true, data: { message: 'done' } } })
    await authApi.resetPassword('tok-abc', 'NewPwd1!')
    expect(mockedInstance.post).toHaveBeenCalledWith('/auth/reset-password/tok-abc', {
      password: 'NewPwd1!',
    })
  })

  it('setupTwoFa() POST /auth/2fa/setup', async () => {
    mockedInstance.post.mockResolvedValueOnce({
      data: { success: true, data: { secret: 'JBSWY3DP', qrCodeDataUrl: 'data:image/png;base64,AAA' } },
    })
    const result = await authApi.setupTwoFa()
    expect(mockedInstance.post).toHaveBeenCalledWith('/auth/2fa/setup')
    expect(result).toEqual({ secret: 'JBSWY3DP', qrCodeDataUrl: 'data:image/png;base64,AAA' })
  })

  it('confirmTwoFa() POST /auth/2fa/confirm', async () => {
    mockedInstance.post.mockResolvedValueOnce({ data: { success: true, data: { success: true } } })
    await authApi.confirmTwoFa({ code: '123456' })
    expect(mockedInstance.post).toHaveBeenCalledWith('/auth/2fa/confirm', { code: '123456' })
  })

  it('verifyTwoFaLogin() POST /auth/2fa/verify avec tempToken + code', async () => {
    const payload = {
      user: { id: 'u-1', email: 'a@b.c', role: 'admin' },
      accessToken: 'a',
      refreshToken: 'r',
    }
    mockedInstance.post.mockResolvedValueOnce({ data: { success: true, data: payload } })
    const result = await authApi.verifyTwoFaLogin({ tempToken: 'temp-1', code: '123456' })
    expect(mockedInstance.post).toHaveBeenCalledWith('/auth/2fa/verify', {
      tempToken: 'temp-1',
      code: '123456',
    })
    expect(result).toEqual(payload)
  })

  it('disableTwoFa() POST /auth/2fa/disable avec code + mot de passe', async () => {
    mockedInstance.post.mockResolvedValueOnce({ data: { success: true, data: { success: true } } })
    await authApi.disableTwoFa({ code: '123456', password: 'Secret123!' })
    expect(mockedInstance.post).toHaveBeenCalledWith('/auth/2fa/disable', {
      code: '123456',
      password: 'Secret123!',
    })
  })

  it('logout() POST /auth/logout', async () => {
    mockedInstance.post.mockResolvedValueOnce({ data: { success: true, data: { message: 'bye' } } })
    await authApi.logout()
    expect(mockedInstance.post).toHaveBeenCalledWith('/auth/logout')
  })

  it('propage une erreur axios', async () => {
    mockedInstance.post.mockRejectedValueOnce(new Error('network'))
    await expect(authApi.login({ email: 'a@b.c', password: 'x' })).rejects.toThrow('network')
  })
})
