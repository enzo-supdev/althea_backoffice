'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { analyticsApi } from '@/lib/api'
import type { CategoryStatsItem } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'

type PresetKey = '7d' | '30d' | '90d'

const presets: Record<PresetKey, { label: string; days: number }> = {
  '7d': { label: '7 jours', days: 7 },
  '30d': { label: '30 jours', days: 30 },
  '90d': { label: '90 jours', days: 90 },
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

export default function AverageBasketChart() {
  const [presetKey, setPresetKey] = useState<PresetKey>('30d')
  const [categories, setCategories] = useState<CategoryStatsItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadCategories = async () => {
      setIsLoading(true)
      try {
        const { startDate, endDate } = computeRange(presets[presetKey].days)
        const response = await analyticsApi.getCategoriesStats({
          startDate,
          endDate,
          limit: 12,
        })
        if (!isMounted) return
        setCategories(Array.isArray(response) ? response : [])
      } catch (error) {
        if (!isMounted) return
        console.error('Erreur categories stats (panier moyen):', error)
        setCategories([])
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadCategories()
    return () => {
      isMounted = false
    }
  }, [presetKey])

  const chartData = useMemo(() => {
    return categories
      .filter((item) => Number(item.revenue) > 0)
      .map((item) => {
        const revenue = Number(item.revenue) || 0
        const orders = Number(item.distinctOrderCount) || 0
        const quantity = Number(item.quantitySold) || 0
        return {
          label: item.categoryName,
          averageBasket: orders > 0 ? Number((revenue / orders).toFixed(2)) : 0,
          revenue,
          quantity,
        }
      })
  }, [categories])

  const hasData = chartData.length > 0

  return (
    <div className="app-panel p-5 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-heading font-semibold text-dark">Panier moyen par catégorie</h2>
          <p className="mt-1 text-sm text-gray-600">
            CA catégorie / nombre de commandes distinctes
          </p>
        </div>
        <select
          className="input-base w-auto px-3 py-1"
          value={presetKey}
          onChange={(event) => setPresetKey(event.target.value as PresetKey)}
          aria-label="Période du graphique paniers moyens"
        >
          {Object.entries(presets).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Chargement du panier moyen…</p>}

      {!isLoading && !hasData && (
        <p className="text-sm text-gray-500">Aucune donnée disponible pour calculer le panier moyen.</p>
      )}

      {!isLoading && hasData && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'Panier moyen' || name === 'CA catégorie') {
                  return [formatCurrency(value), name]
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
            <Bar dataKey="revenue" fill="#003d5c" name="CA catégorie" radius={[6, 6, 0, 0]} />
            <Bar dataKey="quantity" fill="#10b981" name="Quantité" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
