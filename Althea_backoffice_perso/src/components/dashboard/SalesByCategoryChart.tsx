'use client'

import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { analyticsApi } from '@/lib/api'
import type { CategoryStatsItem } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'

const chartColors = ['#00a8b5', '#003d5c', '#33bfc9', '#10b981', '#F59E0B', '#6366F1', '#EF4444', '#8B5CF6']

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

export default function SalesByCategoryChart() {
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
        console.error('Erreur categories stats:', error)
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
      .map((item, index) => ({
        name: item.categoryName,
        value: Number(item.revenue) || 0,
        percentage: Number(item.revenuePercentage) || 0,
        color: chartColors[index % chartColors.length],
      }))
  }, [categories])

  const hasData = chartData.length > 0

  return (
    <div className="app-panel p-5 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-heading font-semibold text-dark">Répartition des ventes par catégorie</h2>
          <p className="mt-1 text-xs text-gray-500">Source : /analytics/admin/categories-stats</p>
        </div>
        <select
          className="input-base w-auto px-3 py-1"
          value={presetKey}
          onChange={(event) => setPresetKey(event.target.value as PresetKey)}
          aria-label="Période du graphique ventes par catégorie"
        >
          {Object.entries(presets).map(([key, preset]) => (
            <option key={key} value={key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Chargement des catégories…</p>}

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
              dataKey="value"
              label={(entry) => `${entry.name}`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name: string, context: any) => {
                const payload = context?.payload
                const percentage = payload?.percentage ?? 0
                return [`${formatCurrency(value)} (${percentage.toFixed(1)}%)`, 'CA']
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
