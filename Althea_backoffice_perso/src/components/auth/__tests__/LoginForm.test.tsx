import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../LoginForm'

const pushMock = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const loginMock = jest.fn()
const completeTwoFaLoginMock = jest.fn()
const logoutMock = jest.fn()
const clearErrorMock = jest.fn()
jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    login: loginMock,
    completeTwoFaLogin: completeTwoFaLoginMock,
    logout: logoutMock,
    clearError: clearErrorMock,
    error: null,
  }),
}))

describe('<LoginForm />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  it('redirige vers /dashboard en cas de login admin sans 2FA', async () => {
    loginMock.mockResolvedValueOnce({
      user: { role: 'admin', id: 'u-1' },
      accessToken: 'a',
      refreshToken: 'r',
    })

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'admin@althea.com')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/dashboard')
    })
    expect(logoutMock).not.toHaveBeenCalled()
  })

  it('refuse un compte non-admin (role !== admin) et force le logout', async () => {
    loginMock.mockResolvedValueOnce({
      user: { role: 'user', id: 'u-2' },
      accessToken: 'a',
      refreshToken: 'r',
    })

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'user@x.fr')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'Pwd123!')
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalled()
    })
    expect(screen.getByText(/Accès refusé/i)).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('affiche le champ OTP quand twoFaRequired est true', async () => {
    loginMock.mockResolvedValueOnce({
      twoFaRequired: true,
      tempToken: 'temp-42',
    })

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.c')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pwd')
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

    expect(await screen.findByText(/Verification 2FA requise/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Code a 6 chiffres/i)).toBeInTheDocument()
  })

  it('valide le 2FA et redirige vers /dashboard', async () => {
    loginMock.mockResolvedValueOnce({
      twoFaRequired: true,
      tempToken: 'temp-7',
    })
    completeTwoFaLoginMock.mockResolvedValueOnce({
      user: { role: 'admin', id: 'u-4' },
      accessToken: 'new-a',
      refreshToken: 'new-r',
    })

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.c')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pwd')
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

    const otpInput = await screen.findByPlaceholderText(/Code a 6 chiffres/i)
    await userEvent.type(otpInput, '123456')
    await userEvent.click(screen.getByRole('button', { name: /Valider le code/i }))

    await waitFor(() => {
      expect(completeTwoFaLoginMock).toHaveBeenCalledWith('temp-7', '123456')
    })
    expect(pushMock).toHaveBeenCalledWith('/dashboard')
  })

  it('affiche une erreur si la vérification 2FA échoue', async () => {
    loginMock.mockResolvedValueOnce({
      twoFaRequired: true,
      tempToken: 'temp-5',
    })
    completeTwoFaLoginMock.mockRejectedValueOnce(new Error('Code incorrect'))

    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.c')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pwd')
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

    const otpInput = await screen.findByPlaceholderText(/Code a 6 chiffres/i)
    await userEvent.type(otpInput, '000000')
    await userEvent.click(screen.getByRole('button', { name: /Valider le code/i }))

    expect(await screen.findByText(/Code incorrect/i)).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('rejette les caractères non numériques et limite à 6 chiffres dans le champ OTP', async () => {
    loginMock.mockResolvedValueOnce({
      twoFaRequired: true,
      tempToken: 'temp-6',
    })
    render(<LoginForm />)
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.c')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pwd')
    await userEvent.click(screen.getByRole('button', { name: /Se connecter/i }))

    const otpInput = (await screen.findByPlaceholderText(/Code a 6 chiffres/i)) as HTMLInputElement
    await userEvent.type(otpInput, 'abc1234567')
    expect(otpInput.value).toBe('123456')
  })
})
