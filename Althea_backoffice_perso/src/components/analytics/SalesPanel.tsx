'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { analyticsApi } from '@/lib/api'
import type { SalesTimelinePoint, TopProductItem } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'
import type { DateRange } from './AnalyticsFilters'

type GroupBy = 'day' | 'week' | 'month'

interface SalesPanelProps {
  range: DateRange
  groupBy: GroupBy
  onGroupByChange: (value: GroupBy) => void
}

const formatPeriodLabel = (period: string, groupBy: GroupBy) => {
  const parsed = new Date(period)
  if (Number.isNaN(parsed.getTime())) {
    return period
  }

  if (groupBy === 'month') {
    return parsed.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
  }

  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function SalesPanel({ range, groupBy, onGroupByChange }: SalesPanelProps) {
  const [timeline, setTimeline] = useState<SalesTimelinePoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [salesRes, productsRes] = await Promise.allSettled([
          analyticsApi.getSales({
            startDate: range.startDate,
            endDate: range.endDate,
            groupBy,
          }),
          analyticsApi.getProducts({
            startDate: range.startDate,
            endDate: range.endDate,
            limit: 10,
          }),
        ])

        if (cancelled) return

        if (salesRes.status === 'fulfilled') {
          setTimeline(Array.isArray(salesRes.value.sales) ? salesRes.value.sales : [])
        } else {
          console.error('Erreur sales:', salesRes.reason)
          setError('Impossible de charger les ventes.')
          setTimeline([])
        }

        if (productsRes.status === 'fulfilled') {
          setTopProducts(productsRes.value.topRevenueProducts ?? productsRes.value.topSellingProducts ?? [])
        } else {
          setTopProducts([])
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [groupBy, range.startDate, range.endDate])

  const chartData = useMemo(
    () =>
      timeline.map((point) => ({
        label: formatPeriodLabel(point.period, groupBy),
        revenue: Number(point.revenue) || 0,
        orders: Number(point.orderCount) || 0,
      })),
    [timeline, groupBy]
  )

  const totals = useMemo(
    () =>
      timeline.reduce(
        (acc, point) => {
          acc.revenue += Number(point.revenue) || 0
          acc.orders += Number(point.orderCount) || 0
          return acc
        },
        { revenue: 0, orders: 0 }
      ),
    [timeline]
  )

  if (isLoading) {
    return <p className="text-sm text-gray-500">Chargement des ventes…</p>
  }

  if (error) {
    return <p className="text-sm text-status-error">{error}</p>
  }

  const aov = totals.orders > 0 ? totals.revenue / totals.orders : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="app-panel p-5">
          <p className="text-sm font-medium text-gray-600">CA total</p>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {formatCurrency(totals.revenue)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Somme de la timeline</p>
        </div>
        <div className="app-panel p-5">
          <p className="text-sm font-medium text-gray-600">Commandes</p>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">{totals.orders}</p>
        </div>
        <div className="app-panel p-5">
          <p className="text-sm font-medium text-gray-600">Panier moyen</p>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {totals.orders > 0 ? formatCurrency(aov) : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-500">CA / commandes</p>
        </div>
      </div>

      <div className="app-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-heading font-semibold text-dark">Timeline des ventes</h3>
          <select
            value={groupBy}
            onChange={(event) => onGroupByChange(event.target.value as GroupBy)}
            className="input-base w-auto px-3 py-1 text-sm"
            aria-label="Granularité"
          >
            <option value="day">Jour</option>
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
          </select>
        </div>

        {chartData.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune donnée pour cette période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" stroke="#6b7280" />
              <YAxis yAxisId="left" stroke="#00a8b5" />
              <YAxis yAxisId="right" orientation="right" stroke="#003d5c" />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'CA') return [formatCurrency(value), name]
                  return [value, name]
                }}
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.98)',
                  border: '1px solid rgba(0,168,181,0.16)',
                  borderRadius: '12px',
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#00a8b5" name="CA" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#003d5c" name="Commandes" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="app-panel p-5">
        <h3 className="mb-4 text-lg font-heading font-semibold text-dark">Top produits</h3>
        {topProducts.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun produit classé sur cette période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, topProducts.length * 36)}>
            <BarChart
              data={topProducts.map((p) => ({
                name: p.productName,
                revenue: Number(p.totalRevenue) || 0,
                qty: Number(p.quantitySold) || 0,
              }))}
              layout="vertical"
              margin={{ left: 60, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis type="category" dataKey="name" stroke="#6b7280" width={150} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'CA') return [formatCurrency(value), name]
                  return [value, name]
                }}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#00a8b5" name="CA" />
              <Bar dataKey="qty" fill="#003d5c" name="Quantité" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
