'use client'

import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Clock, PackageCheck, Ban } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import type { OrdersStatsAnalytics } from '@/lib/api/types'
import Badge from '@/components/ui/Badge'
import type { DateRange } from './AnalyticsFilters'

const orderStatusColors: Record<string, string> = {
  pending: '#F59E0B',
  processing: '#00a8b5',
  shipped: '#6366F1',
  completed: '#10b981',
  delivered: '#10b981',
  cancelled: '#EF4444',
}

const paymentStatusColors: Record<string, string> = {
  paid: '#10b981',
  pending: '#F59E0B',
  failed: '#EF4444',
  refunded: '#6366F1',
}

interface OrdersStatsPanelProps {
  range: DateRange
}

const formatHours = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value < 24) return `${value.toFixed(1)}h`
  return `${(value / 24).toFixed(1)}j`
}

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1)

export default function OrdersStatsPanel({ range }: OrdersStatsPanelProps) {
  const [data, setData] = useState<OrdersStatsAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await analyticsApi.getOrdersStats({
          startDate: range.startDate,
          endDate: range.endDate,
        })
        if (!cancelled) setData(response)
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur orders-stats:', err)
          setError('Impossible de charger les statistiques commandes.')
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
    return <p className="text-sm text-gray-500">Chargement des statistiques commandes…</p>
  }

  if (error || !data) {
    return <p className="text-sm text-status-error">{error ?? 'Données indisponibles.'}</p>
  }

  const byOrderStatus = (data.byOrderStatus ?? []).map((item) => ({
    ...item,
    label: statusLabel(item.status),
    color: orderStatusColors[item.status] ?? '#6b7280',
  }))
  const byPaymentStatus = (data.byPaymentStatus ?? []).map((item) => ({
    ...item,
    label: statusLabel(item.status),
    color: paymentStatusColors[item.status] ?? '#6b7280',
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Taux d&apos;annulation</p>
            <Ban className="h-5 w-5 text-status-error" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {(data.cancellationRate ?? 0).toFixed(2)}%
          </p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Délai de préparation</p>
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {formatHours(data.avgShippingDelayHours)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Pending → processing</p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Délai de livraison</p>
            <PackageCheck className="h-5 w-5 text-status-success" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {formatHours(data.avgDeliveryDelayHours)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Processing → completed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="app-panel p-5">
          <h3 className="mb-4 text-lg font-heading font-semibold text-dark">
            Répartition par statut commande
          </h3>
          {byOrderStatus.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune donnée sur la période.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byOrderStatus} dataKey="count" nameKey="label" outerRadius={90} label>
                  {byOrderStatus.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name, context: any) => {
                    const payload = context?.payload
                    const pct = payload?.percentage ?? 0
                    return [`${value} (${pct.toFixed(1)}%)`, 'Commandes']
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            {byOrderStatus.map((entry) => (
              <li key={entry.status} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden
                  />
                  {entry.label}
                </span>
                <span className="text-gray-600">
                  {entry.count} · {entry.percentage.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="app-panel p-5">
          <h3 className="mb-4 text-lg font-heading font-semibold text-dark">
            Répartition par statut paiement
          </h3>
          {byPaymentStatus.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune donnée sur la période.</p>
          ) : (
            <ul className="space-y-2">
              {byPaymentStatus.map((entry) => (
                <li
                  key={entry.status}
                  className="flex items-center justify-between rounded-lg bg-primary-light/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        entry.status === 'paid'
                          ? 'success'
                          : entry.status === 'failed'
                            ? 'error'
                            : entry.status === 'refunded'
                              ? 'info'
                              : 'warning'
                      }
                      size="sm"
                    >
                      {entry.label}
                    </Badge>
                  </div>
                  <span className="text-sm text-gray-700">
                    {entry.count} · {entry.percentage.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
