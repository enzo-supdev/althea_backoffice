'use client'

import { useEffect, useState } from 'react'
import { Package, Warehouse, AlertOctagon } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import type { InventoryStatsAnalytics } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import type { DateRange } from './AnalyticsFilters'

interface InventoryPanelProps {
  range: DateRange
}

const statusVariant = (status: string): 'info' | 'success' | 'warning' | 'error' => {
  if (status === 'published') return 'success'
  if (status === 'archived') return 'error'
  if (status === 'draft') return 'warning'
  return 'info'
}

export default function InventoryPanel({ range }: InventoryPanelProps) {
  const [data, setData] = useState<InventoryStatsAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await analyticsApi.getInventoryStats({
          startDate: range.startDate,
          endDate: range.endDate,
        })
        if (!cancelled) setData(response)
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur inventory-stats:', err)
          setError('Impossible de charger l&apos;inventaire.')
          setData(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [range.startDate, range.endDate])

  if (isLoading) {
    return <p className="text-sm text-gray-500">Chargement de l&apos;inventaire…</p>
  }

  if (error || !data) {
    return <p className="text-sm text-status-error">{error ?? 'Données indisponibles.'}</p>
  }

  const topImmobilized = data.top10ImmobilizedStock ?? []
  const byStatus = data.byProductStatus ?? []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Valeur totale du stock</p>
            <Warehouse className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {formatCurrency(data.totalStockValue ?? 0)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Prix × stock sur tous les produits</p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Jamais vendus</p>
            <AlertOctagon className="h-5 w-5 text-status-warning" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {data.neverSoldProducts ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">Produits sans vente sur la période</p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Statuts catalogue</p>
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {byStatus.length === 0 ? (
              <span className="text-sm text-gray-500">Aucun produit</span>
            ) : (
              byStatus.map((entry) => (
                <Badge key={entry.status} variant={statusVariant(entry.status)} size="sm">
                  {entry.status} · {entry.count}
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="app-panel p-5">
        <h3 className="mb-4 text-lg font-heading font-semibold text-dark">
          Top 10 stock immobilisé
        </h3>
        {topImmobilized.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun stock significatif à signaler.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-left text-gray-600">
                  <th className="py-2 pr-4 font-medium">Produit</th>
                  <th className="py-2 pr-4 font-medium">Stock</th>
                  <th className="py-2 pr-4 font-medium">Prix</th>
                  <th className="py-2 pr-4 font-medium">Valeur immobilisée</th>
                </tr>
              </thead>
              <tbody>
                {topImmobilized.map((item, index) => (
                  <tr key={item.productId ?? index} className="border-b border-primary/5">
                    <td className="py-2 pr-4 font-medium text-dark">{item.productName}</td>
                    <td className="py-2 pr-4 text-gray-600">{item.stock}</td>
                    <td className="py-2 pr-4 text-gray-600">{formatCurrency(item.price ?? 0)}</td>
                    <td className="py-2 pr-4 font-semibold text-dark">
                      {formatCurrency(item.immobilizedValue ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
