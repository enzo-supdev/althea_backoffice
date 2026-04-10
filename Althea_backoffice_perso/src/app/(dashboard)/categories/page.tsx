'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import DataTable, { Column } from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import SearchBar from '@/components/ui/SearchBar'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, categoriesApi } from '@/lib/api'
import { Category } from '@/types'
import PageHeader from '@/components/layout/PageHeader'
import FormActions from '@/components/ui/form/FormActions'
import FormField from '@/components/ui/form/FormField'

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
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Ajouter une catégorie
          </button>
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
