'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { GripVertical, Trash2, Star } from 'lucide-react'

type ProductImageManagerProps = {
  images: string[]
  onChange: (nextImages: string[]) => void
}

export default function ProductImageManager({ images, onChange }: ProductImageManagerProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const addFromUrl = () => {
    const normalized = urlInput.trim()
    if (!normalized) return
    onChange([...images, normalized])
    setUrlInput('')
  }

  const addFromFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) return
      onChange([...images, result])
    }
    reader.readAsDataURL(file)
  }

  const removeImage = (index: number) => {
    onChange(images.filter((_, currentIndex) => currentIndex !== index))
  }

  const moveImage = (from: number, to: number) => {
    if (from === to) return
    const next = [...images]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const setAsMain = (index: number) => {
    moveImage(index, 0)
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files?.[0]
          if (file) {
            addFromFile(file)
          }
        }}
      >
        <p className="text-sm text-gray-600">Glisser-deposer une image ici ou utiliser les actions ci-dessous.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="https://..."
            className="input-base min-w-[220px] flex-1"
          />
          <button type="button" onClick={addFromUrl} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover">
            Ajouter URL
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Upload fichier
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                addFromFile(file)
              }
              event.target.value = ''
            }}
          />
        </div>
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune image pour ce produit.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {images.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              draggable
              onDragStart={() => setDraggingIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingIndex !== null) {
                  moveImage(draggingIndex, index)
                }
                setDraggingIndex(null)
              }}
              onDragEnd={() => setDraggingIndex(null)}
              className={`rounded-lg border bg-white p-2 ${index === 0 ? 'border-primary' : 'border-gray-200'}`}
            >
              <div className="relative h-24 w-full overflow-hidden rounded bg-gray-100">
                <Image src={imageUrl} alt={`Image ${index + 1}`} fill className="object-cover" unoptimized />
              </div>
              <div className="mt-2 flex items-center justify-between gap-1">
                <button type="button" onClick={() => setAsMain(index)} className="rounded p-1 text-gray-500 hover:text-primary" title="Definir en image principale">
                  <Star className="h-4 w-4" />
                </button>
                <button type="button" className="rounded p-1 text-gray-400" title="Reorganiser">
                  <GripVertical className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => removeImage(index)} className="rounded p-1 text-gray-500 hover:text-status-error" title="Supprimer cette image">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
