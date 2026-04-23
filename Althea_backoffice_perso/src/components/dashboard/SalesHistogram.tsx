'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { analyticsApi } from '@/lib/api'
import type { SalesTimelinePoint } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'

type RangeMode = '7d' | '5w'

const formatPeriodLabel = (period: string, mode: RangeMode) => {
  const parsedDate = new Date(period)
  if (Number.isNaN(parsedDate.getTime())) return period

  if (mode === '5w') {
    return parsedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  return parsedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function computeRange(days: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }
}

export default function SalesHistogram() {
  const [rangeMode, setRangeMode] = useState<RangeMode>('7d')
  const [sales, setSales] = useState<SalesTimelinePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadSales = async () => {
      setIsLoading(true)

      try {
        const days = rangeMode === '7d' ? 7 : 35
        const { startDate, endDate } = computeRange(days)
        const response = await analyticsApi.getSales({
          startDate,
          endDate,
          groupBy: rangeMode === '7d' ? 'day' : 'week',
        })
        if (!isMounted) return
        setSales(Array.isArray(response?.sales) ? response.sales : [])
      } catch (error) {
        if (!isMounted) return
        console.error('Erreur SalesHistogram:', error)
        setSales([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadSales()
    return () => {
      isMounted = false
    }
  }, [rangeMode])

  const chartData = useMemo(
    () =>
      sales.map((point) => ({
        label: formatPeriodLabel(point.period, rangeMode),
        revenue: Number(point.revenue) || 0,
        orders: Number(point.orderCount) || 0,
      })),
    [sales, rangeMode]
  )

  const hasData = chartData.length > 0

  return (
    <div className="app-panel p-5 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-heading font-semibold text-dark">Timeline des ventes</h2>
        <select
          className="input-base w-auto px-3 py-1"
          value={rangeMode}
          onChange={(event) => setRangeMode(event.target.value as RangeMode)}
          aria-label="Période du graphique ventes"
        >
          <option value="7d">7 jours</option>
          <option value="5w">5 semaines</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Chargement des ventes…</p>}

      {!isLoading && !hasData && (
        <p className="text-sm text-gray-500">Aucune donnée de vente disponible pour cette période.</p>
      )}

      {!isLoading && hasData && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'CA') return [formatCurrency(value), name]
                return [value, name]
              }}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '1px solid rgba(0, 168, 181, 0.16)',
                borderRadius: '12px',
                boxShadow: '0 16px 40px rgba(0, 61, 92, 0.12)',
              }}
            />
            <Legend wrapperStyle={{ paddingTop: 12 }} />
            <Bar dataKey="revenue" fill="#00a8b5" name="CA" />
            <Bar dataKey="orders" fill="#003d5c" name="Commandes" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
