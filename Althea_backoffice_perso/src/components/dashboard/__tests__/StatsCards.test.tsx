import { render, screen, waitFor } from '@testing-library/react'
import StatsCards from '../StatsCards'

jest.mock('@/lib/api', () => ({
  analyticsApi: {
    getOverview: jest.fn(),
    getContactStats: jest.fn(),
    getSales: jest.fn(),
    getInventoryStats: jest.fn(),
  },
  messagesApi: {
    list: jest.fn(),
  },
}))

import { analyticsApi, messagesApi } from '@/lib/api'

const mockedAnalytics = analyticsApi as jest.Mocked<typeof analyticsApi>
const mockedMessages = messagesApi as jest.Mocked<typeof messagesApi>

describe('<StatsCards />', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('affiche un état neutre quand toutes les requêtes échouent', async () => {
    mockedAnalytics.getOverview.mockRejectedValue(new Error('x'))
    mockedAnalytics.getContactStats.mockRejectedValue(new Error('x'))
    mockedAnalytics.getSales.mockRejectedValue(new Error('x'))
    mockedAnalytics.getInventoryStats.mockRejectedValue(new Error('x'))
    mockedMessages.list.mockRejectedValue(new Error('x'))

    render(<StatsCards />)

    await waitFor(() => {
      expect(screen.getByText('CA jour / 7j / 30j')).toBeInTheDocument()
    })

    expect(screen.getByText('Alertes stock')).toBeInTheDocument()
    expect(screen.getByText('Messages non traités')).toBeInTheDocument()
    expect(screen.getAllByText('Données indisponibles').length).toBeGreaterThan(0)
  })

  it('affiche un badge rouge quand il y a des ruptures de stock', async () => {
    mockedAnalytics.getOverview.mockResolvedValue({
      overview: { revenueGrowth: 5, totalRevenue: 1000, totalOrders: 10 } as any,
    } as any)
    mockedAnalytics.getContactStats.mockResolvedValue({
      byStatus: [{ status: 'NEW', count: 3 }],
      avgResponseTimeHours: 2.5,
    } as any)
    mockedAnalytics.getSales.mockResolvedValue({ sales: [] } as any)
    mockedAnalytics.getInventoryStats.mockResolvedValue({
      top10ImmobilizedStock: [
        { stock: 0, productId: 'p1' } as any,
        { stock: 0, productId: 'p2' } as any,
      ],
      neverSoldProducts: 1,
    } as any)

    render(<StatsCards />)

    await waitFor(() => {
      expect(screen.getByText(/2 ruptures/)).toBeInTheDocument()
    })

    // badge rouge (contenu "3" pour messages, "3" pour ruptures+neverSold)
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
  })

  it('utilise le fallback messagesApi.list quand getContactStats échoue', async () => {
    mockedAnalytics.getOverview.mockResolvedValue({ overview: {} } as any)
    mockedAnalytics.getContactStats.mockRejectedValue(new Error('fail'))
    mockedAnalytics.getSales.mockResolvedValue({ sales: [] } as any)
    mockedAnalytics.getInventoryStats.mockResolvedValue({
      top10ImmobilizedStock: [],
      neverSoldProducts: 0,
    } as any)
    mockedMessages.list.mockResolvedValue([
      { id: '1', status: 'unread' } as any,
      { id: '2', status: 'unread' } as any,
      { id: '3', status: 'read' } as any,
    ])

    render(<StatsCards />)

    await waitFor(() => {
      expect(mockedMessages.list).toHaveBeenCalled()
    })

    expect(await screen.findByText('Statut NEW')).toBeInTheDocument()
  })
})
