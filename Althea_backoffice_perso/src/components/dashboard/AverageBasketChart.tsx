'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { analyticsApi } from '@/lib/api'

type BasketPoint = {
  label: string
  averageBasket: number
  revenue: number
  quantity: number
}

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

export default function AverageBasketChart() {
  const [period, setPeriod] = useState<'7d' | '5w'>('7d')
  const [sales, setSales] = useState<BasketPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadAverageBasket = async () => {
      setIsLoading(true)

      try {
        const limit = period === '7d' ? 7 : 12
        const response = (await analyticsApi.getProducts({ limit, sortBy: 'revenue' })) as ProductAnalyticsPayload
        const topSellers = response.productAnalytics?.topSellers ?? []

        if (!isMounted) {
          return
        }

        const mapped = topSellers
          .map((item, index) => {
            const revenue = getNumberValue(item, ['revenue', 'totalRevenue', 'sales']) ?? 0
            const quantity = getNumberValue(item, ['quantitySold', 'quantity']) ?? 0
            const averageBasket = quantity > 0 ? revenue / quantity : 0

            return {
              label:
                getStringValue(item, ['categoryName', 'category', 'name']) ??
                `Categorie ${index + 1}`,
              averageBasket: Number(averageBasket.toFixed(2)),
              revenue,
              quantity,
            }
          })
          .filter((item) => item.revenue > 0)

        setSales(mapped)
      } catch (error) {
        if (!isMounted) {
          return
        }
        setSales([])
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadAverageBasket()

    return () => {
      isMounted = false
    }
  }, [period])

  const hasData = useMemo(() => sales.length > 0, [sales])

  return (
    <div className="app-panel p-5 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-heading font-semibold text-dark">
            Panier moyen (API)
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Calculé à partir du CA et du nombre de commandes
          </p>
        </div>
        <select
          className="input-base w-auto px-3 py-1"
          value={period}
          onChange={(event) => setPeriod(event.target.value as '7d' | '5w')}
          aria-label="Periode du graphique paniers moyens"
        >
          <option value="7d">7 jours</option>
          <option value="5w">5 semaines</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Chargement du panier moyen...</p>}

      {!isLoading && !hasData && (
        <p className="text-sm text-gray-500">Aucune donnée disponible pour calculer le panier moyen.</p>
      )}

      {!isLoading && hasData && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sales}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'Panier moyen') {
                  return [`€${value}`, name]
                }

                if (name === 'CA categorie') {
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
            <Bar dataKey="averageBasket" fill="#00a8b5" name="Panier moyen" radius={[6, 6, 0, 0]} />
            <Bar dataKey="revenue" fill="#003d5c" name="CA categorie" radius={[6, 6, 0, 0]} />
            <Bar dataKey="quantity" fill="#10b981" name="Quantite" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
