'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, ShoppingCart, Users, Package, Percent, CreditCard } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import type { AnalyticsOverview, InventoryStatsAnalytics } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import type { DateRange } from './AnalyticsFilters'

interface OverviewPanelProps {
  range?: DateRange
}

const formatPercent = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return null
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

const changeColor = (value: number | null | undefined) => {
  if (value == null) return 'text-gray-600'
  if (value > 0) return 'text-status-success'
  if (value < 0) return 'text-status-error'
  return 'text-gray-600'
}

export default function OverviewPanel({ range }: OverviewPanelProps) {
  const [overview, setOverview] = useState<AnalyticsOverview['overview'] | null>(null)
  const [inventory, setInventory] = useState<InventoryStatsAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      const params = range ? { startDate: range.startDate, endDate: range.endDate } : undefined
      try {
        const [overviewRes, inventoryRes] = await Promise.allSettled([
          analyticsApi.getOverview(params),
          analyticsApi.getInventoryStats(params),
        ])

        if (cancelled) return

        if (overviewRes.status === 'fulfilled') {
          setOverview(overviewRes.value.overview)
        } else {
          console.error('Erreur overview:', overviewRes.reason)
          setError('Impossible de charger les KPI globaux.')
          setOverview(null)
        }

        if (inventoryRes.status === 'fulfilled') {
          setInventory(inventoryRes.value)
        } else {
          setInventory(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [range?.startDate, range?.endDate])

  if (isLoading && !overview) {
    return <p className="text-sm text-gray-500">Chargement des KPI globaux…</p>
  }

  if (error && !overview) {
    return <p className="text-sm text-status-error">{error}</p>
  }

  if (!overview) {
    return <p className="text-sm text-gray-500">Aucune donnée analytics disponible.</p>
  }

  const revenueTotal = Number(overview.totalRevenue) || 0
  const ordersTotal = Number(overview.totalOrders) || 0
  const customersTotal = Number(overview.totalUsers) || 0
  const customersNew = Number(overview.newUsers) || 0
  const productsTotal = Number(overview.totalProducts) || 0

  const aovFromApi = Number(overview.averageOrderValue) || 0
  const aovComputed = ordersTotal > 0 ? revenueTotal / ordersTotal : null
  const hasApiAov = aovFromApi > 0
  const aovDisplay = hasApiAov ? aovFromApi : aovComputed

  const conversionRate = overview.conversionRate
  const hasConversion = Number.isFinite(conversionRate) && conversionRate != null

  const revenueChange = formatPercent(overview.revenueGrowth)

  const outOfStockCount = inventory?.top10ImmobilizedStock
    ? inventory.top10ImmobilizedStock.filter((item) => (item.stock ?? 0) === 0).length
    : 0

  const stockValue = inventory?.totalStockValue ?? null

  const cards = [
    {
      name: 'CA période',
      value: formatCurrency(revenueTotal),
      change: revenueChange ?? 'Période courante',
      changeClass: changeColor(overview.revenueGrowth),
      icon: TrendingUp,
    },
    {
      name: 'Commandes',
      value: String(ordersTotal),
      change: 'Période courante',
      changeClass: 'text-gray-600',
      icon: ShoppingCart,
    },
    {
      name: 'Clients',
      value: String(customersTotal),
      change:
        customersNew > 0
          ? `${customersNew} nouveau${customersNew > 1 ? 'x' : ''} sur la période`
          : 'Période courante',
      changeClass: 'text-gray-600',
      icon: Users,
    },
    {
      name: 'Panier moyen',
      value: aovDisplay != null ? formatCurrency(aovDisplay) : '—',
      change: hasApiAov ? 'API' : aovComputed != null ? 'Calcul local (CA / cmd)' : 'Pas de données',
      changeClass: 'text-gray-600',
      icon: CreditCard,
    },
    {
      name: 'Taux de conversion',
      value: hasConversion ? `${conversionRate!.toFixed(2)}%` : '—',
      change: hasConversion ? 'Sessions → commandes' : 'Non exposé',
      changeClass: 'text-gray-600',
      icon: Percent,
    },
    {
      name: 'Catalogue',
      value: String(productsTotal),
      change:
        stockValue != null
          ? `Stock valorisé ${formatCurrency(stockValue)}`
          : 'Stock indisponible',
      changeClass: 'text-gray-600',
      icon: Package,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">KPI globaux</p>
        <h2 className="mt-1 text-xl font-heading font-semibold text-dark">
          Analyse de la période
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.name} className="app-panel p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">{card.name}</p>
                <p className="mt-2 text-3xl font-heading font-semibold text-dark">{card.value}</p>
                <p className={`mt-2 text-sm ${card.changeClass}`}>{card.change}</p>
              </div>
              <div className="rounded-2xl bg-primary-light p-3 ring-1 ring-primary/10">
                <card.icon className="h-6 w-6 text-primary" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {inventory && (outOfStockCount > 0 || inventory.neverSoldProducts > 0) && (
        <div className="app-panel border-status-warning/30 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-status-warning/10 p-2">
              <Package className="h-5 w-5 text-status-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-dark">Alertes inventaire</h3>
              <p className="mt-1 text-sm text-gray-600">
                Points de vigilance sur le catalogue.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {outOfStockCount > 0 && <Badge variant="error">{outOfStockCount} en rupture</Badge>}
                {inventory.neverSoldProducts > 0 && (
                  <Badge variant="warning">{inventory.neverSoldProducts} jamais vendus</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
