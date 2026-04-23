'use client'

import { useState } from 'react'
import { Download, Calendar } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import { downloadBlob } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastProvider'

export type ReportType =
  | 'overview'
  | 'sales'
  | 'products'
  | 'customers'
  | 'orders'
  | 'revenue'
  | 'inventory'
  | 'categories'
  | 'refunds'
  | 'geographic'
  | 'contact'
export type ExportFormat = 'csv' | 'json'

export interface DateRange {
  startDate: string
  endDate: string
}

interface AnalyticsFiltersProps {
  range: DateRange
  onRangeChange: (range: DateRange) => void
  reportType: ReportType
}

const presets = [
  { label: '7 derniers jours', days: 7 },
  { label: '30 derniers jours', days: 30 },
  { label: '90 derniers jours', days: 90 },
  { label: '12 derniers mois', days: 365 },
]

export function computeDateRange(days: number): DateRange {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  const toIso = (date: Date) => date.toISOString().slice(0, 10)
  return {
    startDate: toIso(start),
    endDate: toIso(end),
  }
}

export default function AnalyticsFilters({
  range,
  onRangeChange,
  reportType,
}: AnalyticsFiltersProps) {
  const { pushToast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [format, setFormat] = useState<ExportFormat>('csv')

  const handlePreset = (days: number) => {
    onRangeChange(computeDateRange(days))
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const blob = await analyticsApi.exportReport({
        reportType,
        format,
        startDate: range.startDate,
        endDate: range.endDate,
      })

      const filename = `analytics-${reportType}-${range.startDate}_${range.endDate}.${format}`
      downloadBlob(blob, filename)
      pushToast({ type: 'success', title: 'Export téléchargé' })
    } catch (error) {
      console.error('Erreur export analytics:', error)
      pushToast({
        type: 'error',
        title: "Échec de l'export",
        message: 'Réessayez dans quelques instants.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="app-panel flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-500">
          Plage appliquée à tous les endpoints analytics. Défaut backend : 30 derniers jours.
        </p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => handlePreset(preset.days)}
              className="rounded-full border border-primary/20 bg-white px-3 py-1 text-xs font-medium text-dark transition-colors hover:border-primary hover:bg-primary-light/50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              className="input-base px-3 py-1.5 text-sm"
              value={range.startDate}
              onChange={(event) => onRangeChange({ ...range, startDate: event.target.value })}
              aria-label="Date de début"
            />
          </div>
          <span className="text-sm text-gray-500">→</span>
          <input
            type="date"
            className="input-base px-3 py-1.5 text-sm"
            value={range.endDate}
            onChange={(event) => onRangeChange({ ...range, endDate: event.target.value })}
            aria-label="Date de fin"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value as ExportFormat)}
          className="input-base px-3 py-2 text-sm"
          aria-label="Format d'export"
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Export…' : 'Exporter'}
        </button>
      </div>
    </div>
  )
}
