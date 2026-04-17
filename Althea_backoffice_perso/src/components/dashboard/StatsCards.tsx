'use client'

import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, ShoppingCart, AlertTriangle, MessageSquare } from 'lucide-react'
import { analyticsApi, messagesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { AnalyticsOverview } from '@/lib/api/types'
import Badge from '@/components/ui/Badge'

type StatItem = {
  name: string
  value: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  icon: typeof TrendingUp
  highlight?: 'danger'
  dangerBadge?: string
}

const neutralStats: StatItem[] = [
  {
    name: 'CA jour / semaine / mois',
    value: '--',
    change: 'Données indisponibles',
    changeType: 'neutral',
    icon: TrendingUp,
  },
  {
    name: 'Commandes du jour',
    value: '--',
    change: 'Données indisponibles',
    changeType: 'neutral',
    icon: ShoppingCart,
  },
  {
    name: 'Alertes stock',
    value: '--',
    change: 'Données indisponibles',
    changeType: 'neutral',
    icon: AlertTriangle,
  },
  {
    name: 'Messages non traités',
    value: '--',
    change: 'Données indisponibles',
    changeType: 'neutral',
    icon: MessageSquare,
  },
]

const formatSignedPercent = (value: number) => {
  if (Number.isNaN(value)) {
    return '0%'
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export default function StatsCards() {
  const [overview, setOverview] = useState<AnalyticsOverview['overview'] | null>(null)
  const [unreadMessages, setUnreadMessages] = useState<number | null>(null)
  const [salesTimeline, setSalesTimeline] = useState<Array<{ period: string; revenue: number; orders: number }>>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadStats = async () => {
      setIsLoading(true)

      const [overviewResult, messagesResult, salesResult] = await Promise.allSettled([
        analyticsApi.getOverview(),
        messagesApi.list(),
        analyticsApi.getSales({ groupBy: 'day' }),
      ])

      if (!isMounted) {
        return
      }

      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value.overview)
      } else {
        console.error('❌ Erreur overview:', overviewResult.reason)
        setOverview(null)
      }

      if (messagesResult.status === 'fulfilled') {
        setUnreadMessages(messagesResult.value.filter((message: { status: string }) => message.status === 'unread').length)
      } else {
        console.error('❌ Erreur messages:', messagesResult.reason)
        setUnreadMessages(null)
      }

      if (salesResult.status === 'fulfilled') {
        setSalesTimeline(Array.isArray(salesResult.value?.sales?.timeline) ? salesResult.value.sales.timeline : [])
      } else {
        console.error('❌ Erreur sales:', salesResult.reason)
        setSalesTimeline([])
      }

      setIsLoading(false)
    }

    void loadStats()

    return () => {
      isMounted = false
    }
  }, [])

  const stats = useMemo<StatItem[]>(() => {
    if (!overview) {
      return neutralStats
    }

    const orderedTimeline = [...salesTimeline].sort(
      (left, right) => new Date(left.period).getTime() - new Date(right.period).getTime()
    )

    const lastPoint = orderedTimeline[orderedTimeline.length - 1]
    const last7Points = orderedTimeline.slice(-7)
    const last30Points = orderedTimeline.slice(-30)

    const dayRevenue = lastPoint?.revenue ?? 0
    const weekRevenue = last7Points.reduce((sum, point) => sum + point.revenue, 0)
    const monthRevenue = last30Points.reduce((sum, point) => sum + point.revenue, 0)
    const ordersToday = lastPoint?.orders ?? 0

    const lowStock = overview.products?.lowStock ?? 0
    const outOfStock = overview.products?.outOfStock ?? 0
    const stockAlerts = lowStock + outOfStock
    const revenueChange = overview.revenue?.change ?? 0
    const ordersChange = overview.orders?.change ?? 0

    return [
      {
        name: 'CA jour / semaine / mois',
        value: `${formatCurrency(dayRevenue)} / ${formatCurrency(weekRevenue)} / ${formatCurrency(monthRevenue)}`,
        change: formatSignedPercent(revenueChange),
        changeType: revenueChange >= 0 ? 'positive' : 'negative',
        icon: TrendingUp,
      },
      {
        name: 'Commandes du jour',
        value: String(ordersToday),
        change: formatSignedPercent(ordersChange),
        changeType: ordersChange >= 0 ? 'positive' : 'negative',
        icon: ShoppingCart,
      },
      {
        name: 'Alertes stock',
        value: String(stockAlerts),
        change:
          outOfStock > 0
            ? `${outOfStock} rupture${outOfStock > 1 ? 's' : ''}`
            : 'Stock stable',
        changeType: outOfStock > 0 ? 'negative' : 'neutral',
        icon: AlertTriangle,
        highlight: outOfStock > 0 ? 'danger' : undefined,
        dangerBadge: stockAlerts > 0 ? `${stockAlerts}` : undefined,
      },
      {
        name: 'Messages non traités',
        value: unreadMessages === null ? '--' : String(unreadMessages),
        change: unreadMessages === null ? 'Données indisponibles' : 'Messages en attente',
        changeType: 'neutral',
        icon: MessageSquare,
        highlight: (unreadMessages ?? 0) > 0 ? 'danger' : undefined,
        dangerBadge: (unreadMessages ?? 0) > 0 ? String(unreadMessages) : undefined,
      },
    ]
  }, [overview, salesTimeline, unreadMessages])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.name}
          className={`app-panel p-5 shadow-sm ${stat.highlight === 'danger' ? 'ring-1 ring-status-error/40' : ''}`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                {stat.dangerBadge && (
                  <Badge variant="error">{stat.dangerBadge}</Badge>
                )}
              </div>
              <p className="mt-2 text-3xl font-heading font-semibold text-dark">
                {isLoading ? '...' : stat.value}
              </p>
              <p
                className={`mt-2 text-sm ${
                  stat.changeType === 'positive'
                    ? 'text-status-success'
                    : stat.changeType === 'negative'
                    ? 'text-status-error'
                    : 'text-gray-600'
                }`}
              >
                {stat.change}
              </p>
            </div>
            <div className="rounded-2xl bg-primary-light p-3 ring-1 ring-primary/10">
              <stat.icon className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
