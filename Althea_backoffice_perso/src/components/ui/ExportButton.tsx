'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { downloadBlob } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastProvider'

interface ExportButtonProps {
  fetcher: () => Promise<Blob>
  filename: string
  label?: string
  className?: string
}

export default function ExportButton({
  fetcher,
  filename,
  label = 'Exporter',
  className,
}: ExportButtonProps) {
  const { pushToast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleClick = async () => {
    setIsExporting(true)
    try {
      const blob = await fetcher()
      downloadBlob(blob, filename)
      pushToast({ type: 'success', title: 'Export téléchargé' })
    } catch (error) {
      console.error('Export error:', error)
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
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isExporting}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-4 py-2 text-sm font-medium text-dark transition-colors hover:bg-primary-light/50 disabled:cursor-not-allowed disabled:opacity-60'
      }
    >
      <Download className="h-4 w-4" />
      {isExporting ? 'Export…' : label}
    </button>
  )
}
