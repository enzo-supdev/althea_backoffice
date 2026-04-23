'use client'

import { useEffect, useMemo, useState } from 'react'
import { TrendingUp, ShoppingCart, AlertTriangle, MessageSquare } from 'lucide-react'
import { analyticsApi, messagesApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type {
  AnalyticsOverview,
  InventoryStatsAnalytics,
  SalesTimelinePoint,
  ContactStatsAnalytics,
} from '@/lib/api/types'
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
    name: 'CA jour / 7j / 30j',
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
  if (!Number.isFinite(value)) return '0%'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

const startOfDay = (date: Date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

function sumTimelineOverDays(timeline: SalesTimelinePoint[], days: number): { revenue: number; orders: number } {
  const now = startOfDay(new Date())
  const threshold = new Date(now)
  threshold.setDate(threshold.getDate() - (days - 1))

  return timeline.reduce(
    (acc, point) => {
      const parsed = new Date(point.period)
      if (Number.isNaN(parsed.getTime())) return acc
      if (parsed >= threshold) {
        acc.revenue += Number(point.revenue) || 0
        acc.orders += Number(point.orderCount) || 0
      }
      return acc
    },
    { revenue: 0, orders: 0 }
  )
}

function todayPoint(timeline: SalesTimelinePoint[]): SalesTimelinePoint | null {
  const today = new Date()
  return (
    timeline.find((point) => {
      const parsed = new Date(point.period)
      return !Number.isNaN(parsed.getTime()) && isSameDay(parsed, today)
    }) ?? null
  )
}

export default function StatsCards() {
  const [overview, setOverview] = useState<AnalyticsOverview['overview'] | null>(null)
  const [inventory, setInventory] = useState<InventoryStatsAnalytics | null>(null)
  const [contactStats, setContactStats] = useState<ContactStatsAnalytics | null>(null)
  const [unreadFallback, setUnreadFallback] = useState<number | null>(null)
  const [salesTimeline, setSalesTimeline] = useState<SalesTimelinePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadStats = async () => {
      setIsLoading(true)

      const [overviewResult, contactStatsResult, salesResult, inventoryResult] = await Promise.allSettled([
        analyticsApi.getOverview(),
        analyticsApi.getContactStats(),
        analyticsApi.getSales({ groupBy: 'day' }),
        analyticsApi.getInventoryStats(),
      ])

      if (!isMounted) return

      if (overviewResult.status === 'fulfilled') {
        setOverview(overviewResult.value.overview)
      } else {
        console.error('Erreur overview:', overviewResult.reason)
        setOverview(null)
      }

      if (contactStatsResult.status === 'fulfilled') {
        setContactStats(contactStatsResult.value)
        setUnreadFallback(null)
      } else {
        // Fallback : compter les messages non lus depuis /admin/contact si l'endpoint stats tombe
        try {
          const messages = await messagesApi.list()
          if (!isMounted) return
          setUnreadFallback(
            messages.filter((m: { status: string }) => m.status === 'unread' || m.status === 'NEW').length
          )
        } catch {
          setUnreadFallback(null)
        }
      }

      if (salesResult.status === 'fulfilled') {
        setSalesTimeline(Array.isArray(salesResult.value?.sales) ? salesResult.value.sales : [])
      } else {
        console.error('Erreur sales:', salesResult.reason)
        setSalesTimeline([])
      }

      if (inventoryResult.status === 'fulfilled') {
        setInventory(inventoryResult.value)
      } else {
        setInventory(null)
      }

      setIsLoading(false)
    }

    void loadStats()

    return () => {
      isMounted = false
    }
  }, [])

  const stats = useMemo<StatItem[]>(() => {
    const today = todayPoint(salesTimeline)
    const dayRevenue = today?.revenue ?? 0
    const dayOrders = today?.orderCount ?? 0

    const week = sumTimelineOverDays(salesTimeline, 7)
    const month = sumTimelineOverDays(salesTimeline, 30)

    const hasTimelineData = salesTimeline.length > 0
    const revenueChange = overview?.revenueGrowth

    // Alertes stock : on s'appuie sur inventory-stats
    const outOfStock = inventory?.top10ImmobilizedStock
      ? inventory.top10ImmobilizedStock.filter((item) => (item.stock ?? 0) === 0).length
      : 0
    const neverSold = inventory?.neverSoldProducts ?? 0
    const stockAlerts = outOfStock + neverSold

    // Messages non traités : contact-stats > fallback liste
    let unreadMessages: number | null = null
    if (contactStats) {
      const entry = contactStats.byStatus?.find(
        (s) => s.status === 'unread' || s.status === 'NEW' || s.status === 'new'
      )
      unreadMessages = entry?.count ?? 0
    } else if (unreadFallback != null) {
      unreadMessages = unreadFallback
    }

    const hasAnyData = overview != null || hasTimelineData || contactStats != null || inventory != null

    if (!hasAnyData) {
      return neutralStats
    }

    return [
      {
        name: 'CA jour / 7j / 30j',
        value: `${formatCurrency(dayRevenue)} / ${formatCurrency(week.revenue)} / ${formatCurrency(month.revenue)}`,
        change: Number.isFinite(revenueChange)
          ? `Var période : ${formatSignedPercent(revenueChange ?? 0)}`
          : 'Calcul timeline',
        changeType: (revenueChange ?? 0) >= 0 ? 'positive' : 'negative',
        icon: TrendingUp,
      },
      {
        name: 'Commandes du jour',
        value: String(dayOrders),
        change: hasTimelineData ? 'Depuis timeline' : 'Pas de données',
        changeType: 'neutral',
        icon: ShoppingCart,
      },
      {
        name: 'Alertes stock',
        value: String(stockAlerts),
        change:
          outOfStock > 0
            ? `${outOfStock} rupture${outOfStock > 1 ? 's' : ''}${neverSold > 0 ? ` · ${neverSold} jamais vendus` : ''}`
            : neverSold > 0
              ? `${neverSold} produits jamais vendus`
              : inventory
                ? 'Stock stable'
                : 'Données indisponibles',
        changeType: outOfStock > 0 ? 'negative' : 'neutral',
        icon: AlertTriangle,
        highlight: outOfStock > 0 ? 'danger' : undefined,
        dangerBadge: stockAlerts > 0 ? `${stockAlerts}` : undefined,
      },
      {
        name: 'Messages non traités',
        value: unreadMessages === null ? '--' : String(unreadMessages),
        change:
          unreadMessages === null
            ? 'Données indisponibles'
            : contactStats?.avgResponseTimeHours != null
              ? `Délai moyen ${contactStats.avgResponseTimeHours.toFixed(1)}h`
              : 'Statut NEW',
        changeType: 'neutral',
        icon: MessageSquare,
        highlight: (unreadMessages ?? 0) > 0 ? 'danger' : undefined,
        dangerBadge: (unreadMessages ?? 0) > 0 ? String(unreadMessages) : undefined,
      },
    ]
  }, [overview, salesTimeline, inventory, contactStats, unreadFallback])

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
                {stat.dangerBadge && <Badge variant="error">{stat.dangerBadge}</Badge>}
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
