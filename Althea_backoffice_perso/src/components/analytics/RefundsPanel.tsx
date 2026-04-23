'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { RotateCcw, TrendingDown, FileText } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import type { RefundsStatsAnalytics } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'
import Badge from '@/components/ui/Badge'
import type { DateRange } from './AnalyticsFilters'

interface RefundsPanelProps {
  range: DateRange
}

const reasonLabel: Record<string, string> = {
  cancellation: 'Annulation',
  refund: 'Remboursement',
  error: 'Erreur',
}

const reasonColor: Record<string, string> = {
  cancellation: '#F59E0B',
  refund: '#EF4444',
  error: '#6366F1',
}

const formatMonth = (period: string) => {
  const [year, month] = period.split('-')
  if (!year || !month) return period
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

export default function RefundsPanel({ range }: RefundsPanelProps) {
  const [data, setData] = useState<RefundsStatsAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await analyticsApi.getRefundsStats({
          startDate: range.startDate,
          endDate: range.endDate,
        })
        if (!cancelled) setData(response)
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur refunds-stats:', err)
          setError('Impossible de charger les remboursements.')
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
    return <p className="text-sm text-gray-500">Chargement des remboursements…</p>
  }

  if (error || !data) {
    return <p className="text-sm text-status-error">{error ?? 'Données indisponibles.'}</p>
  }

  const byReason = (data.byReason ?? []).map((entry) => ({
    ...entry,
    label: reasonLabel[entry.reason] ?? entry.reason,
    color: reasonColor[entry.reason] ?? '#6b7280',
  }))

  const timeline = (data.monthlyTimeline ?? []).map((entry) => ({
    label: formatMonth(entry.month),
    amount: Number(entry.amount) || 0,
    count: Number(entry.count) || 0,
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Montant remboursé</p>
            <RotateCcw className="h-5 w-5 text-status-error" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {formatCurrency(data.totalAmount ?? 0)}
          </p>
          <p className="mt-1 text-xs text-gray-500">{data.totalCount ?? 0} avoirs sur la période</p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Taux de remboursement</p>
            <TrendingDown className="h-5 w-5 text-status-error" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {(data.refundRate ?? 0).toFixed(2)}%
          </p>
          <p className="mt-1 text-xs text-gray-500">Part du CA remboursée</p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Nombre d&apos;avoirs</p>
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {data.totalCount ?? 0}
          </p>
        </div>
      </div>

      <div className="app-panel p-5">
        <h3 className="mb-4 text-lg font-heading font-semibold text-dark">Ventilation par motif</h3>
        {byReason.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun avoir sur la période.</p>
        ) : (
          <ul className="space-y-2">
            {byReason.map((entry) => (
              <li
                key={entry.reason}
                className="flex items-center justify-between rounded-lg bg-primary-light/30 px-3 py-2 text-sm"
              >
                <Badge
                  variant={entry.reason === 'error' ? 'info' : entry.reason === 'refund' ? 'error' : 'warning'}
                  size="sm"
                >
                  {entry.label}
                </Badge>
                <div className="flex items-center gap-4 text-gray-700">
                  <span>{entry.count} avoirs</span>
                  <span className="font-semibold text-dark">{formatCurrency(entry.amount ?? 0)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="app-panel p-5">
        <h3 className="mb-4 text-lg font-heading font-semibold text-dark">Timeline mensuelle</h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune donnée de timeline.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" stroke="#6b7280" />
              <YAxis yAxisId="left" stroke="#EF4444" />
              <YAxis yAxisId="right" orientation="right" stroke="#003d5c" />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Montant') return [formatCurrency(value), name]
                  return [value, name]
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="amount" fill="#EF4444" name="Montant" />
              <Bar yAxisId="right" dataKey="count" fill="#003d5c" name="Avoirs" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
