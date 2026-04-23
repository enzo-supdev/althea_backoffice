'use client'

import { useEffect, useState } from 'react'
import { Clock, Inbox, CheckCircle2 } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import type { ContactStatsAnalytics } from '@/lib/api/types'

interface ContactStatsBannerProps {
  days?: number
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

const formatHours = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value < 1) return `${Math.round(value * 60)}min`
  if (value < 24) return `${value.toFixed(1)}h`
  return `${(value / 24).toFixed(1)}j`
}

export default function ContactStatsBanner({ days = 30 }: ContactStatsBannerProps) {
  const [data, setData] = useState<ContactStatsAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const { startDate, endDate } = computeRange(days)
        const response = await analyticsApi.getContactStats({ startDate, endDate })
        if (!cancelled) setData(response)
      } catch (error) {
        if (!cancelled) {
          console.error('Erreur contact-stats:', error)
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
  }, [days])

  if (isLoading) {
    return (
      <div className="app-panel p-4">
        <p className="text-sm text-gray-500">Chargement des statistiques de contact…</p>
      </div>
    )
  }

  if (!data) return null

  const totalMessages = data.totalMessages ?? 0
  const avgResponseTime = data.avgResponseTimeHours
  const processingRate = data.processingRate ?? 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="app-panel p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Messages reçus ({days}j)</p>
          <Inbox className="h-4 w-4 text-primary" />
        </div>
        <p className="mt-1 text-2xl font-heading font-semibold text-dark">{totalMessages}</p>
      </div>
      <div className="app-panel p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Délai de réponse moyen</p>
          <Clock className="h-4 w-4 text-primary" />
        </div>
        <p className="mt-1 text-2xl font-heading font-semibold text-dark">
          {formatHours(avgResponseTime)}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {avgResponseTime == null ? 'Aucune réponse horodatée' : 'Sur messages traités'}
        </p>
      </div>
      <div className="app-panel p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Taux de traitement</p>
          <CheckCircle2 className="h-4 w-4 text-status-success" />
        </div>
        <p className="mt-1 text-2xl font-heading font-semibold text-dark">
          {processingRate.toFixed(1)}%
        </p>
      </div>
    </div>
  )
}
