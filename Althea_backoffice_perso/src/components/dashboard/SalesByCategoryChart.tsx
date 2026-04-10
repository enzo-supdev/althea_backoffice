'use client'

import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { analyticsApi } from '@/lib/api'

type PiePoint = {
  name: string
  value: number
  color: string
}

const chartColors = ['#00a8b5', '#003d5c', '#33bfc9', '#10b981', '#F59E0B', '#6366F1']

type ProductAnalyticsPayload = {
  productAnalytics?: {
    topSellers?: Array<Record<string, unknown>>
  }
}

const getStringValue = (input: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return null
}

const getNumberValue = (input: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return null
}

export default function SalesByCategoryChart() {
  const [period, setPeriod] = useState<'7d' | '5w'>('7d')
  const [rawData, setRawData] = useState<PiePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadProductAnalytics = async () => {
      setIsLoading(true)

      try {
        const limit = period === '7d' ? 7 : 15
        const response = (await analyticsApi.getProducts({ limit, sortBy: 'revenue' })) as ProductAnalyticsPayload
        const topSellers = response.productAnalytics?.topSellers ?? []

        const mapped = topSellers
          .map((item, index) => {
            const label =
              getStringValue(item, ['categoryName', 'category', 'name', 'productName']) ??
              `Segment ${index + 1}`

            const value =
              getNumberValue(item, ['revenue', 'totalRevenue', 'sales']) ??
              getNumberValue(item, ['quantitySold', 'quantity']) ??
              0

            return {
              name: label,
              value,
              color: chartColors[index % chartColors.length],
            }
          })
          .filter((item) => item.value > 0)

        if (!isMounted) {
          return
        }

        setRawData(mapped)
      } catch (error) {
        if (!isMounted) {
          return
        }

        console.error('❌ Erreur SalesByCategoryChart:', error)
        setRawData([])
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadProductAnalytics()

    return () => {
      isMounted = false
    }
  }, [period])

  const chartData = useMemo(() => {
    const total = rawData.reduce((sum, item) => sum + item.value, 0)
    if (total <= 0) {
      return []
    }

    return rawData.map((item) => ({
      ...item,
      percentage: Number(((item.value / total) * 100).toFixed(1)),
    }))
  }, [rawData])

  const hasData = chartData.length > 0

  return (
    <div className="app-panel p-5 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-heading font-semibold text-dark">
          Répartition des ventes (API)
        </h2>
        <select
          className="input-base w-auto px-3 py-1"
          value={period}
          onChange={(event) => setPeriod(event.target.value as '7d' | '5w')}
          aria-label="Periode du graphique ventes par categorie"
        >
          <option value="7d">7 jours</option>
          <option value="5w">5 semaines</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Chargement des catégories...</p>}

      {!isLoading && !hasData && (
        <p className="text-sm text-gray-500">Aucune donnée de répartition disponible.</p>
      )}

      {!isLoading && hasData && (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name: string, context: any) => {
                const payload = context?.payload
                const percentage = payload?.percentage ?? 0
                return [`${Number(value).toFixed(2)} EUR (${percentage}%)`, 'Montant']
              }}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '1px solid rgba(0, 168, 181, 0.16)',
                borderRadius: '12px',
                boxShadow: '0 16px 40px rgba(0, 61, 92, 0.12)',
              }}
            />
            <Legend wrapperStyle={{ paddingTop: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
