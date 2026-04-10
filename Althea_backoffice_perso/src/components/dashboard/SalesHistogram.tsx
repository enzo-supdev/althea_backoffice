'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { analyticsApi } from '@/lib/api'

type SalesChartPoint = {
  period: string
  revenue: number
  orders: number
}

const formatPeriodLabel = (period: string) => {
  const parsedDate = new Date(period)

  if (Number.isNaN(parsedDate.getTime())) {
    return period
  }

  return parsedDate.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  })
}

export default function SalesHistogram() {
  const [rangeMode, setRangeMode] = useState<'7d' | '5w'>('7d')
  const [sales, setSales] = useState<SalesChartPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadSales = async () => {
      setIsLoading(true)

      try {
        const response = await analyticsApi.getSales({ groupBy: rangeMode === '7d' ? 'day' : 'week' })
        const safeTimeline = Array.isArray(response?.sales?.timeline)
          ? response.sales.timeline
          : []

        if (!isMounted) {
          return
        }

        setSales(rangeMode === '7d' ? safeTimeline.slice(-7) : safeTimeline.slice(-5))
      } catch (error) {
        if (!isMounted) {
          return
        }

        console.error('❌ Erreur SalesHistogram:', error)
        setSales([])
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSales()

    return () => {
      isMounted = false
    }
  }, [rangeMode])

  const chartData = useMemo(
    () =>
      (sales ?? []).map((point) => ({
        label: formatPeriodLabel(point.period),
        revenue: point.revenue,
        orders: point.orders,
      })),
    [sales]
  )

  const hasData = chartData.length > 0

  return (
    <div className="app-panel p-5 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-heading font-semibold text-dark">
          Ventes (timeline API)
        </h2>
        <select
          className="input-base w-auto px-3 py-1"
          value={rangeMode}
          onChange={(event) => setRangeMode(event.target.value as '7d' | '5w')}
          aria-label="Periode du graphique ventes"
        >
          <option value="7d">7 jours</option>
          <option value="5w">5 semaines</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Chargement des ventes...</p>}

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
              formatter={(value, name) => {
                if (name === 'CA') {
                  return [`€${value}`, name]
                }

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
