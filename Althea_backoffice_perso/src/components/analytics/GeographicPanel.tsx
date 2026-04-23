'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Globe, MapPin } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import type { GeographicStatsAnalytics } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'
import type { DateRange } from './AnalyticsFilters'

interface GeographicPanelProps {
  range: DateRange
}

export default function GeographicPanel({ range }: GeographicPanelProps) {
  const [limit, setLimit] = useState<number>(10)
  const [data, setData] = useState<GeographicStatsAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await analyticsApi.getGeographicStats({
          startDate: range.startDate,
          endDate: range.endDate,
          limit,
        })
        if (!cancelled) setData(response)
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur geographic-stats:', err)
          setError('Impossible de charger la répartition géographique.')
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
  }, [range.startDate, range.endDate, limit])

  if (isLoading) {
    return <p className="text-sm text-gray-500">Chargement de la répartition géographique…</p>
  }

  if (error || !data) {
    return <p className="text-sm text-status-error">{error ?? 'Données indisponibles.'}</p>
  }

  const countryData = (data.byCountry ?? []).map((entry) => ({
    country: entry.country,
    revenue: Number(entry.revenue) || 0,
    orders: Number(entry.orderCount) || 0,
    percentage: Number(entry.percentage) || 0,
  }))

  const topCities = data.topCities ?? []

  return (
    <div className="space-y-6">
      <div className="app-panel flex flex-wrap items-center gap-3 p-4">
        <label className="text-sm font-medium text-gray-600">Top villes</label>
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
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-heading font-semibold text-dark">CA par pays</h3>
        </div>
        {countryData.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune donnée géographique sur la période.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, countryData.length * 40)}>
            <BarChart data={countryData} layout="vertical" margin={{ left: 40, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis type="category" dataKey="country" stroke="#6b7280" width={80} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'CA') return [formatCurrency(value), name]
                  return [value, name]
                }}
              />
              <Bar dataKey="revenue" fill="#00a8b5" name="CA" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="app-panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-heading font-semibold text-dark">Top villes</h3>
        </div>
        {topCities.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune ville sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-left text-gray-600">
                  <th className="py-2 pr-4 font-medium">Ville</th>
                  <th className="py-2 pr-4 font-medium">Pays</th>
                  <th className="py-2 pr-4 font-medium">Commandes</th>
                  <th className="py-2 pr-4 font-medium">CA</th>
                </tr>
              </thead>
              <tbody>
                {topCities.map((city, index) => (
                  <tr key={`${city.city}-${index}`} className="border-b border-primary/5">
                    <td className="py-2 pr-4 font-medium text-dark">{city.city}</td>
                    <td className="py-2 pr-4 text-gray-600">{city.country}</td>
                    <td className="py-2 pr-4 text-gray-600">{city.orderCount}</td>
                    <td className="py-2 pr-4 text-dark">{formatCurrency(city.revenue ?? 0)}</td>
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
