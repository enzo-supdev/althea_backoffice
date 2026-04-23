'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, RefreshCcw, Upload, FileDown, Download } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import DataTable, { Column } from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import SearchBar from '@/components/ui/SearchBar'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, categoriesApi, mediaApi } from '@/lib/api'
import { buildCsv, downloadCsv, parseCsv, toSlug } from '@/lib/csv'
import { Category } from '@/types'
import PageHeader from '@/components/layout/PageHeader'
import FormActions from '@/components/ui/form/FormActions'
import FormField from '@/components/ui/form/FormField'

type CategoryImportFailure = { row: number; name?: string; error: string; raw?: Record<string, string> }
type CategoryImportResult = {
  total: number
  created: number
  updated: number
  failed: CategoryImportFailure[]
}

function isConflict409(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409
}

const CATEGORY_CSV_COLUMNS = ['name', 'slug', 'description', 'imageUrl']

const CATEGORY_CSV_EXAMPLE_ROWS: string[][] = [
  [
    'Stethoscopes',
    'stethoscopes',
    "Instruments d'auscultation cardiaque et pulmonaire",
    'https://placehold.co/600x600/14413c/fff9f0.png?text=Stethoscopes',
  ],
  [
    'Tensiometres',
    'tensiometres',
    'Appareils de mesure de la pression arterielle',
    '',
  ],
]

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.'),
  description: z.string().trim(),
  slug: z.string().trim().min(1, 'Le slug est requis.').regex(/^[a-z0-9-]+$/, 'Utilisez seulement des minuscules, chiffres et tirets.'),
  image: z.union([z.string().trim().url('URL image invalide.'), z.literal('')]),
  status: z.enum(['active', 'inactive']),
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey] = useState<string>('order')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([])
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)
  const [importResult, setImportResult] = useState<CategoryImportResult | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { pushToast } = useToast()

  const addCategoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
      slug: '',
      image: '',
      status: 'active',
    },
  })

  const editCategoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      description: '',
      slug: '',
      image: '',
      status: 'active',
    },
  })

  const refreshCategories = useCallback(async () => {
    const items = await categoriesApi.listAdmin()
    setCategories(items)
    return items
  }, [])

  const loadCategories = useCallback(async () => {
    setLoadError('')
    setIsLoading(true)

    try {
      await refreshCategories()
    } catch (error) {
      setLoadError('Le service categories est indisponible.')
      pushToast({
        type: 'error',
        title: 'Chargement categories impossible',
        message: error instanceof ApiError ? error.message : 'Le service categories est indisponible.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [pushToast, refreshCategories])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const selectedCategoriesSet = useMemo(() => new Set(selectedCategories), [selectedCategories])

  const resetEditCategoryForm = () => {
    setEditingCategory(null)
    editCategoryForm.reset({
      name: '',
      description: '',
      slug: '',
      image: '',
      status: 'active',
    })
  }

  const handleDragReorder = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return

    const current = [...orderedCategories]
    const sourceIndex = current.findIndex((category) => category.id === sourceId)
    const targetIndex = current.findIndex((category) => category.id === targetId)

    if (sourceIndex < 0 || targetIndex < 0) return

    const [movedCategory] = current.splice(sourceIndex, 1)
    current.splice(targetIndex, 0, movedCategory)

    try {
      await Promise.all(
        current.map((category, index) =>
          categoriesApi.update(category.id, { displayOrder: index + 1 }),
        )
      )

      await refreshCategories()
      pushToast({
        type: 'success',
        title: 'Ordre des categories mis a jour',
      })
    } catch {
      pushToast({
        type: 'error',
        title: 'Reorganisation impossible',
        message: 'Le glisser-deposer des categories a echoue.',
      })
    }
  }

  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    const filtered = categories.filter((category) => {
      const matchesQuery =
        !query ||
        category.name.toLowerCase().includes(query) ||
        category.slug.toLowerCase().includes(query) ||
        category.description.toLowerCase().includes(query)

      const matchesStatus = filterStatus === 'all' || category.status === filterStatus

      return matchesQuery && matchesStatus
    })

    filtered.sort((a, b) => {
      const aValue = (a as any)[sortKey] ?? ''
      const bValue = (b as any)[sortKey] ?? ''

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === 'asc'
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue)
    })

    return filtered
  }, [categories, searchQuery, filterStatus, sortKey, sortDirection])

  const orderedCategories = useMemo(
    () => [...categories].sort((left, right) => left.order - right.order),
    [categories],
  )

  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredCategories.slice(start, start + pageSize)
  }, [filteredCategories, currentPage, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize))

  const allVisibleSelected =
    paginatedCategories.length > 0 && paginatedCategories.every((category) => selectedCategoriesSet.has(category.id))

  const someVisibleSelected =
    paginatedCategories.some((category) => selectedCategoriesSet.has(category.id)) && !allVisibleSelected

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const toggleVisibleSelection = () => {
    const visibleIds = paginatedCategories.map((category) => category.id)

    if (allVisibleSelected) {
      setSelectedCategories((prev) => prev.filter((id) => !visibleIds.includes(id)))
      return
    }

    setSelectedCategories((prev) => Array.from(new Set([...prev, ...visibleIds])))
  }

  const handleBulkStatusUpdate = async (nextStatus: Category['status']) => {
    if (selectedCategories.length === 0) return

    try {
      await categoriesApi.updateStatus(selectedCategories, nextStatus)
      await refreshCategories()
    } catch {
      pushToast({
        type: 'error',
        title: 'Mise a jour impossible',
        message: 'Le changement de statut a echoue.',
      })
      return
    }

    pushToast({
      type: 'success',
      title: 'Categories mises a jour',
      message: `${selectedCategories.length} categorie${selectedCategories.length > 1 ? 's' : ''} modifiee${selectedCategories.length > 1 ? 's' : ''}.`,
    })
  }

  const handleConfirmedDelete = async () => {
    if (deleteTargetIds.length === 0) return

    try {
      await categoriesApi.remove(deleteTargetIds)
      await refreshCategories()
    } catch {
      pushToast({
        type: 'error',
        title: 'Suppression impossible',
        message: 'La suppression des categories a echoue.',
      })
      return
    }

    setSelectedCategories([])
    setDeleteTargetIds([])
    setIsDeleteConfirmOpen(false)

    pushToast({
      type: 'success',
      title: 'Categories supprimees',
      message: 'La selection a ete supprimee avec succes.',
    })
  }

  const handleAddCategory = addCategoryForm.handleSubmit(async (values) => {
    try {
      const created = await categoriesApi.create({
        name: values.name,
        description: values.description,
        slug: values.slug,
      })

      await categoriesApi.update(created.id, {
        image: values.image || undefined,
        status: values.status,
      })

      await refreshCategories()
      setIsAddModalOpen(false)
      addCategoryForm.reset()

      pushToast({
        type: 'success',
        title: 'Categorie ajoutee',
        message: `${created.name} est maintenant disponible.`,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors) {
          Object.entries(error.fieldErrors).forEach(([field, message]) => {
            if (field === 'name' || field === 'description' || field === 'slug') {
              addCategoryForm.setError(field, { type: 'server', message })
            }
          })
        }

        pushToast({ type: 'error', title: error.code, message: error.message })
        return
      }

      pushToast({
        type: 'error',
        title: 'Creation impossible',
        message: 'La categorie n a pas pu etre creee.',
      })
    }
  })

  const openEditModal = (category: Category) => {
    setEditingCategory(category)
    editCategoryForm.reset({
      name: category.name,
      description: category.description,
      slug: category.slug,
      image: category.image ?? '',
      status: category.status,
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateCategory = editCategoryForm.handleSubmit(async (values) => {
    if (!editingCategory) return

    try {
      const updated = await categoriesApi.update(editingCategory.id, {
        name: values.name,
        description: values.description,
        slug: values.slug,
        image: values.image || undefined,
        status: values.status,
      })

      await refreshCategories()
      setIsEditModalOpen(false)
      resetEditCategoryForm()

      pushToast({
        type: 'success',
        title: 'Categorie mise a jour',
        message: `${updated.name} a ete enregistree.`,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors) {
          Object.entries(error.fieldErrors).forEach(([field, message]) => {
            if (field === 'name' || field === 'description' || field === 'slug') {
              editCategoryForm.setError(field, { type: 'server', message })
            }
          })
        }

        pushToast({ type: 'error', title: error.code, message: error.message })
        return
      }

      pushToast({
        type: 'error',
        title: 'Mise a jour impossible',
        message: 'La categorie n a pas pu etre modifiee.',
      })
    }
  })

  const handleMoveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    try {
      await categoriesApi.move(categoryId, direction)
      await refreshCategories()
      pushToast({
        type: 'success',
        title: 'Ordre mis a jour',
        message: 'La categorie a ete repositionnee.',
      })
    } catch {
      pushToast({
        type: 'error',
        title: 'Reordonnancement impossible',
        message: 'Le changement d ordre a echoue.',
      })
    }
  }

  const openDeleteConfirm = (ids: string[]) => {
    if (ids.length === 0) return
    setDeleteTargetIds(ids)
    setIsDeleteConfirmOpen(true)
  }

  const handleDownloadTemplate = () => {
    downloadCsv('categories-template.csv', buildCsv(CATEGORY_CSV_COLUMNS, CATEGORY_CSV_EXAMPLE_ROWS))
  }

  const handleExportCsv = () => {
    const rows = categories.map((category) => [
      category.name,
      category.slug,
      category.description,
      category.image ?? '',
    ])
    downloadCsv(
      `categories-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(CATEGORY_CSV_COLUMNS, rows),
    )
  }

  const handleOpenImportPicker = () => {
    setImportResult(null)
    setImportProgress(null)
    fileInputRef.current?.click()
  }

  const runImport = async (file: File) => {
    setIsImportModalOpen(true)
    setIsImporting(true)
    setImportResult(null)

    let rows: Record<string, string>[] = []
    try {
      const text = await file.text()
      rows = parseCsv(text)
    } catch {
      setIsImporting(false)
      pushToast({
        type: 'error',
        title: 'Lecture CSV impossible',
        message: 'Le fichier est vide ou illisible.',
      })
      setIsImportModalOpen(false)
      return
    }

    if (rows.length === 0) {
      setIsImporting(false)
      setImportResult({ total: 0, created: 0, updated: 0, failed: [] })
      return
    }

    const failed: CategoryImportFailure[] = []
    let created = 0
    let updated = 0

    // Pre-charge la liste admin fraiche pour construire un cache slug -> id.
    // Si une categorie est deja presente, on fait UPDATE direct sans tenter
    // de create (evite les 409 inutiles et les re-fetch).
    let existingBySlug = new Map<string, string>()
    try {
      const remote = await categoriesApi.listAdmin()
      existingBySlug = new Map(remote.map((c) => [c.slug.toLowerCase(), c.id]))
    } catch {
      // On continue sans cache — chaque ligne retombera en fallback 409+refetch.
    }

    setImportProgress({ done: 0, total: rows.length })

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]
      const rowNumber = index + 2
      try {
        const name = row.name?.trim()
        if (!name) throw new Error('Colonne "name" vide.')

        const slug = (row.slug?.trim() || toSlug(name))
        if (!/^[a-z0-9-]+$/.test(slug)) {
          throw new Error(`slug invalide : "${slug}". Uniquement minuscules, chiffres, tirets.`)
        }

        const description = row.description?.trim() || ''

        // On uploade l'image AVANT le create/update pour passer imageRef
        // directement dans le payload (evite le POST /:id/image qui bogue).
        let imageRef: string | undefined
        const imageUrl = row.imageUrl?.trim()
        if (imageUrl) {
          try {
            const uploaded = await mediaApi.uploadFromUrl(imageUrl, `${slug}.png`)
            imageRef = uploaded.ref
          } catch (imageError) {
            const msg = imageError instanceof Error ? imageError.message : 'upload media echoue'
            throw new Error(`Upload image "${imageUrl}" : ${msg}`)
          }
        }

        const payload = {
          name,
          slug,
          description,
          ...(imageRef ? { imageRef } : {}),
        }

        // Strategie cache-first : si le slug existe deja en base, on UPDATE
        // directement. Sinon on CREATE, avec fallback 409+refetch pour gerer
        // les races (cache obsolete, creation concurrente, ...).
        const cachedId = existingBySlug.get(slug.toLowerCase())
        if (cachedId) {
          await categoriesApi.update(cachedId, payload)
          updated += 1
        } else {
          try {
            const createdCat = await categoriesApi.create(payload)
            existingBySlug.set(slug.toLowerCase(), createdCat.id)
            created += 1
          } catch (createError) {
            if (!isConflict409(createError)) throw createError

            // Cache obsolete : refetch, puis UPDATE.
            const remote = await categoriesApi.listAdmin()
            existingBySlug = new Map(remote.map((c) => [c.slug.toLowerCase(), c.id]))
            const foundId = existingBySlug.get(slug.toLowerCase())
            if (!foundId) {
              throw new Error('Conflit 409 mais categorie introuvable apres refetch.')
            }
            await categoriesApi.update(foundId, payload)
            updated += 1
          }
        }
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Erreur inconnue.'
        failed.push({ row: rowNumber, name: row.name, error: message, raw: row })
      }

      setImportProgress({ done: index + 1, total: rows.length })
    }

    const succeeded = created + updated

    if (succeeded > 0) {
      try {
        await refreshCategories()
      } catch {
        // On laisse glisser : l'utilisateur verra les nouvelles categories au prochain refresh.
      }
    }

    setImportResult({ total: rows.length, created, updated, failed })
    setIsImporting(false)

    if (failed.length === 0 && succeeded > 0) {
      pushToast({
        type: 'success',
        title: 'Import termine',
        message: `${created} creee${created > 1 ? 's' : ''}, ${updated} mise${updated > 1 ? 's' : ''} a jour.`,
      })
    } else if (succeeded > 0) {
      pushToast({
        type: 'info',
        title: 'Import partiel',
        message: `${created} creees, ${updated} mises a jour, ${failed.length} echec${failed.length > 1 ? 's' : ''}.`,
      })
    } else {
      pushToast({
        type: 'error',
        title: 'Import echoue',
        message: 'Aucune ligne n a pu etre importee.',
      })
    }
  }

  const handleImportFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void runImport(file)
  }

  const retryFailedAsUpdate = async () => {
    if (!importResult) return
    const failedWithRaw = importResult.failed.filter((f) => f.raw)
    if (failedWithRaw.length === 0) return

    setIsImporting(true)
    setImportProgress({ done: 0, total: failedWithRaw.length })

    // Fresh cache pour matcher les slugs.
    let categoryBySlug = new Map<string, string>()
    try {
      const remote = await categoriesApi.listAdmin()
      categoryBySlug = new Map(remote.map((c) => [c.slug.toLowerCase(), c.id]))
    } catch {
      // On continue sans cache.
    }

    const stillFailed: CategoryImportFailure[] = []
    let retryUpdated = 0

    for (let i = 0; i < failedWithRaw.length; i++) {
      const failure = failedWithRaw[i]
      const row = failure.raw as Record<string, string>
      try {
        const name = row.name?.trim()
        if (!name) throw new Error('Colonne "name" vide.')

        const slug = (row.slug?.trim() || toSlug(name))
        if (!/^[a-z0-9-]+$/.test(slug)) {
          throw new Error(`slug invalide : "${slug}".`)
        }

        const existingId = categoryBySlug.get(slug.toLowerCase())
        if (!existingId) {
          throw new Error(`Aucune categorie existante avec slug "${slug}" — retry se limite a l'update.`)
        }

        const description = row.description?.trim() || ''

        let imageRef: string | undefined
        const imageUrl = row.imageUrl?.trim()
        if (imageUrl) {
          const uploaded = await mediaApi.uploadFromUrl(imageUrl, `${slug}.png`)
          imageRef = uploaded.ref
        }

        const payload = {
          name,
          slug,
          description,
          ...(imageRef ? { imageRef } : {}),
        }

        await categoriesApi.update(existingId, payload)
        retryUpdated += 1
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Erreur inconnue.'
        stillFailed.push({ ...failure, error: message })
      }

      setImportProgress({ done: i + 1, total: failedWithRaw.length })
    }

    if (retryUpdated > 0) {
      try {
        await refreshCategories()
      } catch {
        // silencieux
      }
    }

    setImportResult({
      total: importResult.total,
      created: importResult.created,
      updated: importResult.updated + retryUpdated,
      failed: stillFailed,
    })
    setIsImporting(false)

    if (stillFailed.length === 0) {
      pushToast({
        type: 'success',
        title: 'Retry termine',
        message: `${retryUpdated} categorie${retryUpdated > 1 ? 's' : ''} mise${retryUpdated > 1 ? 's' : ''} a jour via update.`,
      })
    } else {
      pushToast({
        type: 'info',
        title: 'Retry partiel',
        message: `${retryUpdated} OK, ${stillFailed.length} echec${stillFailed.length > 1 ? 's' : ''} restant${stillFailed.length > 1 ? 's' : ''}.`,
      })
    }
  }

  const columns: Column<Category>[] = [
    {
      key: 'selection',
      label: (
        <input
          type="checkbox"
          checked={allVisibleSelected}
          ref={(input) => {
            if (input) {
              input.indeterminate = someVisibleSelected
            }
          }}
          onChange={toggleVisibleSelection}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          aria-label="Selectionner toutes les categories visibles"
        />
      ),
      render: (category) => (
        <input
          type="checkbox"
          checked={selectedCategoriesSet.has(category.id)}
          onChange={() => toggleCategorySelection(category.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          aria-label={`Selectionner ${category.name}`}
        />
      ),
    },
    {
      key: 'image',
      label: 'Image',
      render: (category) => (
        <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-gray-100">
          {category.image ? (
            <Image src={category.image} alt={category.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">IMG</div>
          )}
        </div>
      ),
    },
    {
      key: 'order',
      label: 'Ordre',
      sortable: true,
      render: (category) => (
        <div
          className="flex items-center gap-2"
          draggable
          onDragStart={() => setDraggingCategoryId(category.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggingCategoryId) {
              void handleDragReorder(draggingCategoryId, category.id)
            }
            setDraggingCategoryId(null)
          }}
          onDragEnd={() => setDraggingCategoryId(null)}
        >
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              disabled={orderedCategories[0]?.id === category.id}
              onClick={() => void handleMoveCategory(category.id, 'up')}
              className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Monter ${category.name}`}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={orderedCategories[orderedCategories.length - 1]?.id === category.id}
              onClick={() => void handleMoveCategory(category.id, 'down')}
              className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Descendre ${category.name}`}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="font-medium text-gray-700">#{category.order}</span>
          <span className="text-xs text-gray-400">(drag)</span>
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Nom',
      sortable: true,
      render: (category) => (
        <div>
          <div className="font-medium text-gray-900">{category.name}</div>
          <div className="text-sm text-gray-500">{category.slug}</div>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      sortable: true,
      render: (category) => (
        <span className="max-w-xs truncate text-sm text-gray-600">
          {category.description}
        </span>
      ),
    },
    {
      key: 'productCount',
      label: 'Produits',
      sortable: true,
      render: (category) => (
        <span className="font-medium text-gray-900">{category.productCount}</span>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      render: (category) => (
        <Badge variant={category.status === 'active' ? 'success' : 'default'}>
          {category.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (category) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/categories/${category.id}`}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
            aria-label={`Voir ${category.name}`}
          >
            Voir
          </Link>
          <button
            type="button"
            onClick={() => openEditModal(category)}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
            aria-label={`Modifier ${category.name}`}
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openDeleteConfirm([category.id])}
            className="rounded p-1 text-gray-600 transition-colors hover:text-status-error"
            aria-label={`Supprimer ${category.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Gestion des catégories"
        description={`${filteredCategories.length} catégorie${filteredCategories.length > 1 ? 's' : ''} dans la structure.`}
        actions={(
          <>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              title="Telecharger un fichier CSV modele"
            >
              <FileDown className="h-4 w-4" />
              Template CSV
            </button>
            <button
              type="button"
              onClick={handleOpenImportPicker}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Importer CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportFileSelected}
            />
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={categories.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Exporter CSV
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Ajouter une catégorie
            </button>
          </>
        )}
      />

      <div className="app-panel space-y-4 p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchBar
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value)
              setCurrentPage(1)
            }}
            placeholder="Rechercher nom, slug, description..."
            ariaLabel="Rechercher une categorie"
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setCurrentPage(1)
            }}
            className="input-base bg-shell-surface"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actives</option>
            <option value="inactive">Inactives</option>
          </select>
        </div>
      </div>

      {selectedCategories.length > 0 && (
        <div className="app-panel flex flex-wrap items-center justify-between gap-3 border-primary/10 bg-primary-light/50 p-4">
          <span className="text-sm font-medium text-dark">
            {selectedCategories.length} categorie{selectedCategories.length > 1 ? 's' : ''} selectionnee{selectedCategories.length > 1 ? 's' : ''}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkStatusUpdate('active')}
              className="rounded-lg bg-status-success px-4 py-2 text-sm text-white transition-colors hover:bg-status-success/90"
            >
              Activer
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatusUpdate('inactive')}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800"
            >
              Desactiver
            </button>
            <button
              type="button"
              onClick={() => openDeleteConfirm(selectedCategories)}
              className="rounded-lg bg-status-error px-4 py-2 text-sm text-white transition-colors hover:bg-status-error/90"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card space-y-4">
          <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="grid grid-cols-[120px_1.2fr_1.4fr_100px_100px_120px] gap-4 rounded-lg border border-gray-100 px-4 py-4">
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 animate-pulse rounded bg-gray-200" />
                <div className="h-4 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      ) : loadError ? (
        <div className="card flex flex-col items-start gap-4 border border-dashed border-gray-300 bg-gray-50" role="alert" aria-live="assertive" aria-atomic="true">
          <div>
            <h3 className="text-lg font-heading font-semibold text-dark">Chargement impossible</h3>
            <p className="mt-1 text-sm text-gray-600">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadCategories()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary-hover"
          >
            <RefreshCcw className="h-4 w-4" />
            Reessayer
          </button>
        </div>
      ) : (
        <div className="card p-0">
          <DataTable
            columns={columns}
            data={paginatedCategories}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            emptyMessage="Aucune categorie trouvee"
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredCategories.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
          />
        </div>
      )}

      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          if (isImporting) return
          setIsImportModalOpen(false)
        }}
        title="Import CSV categories"
        size="lg"
      >
        <div className="space-y-4">
          {isImporting && importProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>Import en cours...</span>
                <span className="font-medium">
                  {importProgress.done} / {importProgress.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${importProgress.total === 0 ? 0 : (importProgress.done / importProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {!isImporting && importResult && (
            <>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
                  <p className="text-lg font-semibold text-dark">{importResult.total}</p>
                </div>
                <div className="rounded-lg border border-status-success/30 bg-status-success/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-status-success">Creees</p>
                  <p className="text-lg font-semibold text-status-success">{importResult.created}</p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary-light/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-primary">Mises a jour</p>
                  <p className="text-lg font-semibold text-primary">{importResult.updated}</p>
                </div>
                <div className="rounded-lg border border-status-error/30 bg-status-error/10 p-3">
                  <p className="text-xs uppercase tracking-wide text-status-error">Echecs</p>
                  <p className="text-lg font-semibold text-status-error">{importResult.failed.length}</p>
                </div>
              </div>

              {importResult.failed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Lignes en echec :</p>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Ligne</th>
                          <th className="px-3 py-2 text-left">Nom</th>
                          <th className="px-3 py-2 text-left">Erreur</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {importResult.failed.map((failure) => (
                          <tr key={`${failure.row}-${failure.name ?? ''}`}>
                            <td className="px-3 py-2 text-gray-600">#{failure.row}</td>
                            <td className="px-3 py-2 text-gray-900">{failure.name || '—'}</td>
                            <td className="px-3 py-2 text-status-error">{failure.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResult.total === 0 && (
                <p className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3 text-sm text-status-warning">
                  Aucune ligne detectee dans le fichier. Verifie que le CSV a une ligne d&apos;entete et au moins une ligne de donnees.
                </p>
              )}
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {!isImporting && importResult && importResult.failed.some((f) => f.raw) && (
              <button
                type="button"
                onClick={() => void retryFailedAsUpdate()}
                className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary-light/50 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light"
                title="Matche chaque ligne en echec a une categorie existante par slug et force un PUT /categories/admin/:id"
              >
                Retenter en update des existantes
              </button>
            )}
            <button
              type="button"
              disabled={isImporting}
              onClick={() => setIsImportModalOpen(false)}
              className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Fermer
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false)
          setDeleteTargetIds([])
        }}
        title="Confirmer la suppression"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Vous allez supprimer {deleteTargetIds.length} categorie{deleteTargetIds.length > 1 ? 's' : ''}. Cette action est irreversible.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsDeleteConfirmOpen(false)
                setDeleteTargetIds([])
              }}
              className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirmedDelete}
              className="rounded-lg bg-status-error px-4 py-2 text-sm text-white transition-colors hover:bg-status-error/90"
            >
              Confirmer la suppression
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          addCategoryForm.reset()
        }}
        title="Ajouter une categorie"
        size="md"
      >
        <form className="space-y-4" onSubmit={handleAddCategory}>
          <FormField
            label="Nom de la categorie"
            htmlFor="category-name"
            error={addCategoryForm.formState.errors.name?.message}
          >
            <input
              id="category-name"
              type="text"
              placeholder="Ex: Equipement diagnostic"
              {...addCategoryForm.register('name')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField
            label="Description"
            htmlFor="category-description"
            error={addCategoryForm.formState.errors.description?.message}
          >
            <textarea
              id="category-description"
              rows={3}
              placeholder="Description de la categorie..."
              {...addCategoryForm.register('description')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField
            label="URL slug"
            htmlFor="category-slug"
            error={addCategoryForm.formState.errors.slug?.message}
          >
            <input
              id="category-slug"
              type="text"
              placeholder="equipement-diagnostic"
              {...addCategoryForm.register('slug')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Image categorie (URL)"
              htmlFor="category-image"
              error={addCategoryForm.formState.errors.image?.message}
            >
              <input
                id="category-image"
                type="url"
                placeholder="https://..."
                {...addCategoryForm.register('image')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
            <FormField
              label="Statut"
              htmlFor="category-status"
              error={addCategoryForm.formState.errors.status?.message}
            >
              <select
                id="category-status"
                {...addCategoryForm.register('status')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormActions>
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false)
                addCategoryForm.reset()
              }}
              className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={addCategoryForm.formState.isSubmitting}>
              Ajouter la categorie
            </button>
          </FormActions>
        </form>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          resetEditCategoryForm()
        }}
        title="Modifier la categorie"
        size="md"
      >
        <form className="space-y-4" onSubmit={handleUpdateCategory}>
          <FormField
            label="Nom de la categorie"
            htmlFor="category-edit-name"
            error={editCategoryForm.formState.errors.name?.message}
          >
            <input
              id="category-edit-name"
              type="text"
              {...editCategoryForm.register('name')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField
            label="Description"
            htmlFor="category-edit-description"
            error={editCategoryForm.formState.errors.description?.message}
          >
            <textarea
              id="category-edit-description"
              rows={3}
              {...editCategoryForm.register('description')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField
            label="URL slug"
            htmlFor="category-edit-slug"
            error={editCategoryForm.formState.errors.slug?.message}
          >
            <input
              id="category-edit-slug"
              type="text"
              {...editCategoryForm.register('slug')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Image categorie (URL)"
              htmlFor="category-edit-image"
              error={editCategoryForm.formState.errors.image?.message}
            >
              <input
                id="category-edit-image"
                type="url"
                {...editCategoryForm.register('image')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
            <FormField
              label="Statut"
              htmlFor="category-edit-status"
              error={editCategoryForm.formState.errors.status?.message}
            >
              <select
                id="category-edit-status"
                {...editCategoryForm.register('status')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
          </div>
          <FormActions>
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false)
                resetEditCategoryForm()
              }}
              className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={editCategoryForm.formState.isSubmitting}>
              Enregistrer les modifications
            </button>
          </FormActions>
        </form>
      </Modal>
    </div>
  )
}
