'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { Trash2, Star, Upload, Loader2, Link as LinkIcon, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react'
import { mediaApi } from '@/lib/api/mediaApi'
import { productsApi } from '@/lib/api/productsApi'
import { extractErrorMessage } from '@/lib/api/core'
import type { ProductImage } from '@/types'

type ProductImageManagerProps = {
  productId: string
  images: ProductImage[]
  mainImageRef: string | null
  onImagesChange: (images: ProductImage[]) => void
  onMainImageRefChange?: (mainImageRef: string | null) => void
  onError?: (message: string) => void
}

/**
 * Flux image complet :
 *   1. mediaApi.upload(file) → ref
 *   2. productsApi.addImage(productId, { imageRefs: [ref] }) → galerie
 *   3. L'affichage passe par resolveMediaUrl(image.imageRef)
 *
 * L'image "principale" est déterminée par Product.mainImageRef (pas par
 * l'ordre). Le bouton étoile appelle productsApi.update(id, { mainImageRef })
 * pour persister le choix côté backend.
 */
export default function ProductImageManager({
  productId,
  images,
  mainImageRef,
  onImagesChange,
  onMainImageRefChange,
  onError,
}: ProductImageManagerProps) {
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [urlInput, setUrlInput] = useState('')
  const [isAddingUrl, setIsAddingUrl] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [isSettingMain, setIsSettingMain] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleUpload = async (file: File) => {
    const tempId = `uploading-${Date.now()}`
    setUploadingIds((prev) => new Set(prev).add(tempId))

    try {
      const uploaded = await mediaApi.upload(file)
      try {
        const added = await productsApi.addImage(productId, { imageRefs: [uploaded.ref] })
        onImagesChange([...images, ...added])
      } catch (associateError) {
        onError?.(
          extractErrorMessage(
            associateError,
            `L'association de l'image au produit a échoué (ref : ${uploaded.ref}).`,
          ),
        )
      }
    } catch (uploadError) {
      onError?.(extractErrorMessage(uploadError, 'L\'upload de l\'image a échoué.'))
    } finally {
      setUploadingIds((prev) => {
        const next = new Set(prev)
        next.delete(tempId)
        return next
      })
    }
  }

  const handleAddUrl = async () => {
    const url = urlInput.trim()
    if (!url) return
    setIsAddingUrl(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('URL inaccessible')
      const blob = await response.blob()
      const filename = url.split('/').pop()?.split('?')[0] || 'image.jpg'
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
      const uploaded = await mediaApi.upload(file)
      const added = await productsApi.addImage(productId, { imageRefs: [uploaded.ref] })
      onImagesChange([...images, ...added])
      setUrlInput('')
    } catch (error) {
      onError?.(
        extractErrorMessage(
          error,
          'L\'ajout par URL a échoué. Vérifiez que l\'URL est accessible (CORS).',
        ),
      )
    } finally {
      setIsAddingUrl(false)
    }
  }

  const handleDelete = async (image: ProductImage) => {
    setDeletingIds((prev) => new Set(prev).add(image.id))
    try {
      await productsApi.deleteImage(productId, image.id)
      const nextImages = images.filter((img) => img.id !== image.id)
      onImagesChange(nextImages)

      if (mainImageRef && image.imageRef === mainImageRef) {
        onMainImageRefChange?.(null)
      }
    } catch (error) {
      onError?.(extractErrorMessage(error, 'La suppression de l\'image a échoué.'))
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(image.id)
        return next
      })
    }
  }

  const reorder = async (reordered: ProductImage[]) => {
    setIsReordering(true)
    const imageIds = reordered.map((img) => img.id)
    try {
      await productsApi.reorderImages(productId, { imageIds })
      onImagesChange(reordered)
    } catch (error) {
      console.error('[ProductImageManager] reorder failed', {
        productId,
        imageIds,
        error,
      })
      onError?.(extractErrorMessage(error, 'La réorganisation des images a échoué.'))
    } finally {
      setIsReordering(false)
    }
  }

  const moveImage = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= images.length) return
    const reordered = [...images]
    ;[reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]]
    void reorder(reordered)
  }

  const handleDragStart = (index: number) => (event: React.DragEvent) => {
    setDraggedIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (index: number) => (event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (targetIndex: number) => (event: React.DragEvent) => {
    event.preventDefault()
    const sourceIndex = draggedIndex ?? Number(event.dataTransfer.getData('text/plain'))
    setDraggedIndex(null)
    setDragOverIndex(null)

    if (Number.isNaN(sourceIndex) || sourceIndex === targetIndex) return

    const reordered = [...images]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    void reorder(reordered)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const setAsMain = async (image: ProductImage) => {
    if (!image.imageRef || image.imageRef === mainImageRef) return
    setIsSettingMain(image.id)
    try {
      await productsApi.update(productId, { mainImageRef: image.imageRef })
      onMainImageRefChange?.(image.imageRef)
    } catch (error) {
      onError?.(extractErrorMessage(error, 'Impossible de définir cette image comme principale.'))
    } finally {
      setIsSettingMain(null)
    }
  }

  const isUploading = uploadingIds.size > 0

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          if (file) void handleUpload(file)
        }}
      >
        <p className="text-sm text-gray-600">Glisser-déposer une image ici ou choisir un fichier.</p>
        <div className="mt-3">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {isUploading ? 'Upload en cours...' : 'Choisir un fichier'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleAddUrl()
              }
            }}
            placeholder="https://exemple.com/image.jpg"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="button"
          disabled={!urlInput.trim() || isAddingUrl}
          onClick={() => void handleAddUrl()}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAddingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ajouter URL'}
        </button>
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune image pour ce produit.</p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Glissez les vignettes pour réorganiser. L&apos;image principale apparaît en premier sur la boutique.</span>
            {isReordering && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Loader2 className="h-3 w-3 animate-spin" /> Enregistrement…
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {images.map((image, index) => {
              const isDeleting = deletingIds.has(image.id)
              const isMain = Boolean(image.imageRef) && image.imageRef === mainImageRef
              const isPendingMain = isSettingMain === image.id
              const isDragging = draggedIndex === index
              const isDropTarget = dragOverIndex === index && draggedIndex !== null && draggedIndex !== index

              return (
                <div
                  key={image.id}
                  draggable={!isReordering && !isDeleting}
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={[
                    'group relative flex flex-col overflow-hidden rounded-lg border-2 bg-white transition-all',
                    isMain ? 'border-primary shadow-sm ring-2 ring-primary/20' : 'border-gray-200',
                    isDragging ? 'opacity-40' : '',
                    isDropTarget ? 'ring-2 ring-primary scale-[1.02]' : '',
                  ].join(' ')}
                >
                  {isMain && (
                    <div className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                      <Star className="h-3 w-3 fill-white" /> Principale
                    </div>
                  )}

                  <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <span
                      className="cursor-grab rounded bg-white/90 p-1 text-gray-500 shadow hover:bg-white active:cursor-grabbing"
                      title="Glisser pour déplacer"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void handleDelete(image)}
                      className="rounded bg-white/90 p-1 text-gray-500 shadow transition-colors hover:bg-white hover:text-status-error disabled:cursor-not-allowed disabled:opacity-50"
                      title="Supprimer cette image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
                    <Image
                      src={image.url}
                      alt={`Image ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    {isDeleting && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 border-t border-gray-100 px-2 py-1.5">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0 || isReordering}
                        onClick={() => moveImage(index, -1)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                        title="Déplacer avant"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === images.length - 1 || isReordering}
                        onClick={() => moveImage(index, 1)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                        title="Déplacer après"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <span className="ml-1 text-[11px] text-gray-400">#{index + 1}</span>
                    </div>

                    {isMain ? (
                      <span className="text-[11px] font-medium text-primary">Principale</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void setAsMain(image)}
                        disabled={isPendingMain || isReordering}
                        className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary-light/30 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary-light/60 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Définir comme image principale"
                      >
                        {isPendingMain ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Star className="h-3 w-3" />
                        )}
                        Principale
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
