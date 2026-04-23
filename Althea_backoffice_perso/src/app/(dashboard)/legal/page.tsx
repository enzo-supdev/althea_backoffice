'use client'

import { useEffect, useState } from 'react'
import { FileText, History, Save, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import PageHeader from '@/components/layout/PageHeader'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { legalApi } from '@/lib/api'
import type { LegalPage, LegalPageType } from '@/lib/api/types'
import { formatDateTime } from '@/lib/utils'

const pageTypes: Array<{ type: LegalPageType; label: string }> = [
  { type: 'CGV', label: 'CGV — Conditions Générales de Vente' },
  { type: 'CGU', label: "CGU — Conditions Générales d'Utilisation" },
  { type: 'MENTIONS_LEGALES', label: 'Mentions légales' },
  { type: 'POLITIQUE_CONFIDENTIALITE', label: 'Politique de confidentialité' },
  { type: 'COOKIES', label: 'Cookies' },
]

interface VersionEntry {
  version?: string
  updatedAt?: string
  updatedBy?: { firstName?: string; lastName?: string; email?: string }
}

export default function LegalPage() {
  const { pushToast } = useToast()
  const [selectedType, setSelectedType] = useState<LegalPageType>('CGV')
  const [pagesByType, setPagesByType] = useState<Partial<Record<LegalPageType, LegalPage>>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [version, setVersion] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<VersionEntry[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  const loadPages = async () => {
    setIsLoading(true)
    try {
      const list = await legalApi.listAdmin()
      const byType: Partial<Record<LegalPageType, LegalPage>> = {}
      list.forEach((page) => {
        byType[page.type] = page
      })
      setPagesByType(byType)
      const current = byType[selectedType]
      if (current) {
        setTitle(current.title)
        setContent(current.content)
        setVersion(current.version ?? '')
      } else {
        setTitle('')
        setContent('')
        setVersion('')
      }
    } catch (error) {
      console.error('Erreur chargement pages légales:', error)
      pushToast({ type: 'error', title: 'Impossible de charger les pages légales' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const page = pagesByType[selectedType]
    if (page) {
      setTitle(page.title)
      setContent(page.content)
      setVersion(page.version ?? '')
    } else {
      setTitle('')
      setContent('')
      setVersion('')
    }
  }, [selectedType, pagesByType])

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      pushToast({ type: 'error', title: 'Titre et contenu requis' })
      return
    }

    setIsSaving(true)
    try {
      const saved = await legalApi.upsertPage(selectedType, {
        title,
        content,
        version: version.trim() || undefined,
      })
      setPagesByType((prev) => ({ ...prev, [selectedType]: saved }))
      pushToast({ type: 'success', title: 'Page enregistrée' })
    } catch (error) {
      console.error('Erreur upsert page légale:', error)
      pushToast({ type: 'error', title: "Échec de l'enregistrement" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenHistory = async () => {
    setHistoryOpen(true)
    setIsHistoryLoading(true)
    try {
      const raw = await legalApi.getHistory(selectedType)
      setHistory((raw as VersionEntry[]) ?? [])
    } catch (error) {
      console.error('Erreur historique:', error)
      setHistory([])
      pushToast({ type: 'error', title: "Impossible de charger l'historique" })
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const currentPage = pagesByType[selectedType]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Légal"
        title="Pages légales"
        description="Éditez les contenus juridiques affichés côté client. Chaque sauvegarde génère une nouvelle version."
        actions={
          <button
            type="button"
            onClick={() => void loadPages()}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-primary-light/50"
          >
            <RefreshCw className="h-4 w-4" /> Rafraîchir
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="app-panel p-3">
          <ul className="space-y-1">
            {pageTypes.map((item) => {
              const isActive = item.type === selectedType
              const exists = Boolean(pagesByType[item.type])
              return (
                <li key={item.type}>
                  <button
                    type="button"
                    onClick={() => setSelectedType(item.type)}
                    className={clsx(
                      'flex w-full items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-dark hover:bg-primary-light/50'
                    )}
                  >
                    <span className="flex items-start gap-2">
                      <FileText className={clsx('mt-0.5 h-4 w-4', isActive ? 'text-white' : 'text-primary')} />
                      <span className="font-medium">{item.label}</span>
                    </span>
                    {!exists && (
                      <span className={clsx('mt-0.5 text-[10px] uppercase', isActive ? 'text-white/80' : 'text-status-warning')}>
                        Vide
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section className="app-panel p-5 md:p-6">
          {isLoading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {selectedType}
                  </p>
                  {currentPage?.updatedAt && (
                    <p className="mt-1 text-xs text-gray-500">
                      Dernière maj&nbsp;: {formatDateTime(new Date(currentPage.updatedAt))}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {currentPage?.version && <Badge variant="info">v{currentPage.version}</Badge>}
                  <button
                    type="button"
                    onClick={() => void handleOpenHistory()}
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-3 py-2 text-sm font-medium text-dark hover:bg-primary-light/50"
                  >
                    <History className="h-4 w-4" /> Historique
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="legal-title" className="mb-1 block text-sm font-medium text-gray-700">
                    Titre
                  </label>
                  <input
                    id="legal-title"
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="input-base w-full px-3 py-2"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label htmlFor="legal-version" className="mb-1 block text-sm font-medium text-gray-700">
                    Version (optionnel)
                  </label>
                  <input
                    id="legal-version"
                    type="text"
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    className="input-base w-full px-3 py-2 md:w-48"
                    placeholder="ex. 1.2"
                  />
                </div>

                <div>
                  <label htmlFor="legal-content" className="mb-1 block text-sm font-medium text-gray-700">
                    Contenu (HTML ou Markdown)
                  </label>
                  <textarea
                    id="legal-content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    className="input-base h-[420px] w-full resize-y px-3 py-2 font-mono text-sm"
                    placeholder="<h2>Article 1</h2>…"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <Modal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Historique — ${selectedType}`}
        size="md"
      >
        {isHistoryLoading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune version antérieure.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((entry, index) => (
              <li key={index} className="flex items-start justify-between rounded-lg bg-primary-light/40 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-dark">
                    {entry.version ? `v${entry.version}` : `Version ${index + 1}`}
                  </p>
                  {entry.updatedBy && (
                    <p className="text-xs text-gray-600">
                      {entry.updatedBy.firstName} {entry.updatedBy.lastName}
                      {entry.updatedBy.email ? ` · ${entry.updatedBy.email}` : ''}
                    </p>
                  )}
                </div>
                {entry.updatedAt && (
                  <span className="text-xs text-gray-500">
                    {formatDateTime(new Date(entry.updatedAt))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
