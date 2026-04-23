'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, AlertTriangle } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import type { ProductsAnalytics, TopProductItem } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import type { DateRange } from './AnalyticsFilters'

type SortBy = 'revenue' | 'quantity'

interface ProductsPanelProps {
  range: DateRange
}

export default function ProductsPanel({ range }: ProductsPanelProps) {
  const [sortBy, setSortBy] = useState<SortBy>('revenue')
  const [limit, setLimit] = useState<number>(10)
  const [payload, setPayload] = useState<ProductsAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await analyticsApi.getProducts({
          startDate: range.startDate,
          endDate: range.endDate,
          limit,
        })
        if (!cancelled) setPayload(response)
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur products analytics:', err)
          setError('Impossible de charger les stats produits.')
          setPayload(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [range.startDate, range.endDate, limit])

  if (isLoading) {
    return <p className="text-sm text-gray-500">Chargement des stats produits…</p>
  }

  if (error && !payload) {
    return <p className="text-sm text-status-error">{error}</p>
  }

  const topProducts: TopProductItem[] =
    sortBy === 'revenue'
      ? payload?.topRevenueProducts ?? []
      : payload?.topSellingProducts ?? []
  const outOfStock = payload?.outOfStockProducts ?? []
  const lowStock = payload?.lowStockProducts ?? []

  return (
    <div className="space-y-6">
      <div className="app-panel flex flex-wrap items-center gap-3 p-4">
        <label className="text-sm font-medium text-gray-600">Trier par</label>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortBy)}
          className="input-base px-3 py-1.5 text-sm"
        >
          <option value="revenue">Chiffre d&apos;affaires</option>
          <option value="quantity">Quantité vendue</option>
        </select>
        <label className="text-sm font-medium text-gray-600">Limite</label>
        <select
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
          className="input-base px-3 py-1.5 text-sm"
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      <div className="app-panel p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-heading font-semibold text-dark">
              {sortBy === 'revenue' ? 'Top produits par CA' : 'Top produits par quantité'}
            </h3>
          </div>
          <Badge variant="info" size="sm">Source : analytics</Badge>
        </div>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun produit classé pour cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-left text-gray-600">
                  <th className="py-2 pr-4 font-medium">Produit</th>
                  <th className="py-2 pr-4 font-medium">CA</th>
                  <th className="py-2 pr-4 font-medium">Quantité</th>
                  <th className="py-2 pr-4 font-medium">Prix moyen</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((item, index) => (
                  <tr key={item.productId ?? index} className="border-b border-primary/5">
                    <td className="py-2 pr-4 font-medium text-dark">{item.productName}</td>
                    <td className="py-2 pr-4 text-dark">{formatCurrency(item.totalRevenue ?? 0)}</td>
                    <td className="py-2 pr-4 text-gray-600">{item.quantitySold ?? 0}</td>
                    <td className="py-2 pr-4 text-gray-600">
                      {item.averagePrice != null ? formatCurrency(item.averagePrice) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <div className="app-panel p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-error" />
              <h3 className="text-lg font-heading font-semibold text-dark">Inventaire critique</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="error">Rupture</Badge>
                <span className="text-sm text-gray-600">{outOfStock.length} produit(s)</span>
              </div>
              {outOfStock.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun produit en rupture.</p>
              ) : (
                <ul className="space-y-1">
                  {outOfStock.slice(0, 10).map((item, index) => (
                    <li key={item.productId ?? index} className="text-sm text-dark">
                      {item.productName}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="warning">Stock bas</Badge>
                <span className="text-sm text-gray-600">{lowStock.length} produit(s)</span>
              </div>
              {lowStock.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun produit en stock bas.</p>
              ) : (
                <ul className="space-y-1">
                  {lowStock.slice(0, 10).map((item, index) => (
                    <li key={item.productId ?? index} className="flex justify-between text-sm text-dark">
                      <span>{item.productName}</span>
                      {item.stock != null && <span className="text-gray-500">{item.stock}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

