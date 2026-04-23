'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Upload, Trash2, Copy, RefreshCw, Image as ImageIcon, FileVideo, FileText } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/ToastProvider'
import { mediaApi, resolveMediaUrl } from '@/lib/api'

type MediaKind = 'image' | 'video' | 'document'

interface MediaItem {
  id?: string
  ref?: string
  filename?: string
  originalName?: string
  url?: string
  mimeType?: string
  mimetype?: string
  size?: number
  createdAt?: string
}

interface MediaListPayload {
  media?: MediaItem[]
  pagination?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

const kindFromMime = (mime?: string): MediaKind => {
  if (!mime) return 'document'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  return 'document'
}

const formatSize = (size?: number) => {
  if (!size || size <= 0) return '—'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export default function MediaPage() {
  const { pushToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterType, setFilterType] = useState<'' | MediaKind>('')
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingRef, setDeletingRef] = useState<string | null>(null)

  const load = async (opts?: { page?: number; type?: '' | MediaKind; search?: string }) => {
    setIsLoading(true)
    try {
      const response = (await mediaApi.listAll({
        page: opts?.page ?? page,
        limit: 24,
        type: (opts?.type ?? filterType) || undefined,
        search: (opts?.search ?? search) || undefined,
      })) as MediaListPayload

      setItems(response?.media ?? [])
      setTotal(response?.pagination?.total ?? 0)
      setTotalPages(response?.pagination?.totalPages ?? 1)
    } catch (error) {
      console.error('Erreur listing media:', error)
      pushToast({ type: 'error', title: 'Impossible de charger la bibliothèque' })
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load({ page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    if (files.length === 0) return

    setIsUploading(true)
    try {
      if (files.length === 1) {
        await mediaApi.upload(files[0])
      } else {
        const chunks: File[][] = []
        for (let i = 0; i < files.length; i += 10) {
          chunks.push(files.slice(i, i + 10))
        }
        for (const chunk of chunks) {
          await mediaApi.bulkUpload(chunk)
        }
      }

      pushToast({
        type: 'success',
        title: 'Upload réussi',
        message: `${files.length} fichier${files.length > 1 ? 's' : ''} ajouté${files.length > 1 ? 's' : ''}.`,
      })
      await load({ page: 1 })
      setPage(1)
    } catch (error) {
      console.error('Erreur upload:', error)
      pushToast({ type: 'error', title: "Échec de l'upload" })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (ref: string) => {
    if (!window.confirm('Supprimer ce fichier ? Les produits/pages qui l\'utilisent afficheront une image cassée.')) {
      return
    }

    setDeletingRef(ref)
    try {
      await mediaApi.delete(ref)
      pushToast({ type: 'success', title: 'Fichier supprimé' })
      await load()
    } catch (error) {
      console.error('Erreur delete media:', error)
      pushToast({ type: 'error', title: 'Suppression impossible' })
    } finally {
      setDeletingRef(null)
    }
  }

  const handleCopyRef = (ref: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(ref)
      pushToast({ type: 'success', title: 'Référence copiée' })
    }
  }

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
    void load({ page: 1 })
  }

  const handleFilterChange = (value: '' | MediaKind) => {
    setFilterType(value)
    setPage(1)
    void load({ page: 1, type: value })
  }

  const renderPreview = (item: MediaItem) => {
    const kind = kindFromMime(item.mimeType ?? item.mimetype)
    const url = item.url ? resolveMediaUrl(item.url) : item.ref ? resolveMediaUrl(item.ref) : ''

    if (kind === 'image' && url) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={url} alt={item.originalName ?? item.filename ?? 'image'} className="h-full w-full object-cover" />
    }
    if (kind === 'video') {
      return (
        <div className="flex h-full w-full items-center justify-center bg-dark/5">
          <FileVideo className="h-10 w-10 text-primary" />
        </div>
      )
    }
    return (
      <div className="flex h-full w-full items-center justify-center bg-dark/5">
        <FileText className="h-10 w-10 text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Media"
        title="Bibliothèque de fichiers"
        description="Uploadez, recherchez et gérez les médias stockés côté serveur. Jusqu'à 10 Mo par fichier, 10 fichiers par lot."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFiles}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {isUploading ? 'Upload…' : 'Uploader'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-primary-light/50"
            >
              <RefreshCw className="h-4 w-4" /> Rafraîchir
            </button>
          </>
        }
      />

      <div className="app-panel flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher par nom…"
            className="input-base w-full px-3 py-2 text-sm md:max-w-md"
          />
          <button
            type="submit"
            className="rounded-xl border border-primary/20 bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-primary-light/50"
          >
            Rechercher
          </button>
        </form>

        <div className="flex items-center gap-2">
          <label htmlFor="media-type" className="text-sm font-medium text-gray-600">
            Type
          </label>
          <select
            id="media-type"
            value={filterType}
            onChange={(event) => handleFilterChange(event.target.value as '' | MediaKind)}
            className="input-base px-3 py-2 text-sm"
          >
            <option value="">Tous</option>
            <option value="image">Images</option>
            <option value="video">Vidéos</option>
            <option value="document">Documents</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="app-panel p-10 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-primary/40" />
          <p className="mt-4 text-sm text-gray-500">Aucun fichier trouvé.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item, index) => {
              const ref = item.ref ?? item.filename ?? String(index)
              const kind = kindFromMime(item.mimeType ?? item.mimetype)
              const displayName = item.originalName ?? item.filename ?? ref
              return (
                <div key={ref} className="app-panel overflow-hidden">
                  <div className="aspect-square overflow-hidden bg-primary-light/20">
                    {renderPreview(item)}
                  </div>
                  <div className="space-y-2 p-3">
                    <p className="truncate text-sm font-medium text-dark" title={displayName}>
                      {displayName}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant={kind === 'image' ? 'info' : kind === 'video' ? 'warning' : 'default'} size="sm">
                        {kind}
                      </Badge>
                      <span className="text-gray-500">{formatSize(item.size)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyRef(ref)}
                        className="flex-1 rounded-lg border border-primary/20 px-2 py-1 text-xs font-medium text-dark hover:bg-primary-light/50"
                        title="Copier la référence"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Copy className="h-3 w-3" /> Ref
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(ref)}
                        disabled={deletingRef === ref}
                        className="rounded-lg border border-status-error/30 bg-white px-2 py-1 text-xs font-medium text-status-error hover:bg-status-error/10 disabled:opacity-60"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="app-panel flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-gray-600">
                Page {page} / {totalPages} · {total} fichier{total > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    const next = page - 1
                    setPage(next)
                    void load({ page: next })
                  }}
                  className="rounded-lg border border-primary/20 px-3 py-1 text-sm disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const next = page + 1
                    setPage(next)
                    void load({ page: next })
                  }}
                  className="rounded-lg border border-primary/20 px-3 py-1 text-sm disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
