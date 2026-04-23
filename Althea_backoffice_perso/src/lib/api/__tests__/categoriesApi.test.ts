import { categoriesApi } from '../categoriesApi'
import axiosInstance from '../axiosInstance'

jest.mock('../axiosInstance', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
  },
}))

const mockedInstance = axiosInstance as unknown as {
  post: jest.Mock
  get: jest.Mock
  patch: jest.Mock
  delete: jest.Mock
  put: jest.Mock
}

describe('categoriesApi', () => {
  beforeEach(() => {
    Object.values(mockedInstance).forEach((fn: any) => fn.mockReset?.())
  })

  const rawCategory = {
    id: 'c-1',
    name: 'Chirurgie',
    description: 'Instruments',
    slug: 'chirurgie',
    displayOrder: 0,
    status: 'active',
    createdAt: '2026-04-01T10:00:00Z',
    updatedAt: '2026-04-02T10:00:00Z',
  }

  it('list() mappe displayOrder vers order et parse les dates', async () => {
    mockedInstance.get.mockResolvedValueOnce({
      data: { success: true, data: [rawCategory] },
    })
    const result = await categoriesApi.list()
    expect(mockedInstance.get).toHaveBeenCalledWith('/categories')
    expect(result[0].order).toBe(0)
    expect(result[0].createdAt).toBeInstanceOf(Date)
    expect(result[0].updatedAt).toBeInstanceOf(Date)
  })

  it('listAdmin() tape /categories/admin', async () => {
    mockedInstance.get.mockResolvedValueOnce({ data: { success: true, data: [] } })
    await categoriesApi.listAdmin()
    expect(mockedInstance.get).toHaveBeenCalledWith('/categories/admin')
  })

  it('listPaginated() transmet les paramètres', async () => {
    mockedInstance.get.mockResolvedValueOnce({
      data: { success: true, data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } },
    })
    await categoriesApi.listPaginated({ page: 2, limit: 10, sortBy: 'name', sortOrder: 'asc' })
    expect(mockedInstance.get).toHaveBeenCalledWith(
      '/categories/admin',
      { params: { page: 2, limit: 10, sortBy: 'name', sortOrder: 'asc' } },
    )
  })

  it('getById() trouve la catégorie dans la liste admin', async () => {
    mockedInstance.get.mockResolvedValueOnce({
      data: { success: true, data: [rawCategory] },
    })
    const result = await categoriesApi.getById('c-1')
    expect(result.id).toBe('c-1')
    expect(result.order).toBe(0)
  })

  it('getById() rejette si introuvable', async () => {
    mockedInstance.get.mockResolvedValueOnce({
      data: { success: true, data: [] },
    })
    await expect(categoriesApi.getById('missing')).rejects.toThrow(/introuvable/)
  })
})
