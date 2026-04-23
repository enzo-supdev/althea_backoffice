'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import Image from 'next/image'
import Link from 'next/link'
import { Plus, Download, Trash2, Edit, Eye, Upload, FileDown } from 'lucide-react'
import ExportButton from '@/components/ui/ExportButton'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import DataTable, { Column } from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import SearchBar from '@/components/ui/SearchBar'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ProductImageManager from '@/components/ui/ProductImageManager'
import { useToast } from '@/components/ui/ToastProvider'
import { Category, Product, ProductImage } from '@/types'
import { categoriesApi, productsApi, mediaApi, ApiError, resolveMediaUrl } from '@/lib/api'
import { buildCsv, downloadCsv, parseCsv } from '@/lib/csv'
import { formatCurrency, formatDate } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import FormActions from '@/components/ui/form/FormActions'
import FormField from '@/components/ui/form/FormField'

const baseProductFormSchema = z.object({
  name: z.string().trim().min(1, 'Le nom du produit est requis.'),
  description: z.string().trim(),
  priceHT: z.number().min(0, 'Le prix HT doit etre positif.'),
  tva: z.number(),
  categoryId: z.string().trim().min(1, 'La categorie est requise.'),
  stock: z.number().int().min(0, 'Le stock doit etre superieur ou egal a 0.'),
}).superRefine((values, context) => {
  if (![20, 10, 5.5, 0].includes(values.tva)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tva'],
      message: 'TVA non supportee.',
    })
  }
})

const editProductFormSchema = baseProductFormSchema.extend({
  status: z.enum(['published', 'draft', 'archived']),
})

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const getProductHeroUrl = (product: Product): string => {
  if (product.mainImageRef) {
    const matching = product.images.find((img) => img.imageRef === product.mainImageRef)
    return matching?.url ?? resolveMediaUrl(product.mainImageRef)
  }
  return product.images[0]?.url ?? ''
}

type AddProductFormValues = z.infer<typeof baseProductFormSchema>
type EditProductFormValues = z.infer<typeof editProductFormSchema>

type ImportFailure = { row: number; name?: string; error: string; raw?: Record<string, string> }
type ImportResult = {
  total: number
  created: number
  updated: number
  failed: ImportFailure[]
}

function isConflict409(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409
}

const CSV_TEMPLATE_COLUMNS = [
  'name',
  'slug',
  'categorySlug',
  'priceHt',
  'vatRate',
  'stock',
  'status',
  'description',
  'imageUrl',
]

const CSV_TEMPLATE_EXAMPLE_ROWS: string[][] = [
  [
    'Stethoscope Classic',
    'stethoscope-classic',
    '<slug-de-categorie>',
    '89.90',
    '20',
    '50',
    'draft',
    'Stethoscope acoustique double pavillon',
    'https://placehold.co/600x600/14413c/fff9f0.png?text=Stethoscope+Classic',
  ],
  [
    'Tensiometre Manuel',
    '',
    '<slug-de-categorie>',
    '35.00',
    '20',
    '20',
    'published',
    'Tensiometre brassard adulte',
    '',
  ],
]

function buildCsvTemplate(): string {
  return buildCsv(CSV_TEMPLATE_COLUMNS, CSV_TEMPLATE_EXAMPLE_ROWS)
}


export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([])
  const [deleteForce, setDeleteForce] = useState(false)
  const [viewProduct, setViewProduct] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterStock, setFilterStock] = useState<string>('all')
  const [filterDateRange, setFilterDateRange] = useState<string>('all')
  const [filterDeleted, setFilterDeleted] = useState<'hide' | 'only' | 'all'>('hide')
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('')
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { pushToast } = useToast()

  const addProductForm = useForm<AddProductFormValues>({
    resolver: zodResolver(baseProductFormSchema),
    defaultValues: {
      name: '',
      description: '',
      priceHT: 0,
      tva: 20,
      categoryId: '',
      stock: 0,
    },
  })

  const editProductForm = useForm<EditProductFormValues>({
    resolver: zodResolver(editProductFormSchema),
    defaultValues: {
      name: '',
      description: '',
      priceHT: 0,
      tva: 20,
      categoryId: '',
      stock: 0,
      status: 'draft',
    },
  })

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoadError('')
      setIsLoading(true)

      try {
        const [productsResult, categoriesResult] = await Promise.allSettled([
          productsApi.listBackoffice(),
          categoriesApi.list(),
        ])

        if (productsResult.status === 'rejected') {
          throw productsResult.reason
        }

        if (!isMounted) return

        setProducts(productsResult.value)
        setCategories(categoriesResult.status === 'fulfilled' ? categoriesResult.value : [])

        if (categoriesResult.status === 'rejected') {
          pushToast({
            type: 'info',
            title: 'Categories indisponibles',
            message: 'Les produits sont affiches, mais le chargement des categories a echoue.',
          })
        }
      } catch (error) {
        if (!isMounted) return
        setLoadError('Le catalogue produit est indisponible.')

        pushToast({
          type: 'error',
          title: 'Chargement produits impossible',
          message:
            error instanceof ApiError
              ? error.message
              : 'Impossible de charger les produits depuis l\'API pour le moment.',
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [pushToast])

  const retryLoadData = () => {
    setIsLoading(true)
    setLoadError('')
    void Promise.allSettled([productsApi.listBackoffice(), categoriesApi.list()])
      .then(([productsResult, categoriesResult]) => {
        if (productsResult.status === 'rejected') {
          throw productsResult.reason
        }

        setProducts(productsResult.value)
        setCategories(categoriesResult.status === 'fulfilled' ? categoriesResult.value : [])
        setLoadError('')
        setIsLoading(false)

        if (categoriesResult.status === 'rejected') {
          pushToast({
            type: 'info',
            title: 'Categories indisponibles',
            message: 'Les produits sont affiches, mais le chargement des categories a echoue.',
          })
        }
      })
      .catch((error) => {
        setIsLoading(false)
        setLoadError('Le catalogue produit est indisponible.')
        pushToast({
          type: 'error',
          title: 'Rechargement impossible',
          message:
            error instanceof ApiError
              ? error.message
              : 'La tentative de rechargement des produits a echoue. Verifiez l\'API puis reessayez.',
        })
      })
  }

  const selectedProductsSet = useMemo(() => new Set(selectedProducts), [selectedProducts])

  // Filtrage et tri
  const filteredProducts = useMemo(() => {
    let filtered = products.filter((product) => {
      const normalizedQuery = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery) ||
        product.category.name.toLowerCase().includes(normalizedQuery) ||
        String(product.priceHT).includes(normalizedQuery) ||
        String(product.tva).includes(normalizedQuery) ||
        String(product.price).includes(normalizedQuery) ||
        String(product.stock).includes(normalizedQuery) ||
        product.status.toLowerCase().includes(normalizedQuery) ||
        formatDate(product.createdAt).toLowerCase().includes(normalizedQuery)

      const matchesCategory =
        filterCategory === 'all' || product.category.id === filterCategory

      const matchesStatus =
        filterStatus === 'all' || product.status === filterStatus

      const matchesStock =
        filterStock === 'all' ||
        (filterStock === 'in-stock' && product.stock > 0) ||
        (filterStock === 'low-stock' && product.stock > 0 && product.stock < 10) ||
        (filterStock === 'out-of-stock' && product.stock === 0)

      const now = new Date()
      const productCreatedAt = product.createdAt instanceof Date ? product.createdAt : new Date(product.createdAt)
      const dayDifference = (now.getTime() - productCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
      const matchesDate =
        filterDateRange === 'all' ||
        (filterDateRange === '7d' && dayDifference <= 7) ||
        (filterDateRange === '30d' && dayDifference <= 30) ||
        (filterDateRange === '90d' && dayDifference <= 90)

      const isDeleted = Boolean(product.deletedAt)
      const matchesDeleted =
        (filterDeleted === 'hide' && !isDeleted) ||
        (filterDeleted === 'only' && isDeleted) ||
        filterDeleted === 'all'

      return matchesSearch && matchesCategory && matchesStatus && matchesStock && matchesDate && matchesDeleted
    })

    const getSortValue = (product: Product, key: string): string | number => {
      switch (key) {
        case 'name':
          return product.name.toLowerCase()
        case 'category':
          return product.category.name.toLowerCase()
        case 'priceHT':
          return product.priceHT
        case 'tva':
          return product.tva
        case 'price':
          return product.price
        case 'stock':
          return product.stock
        case 'status':
          return product.status
        case 'createdAt':
          return new Date(product.createdAt).getTime()
        default:
          return ''
      }
    }

    filtered.sort((a, b) => {
      const aValue = getSortValue(a, sortKey)
      const bValue = getSortValue(b, sortKey)

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
  }, [products, searchQuery, sortKey, sortDirection, filterCategory, filterStatus, filterStock, filterDateRange, filterDeleted])

  // Pagination
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, currentPage, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))

  const allVisibleSelected =
    paginatedProducts.length > 0 && paginatedProducts.every((product) => selectedProductsSet.has(product.id))

  const someVisibleSelected =
    paginatedProducts.some((product) => selectedProductsSet.has(product.id)) && !allVisibleSelected

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  const toggleVisibleSelection = () => {
    const visibleIds = paginatedProducts.map((product) => product.id)

    if (allVisibleSelected) {
      setSelectedProducts((prev) => prev.filter((id) => !visibleIds.includes(id)))
      return
    }

    setSelectedProducts((prev) => Array.from(new Set([...prev, ...visibleIds])))
  }

  const handleBulkStatusUpdate = async (nextStatus: 'published' | 'draft') => {
    if (selectedProducts.length === 0) return

    try {
      await productsApi.bulkUpdateStatus({ productIds: selectedProducts, status: nextStatus })
      setProducts((prev) =>
        prev.map((product) =>
          selectedProductsSet.has(product.id)
            ? { ...product, status: nextStatus, updatedAt: new Date() }
            : product
        )
      )
      pushToast({
        type: 'success',
        title: 'Produits mis a jour',
        message: `${selectedProducts.length} produit${selectedProducts.length > 1 ? 's' : ''} modifie${selectedProducts.length > 1 ? 's' : ''}.`,
      })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Erreur statut',
        message: error instanceof ApiError ? error.message : 'La mise a jour du statut a echoue.',
      })
    }
  }

  const handleBulkCategoryUpdate = async () => {
    if (selectedProducts.length === 0 || !bulkCategoryId) return

    const targetCategory = categories.find((category) => category.id === bulkCategoryId)
    if (!targetCategory) {
      pushToast({
        type: 'error',
        title: 'Categorie introuvable',
        message: 'Selectionnez une categorie valide.',
      })
      return
    }

    try {
      await productsApi.bulkUpdateCategory({ productIds: selectedProducts, categoryId: bulkCategoryId })
      setProducts((prev) =>
        prev.map((product) =>
          selectedProductsSet.has(product.id)
            ? { ...product, category: targetCategory, updatedAt: new Date() }
            : product
        )
      )
      pushToast({
        type: 'success',
        title: 'Categorie mise a jour',
        message: `${selectedProducts.length} produit${selectedProducts.length > 1 ? 's' : ''} reclassifie${selectedProducts.length > 1 ? 's' : ''}.`,
      })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Erreur categorie',
        message: error instanceof ApiError ? error.message : 'La mise a jour de la categorie a echoue.',
      })
    }
  }

  const openDeleteConfirm = (ids: string[], options?: { force?: boolean }) => {
    if (ids.length === 0) return
    setDeleteTargetIds(ids)
    // Si au moins un produit est deja soft-delete, on coche "force" par defaut
    // (cas typique : vider la corbeille).
    const hasSoftDeleted = ids.some((id) => {
      const product = products.find((p) => p.id === id)
      return product?.deletedAt != null
    })
    setDeleteForce(Boolean(options?.force) || hasSoftDeleted)
    setIsDeleteConfirmOpen(true)
  }

  const handleConfirmedDelete = async () => {
    // Toujours 1 requete par produit (DELETE /products/admin/:id).
    // Le bulk endpoint est indisponible/bogue sur cette API.
    const results = await Promise.allSettled(
      deleteTargetIds.map((id) => productsApi.delete(id, { force: deleteForce })),
    )

    const succeededIds = deleteTargetIds.filter(
      (_, index) => results[index].status === 'fulfilled',
    )
    const failed = results
      .map((result, index) => ({ result, id: deleteTargetIds[index] }))
      .filter((entry) => entry.result.status === 'rejected') as Array<{
        result: PromiseRejectedResult
        id: string
      }>

    if (succeededIds.length > 0) {
      const succeededSet = new Set(succeededIds)
      if (deleteForce) {
        // Hard delete : on retire definitivement du state.
        setProducts((prev) => prev.filter((product) => !succeededSet.has(product.id)))
      } else {
        // Soft delete : on marque deletedAt pour que le filtre "corbeille" affiche.
        setProducts((prev) =>
          prev.map((product) =>
            succeededSet.has(product.id)
              ? { ...product, deletedAt: new Date(), updatedAt: new Date() }
              : product,
          ),
        )
      }
      setSelectedProducts((prev) => prev.filter((id) => !succeededSet.has(id)))
    }

    if (failed.length === 0) {
      pushToast({
        type: 'success',
        title: deleteForce ? 'Suppression definitive' : 'Suppression effectuee',
        message: deleteForce
          ? `${succeededIds.length} produit${succeededIds.length > 1 ? 's' : ''} purge${succeededIds.length > 1 ? 's' : ''}.`
          : `${succeededIds.length} produit${succeededIds.length > 1 ? 's' : ''} en corbeille.`,
      })
      setIsDeleteConfirmOpen(false)
      setDeleteTargetIds([])
      setDeleteForce(false)
    } else {
      const firstError = failed[0].result.reason
      const firstErrorMessage =
        firstError instanceof ApiError
          ? firstError.message
          : firstError instanceof Error
            ? firstError.message
            : 'La suppression a echoue.'
      pushToast({
        type: 'error',
        title:
          succeededIds.length > 0 ? 'Suppression partielle' : 'Suppression impossible',
        message:
          succeededIds.length > 0
            ? `${succeededIds.length} OK, ${failed.length} echec${failed.length > 1 ? 's' : ''}. Premier motif : ${firstErrorMessage}`
            : `${failed.length} echec${failed.length > 1 ? 's' : ''}. Premier motif : ${firstErrorMessage}`,
      })
      // Garde les ids en echec pour retenter.
      setDeleteTargetIds(failed.map((entry) => entry.id))
    }
  }

  const handleRowStatusToggle = async (productId: string) => {
    const target = products.find((product) => product.id === productId)
    if (!target) return

    const nextStatus = target.status === 'published' ? 'draft' : 'published'

    try {
      await productsApi.updateStatus(productId, { status: nextStatus })
      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId ? { ...product, status: nextStatus, updatedAt: new Date() } : product
        )
      )
      pushToast({
        type: 'info',
        title: 'Statut bascule',
        message: `${target.name} a ete mis a jour.`,
      })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Erreur statut',
        message: error instanceof ApiError ? error.message : 'Le changement de statut a echoue.',
      })
    }
  }

  const openEditProduct = (product: Product) => {
    setEditingProduct(product)
    editProductForm.reset({
      name: product.name,
      description: product.description,
      priceHT: product.priceHT,
      tva: product.tva,
      categoryId: product.category.id,
      stock: product.stock,
      status: product.status,
    })
    setIsEditModalOpen(true)
  }

  const handleEditImagesChange = (nextImages: ProductImage[]) => {
    setEditingProduct((prev) => prev ? { ...prev, images: nextImages } : prev)
    setProducts((prev) =>
      prev.map((p) => (editingProduct && p.id === editingProduct.id ? { ...p, images: nextImages } : p))
    )
  }

  const handleEditMainImageRefChange = (nextMainImageRef: string | null) => {
    setEditingProduct((prev) => prev ? { ...prev, mainImageRef: nextMainImageRef } : prev)
    setProducts((prev) =>
      prev.map((p) => (editingProduct && p.id === editingProduct.id ? { ...p, mainImageRef: nextMainImageRef } : p))
    )
  }

  const handleAddProduct = addProductForm.handleSubmit(async (values) => {
    try {
      const created = await productsApi.create({
        name: values.name.trim(),
        slug: toSlug(values.name),
        description: values.description.trim(),
        shortDescription: '',
        priceHt: values.priceHT,
        vatRate: values.tva,
        categoryId: values.categoryId,
        stock: values.stock,
        status: 'draft',
      })
      setProducts((prev) => [created, ...prev])
      setIsAddModalOpen(false)
      addProductForm.reset()
      pushToast({
        type: 'success',
        title: 'Produit ajoute',
        message: `${created.name} a ete cree en brouillon.`,
      })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Erreur creation',
        message: error instanceof ApiError ? error.message : 'La creation du produit a echoue.',
      })
    }
  })

  const handleUpdateProduct = editProductForm.handleSubmit(async (values) => {
    if (!editingProduct) return

    try {
      const updated = await productsApi.update(editingProduct.id, {
        name: values.name.trim(),
        slug: toSlug(values.name),
        description: values.description.trim(),
        priceHt: values.priceHT,
        vatRate: values.tva,
        categoryId: values.categoryId,
        stock: values.stock,
        status: values.status,
      })
      setProducts((prev) =>
        prev.map((product) => (product.id === editingProduct.id ? updated : product))
      )
      setIsEditModalOpen(false)
      setEditingProduct(null)
      editProductForm.reset()
      pushToast({
        type: 'success',
        title: 'Produit mis a jour',
        message: `${updated.name} a ete enregistre.`,
      })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Erreur mise a jour',
        message: error instanceof ApiError ? error.message : 'La mise a jour du produit a echoue.',
      })
    }
  })

  const handleDownloadTemplate = () => {
    downloadCsv('produits-template.csv', buildCsvTemplate())
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

    const categoryBySlug = new Map(
      categories.map((category) => [category.slug.toLowerCase(), category.id]),
    )
    const upsertedProducts: Product[] = []
    const failed: ImportFailure[] = []
    let created = 0
    let updated = 0

    // Pre-charge la liste admin pour resoudre les slugs existants en un seul
    // appel. La route publique GET /products/:slug exclut les drafts et renvoie
    // une forme imbriquee, donc on prefere la liste admin comme source.
    let existingBySlug = new Map<string, string>()
    try {
      const existingAdmin = await productsApi.listBackoffice()
      existingBySlug = new Map(
        existingAdmin.map((p) => [p.slug.toLowerCase(), p.id]),
      )
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

        const rawCategorySlug = (row.categorySlug || row.category || '').trim().toLowerCase()
        if (!rawCategorySlug) throw new Error('Colonne "categorySlug" vide.')
        const categoryId = categoryBySlug.get(rawCategorySlug)
        if (!categoryId) throw new Error(`Categorie introuvable pour le slug "${rawCategorySlug}".`)

        const priceHtRaw = (row.priceHt || row.priceHT || row.prix_ht || '').replace(',', '.')
        const priceHt = Number(priceHtRaw)
        if (!Number.isFinite(priceHt) || priceHt < 0) {
          throw new Error(`priceHt invalide : "${row.priceHt}".`)
        }

        const vatRaw = (row.vatRate || row.tva || '').replace(',', '.')
        const vatRate = vatRaw === '' ? 20 : Number(vatRaw)
        if (![0, 5.5, 10, 20].includes(vatRate)) {
          throw new Error(`vatRate non supporte : "${row.vatRate}". Valeurs : 0, 5.5, 10, 20.`)
        }

        const stockRaw = row.stock ?? ''
        const stock = stockRaw === '' ? 0 : Number(stockRaw)
        if (!Number.isInteger(stock) || stock < 0) {
          throw new Error(`stock invalide : "${row.stock}".`)
        }

        const statusRaw = (row.status || 'draft').toLowerCase()
        if (statusRaw !== 'draft' && statusRaw !== 'published') {
          throw new Error(`status invalide : "${row.status}". Valeurs : draft, published.`)
        }

        const slug = row.slug?.trim() || toSlug(name)

        let mainImageRef: string | undefined
        const imageUrl = row.imageUrl?.trim()
        if (imageUrl) {
          try {
            const uploaded = await mediaApi.uploadFromUrl(imageUrl, `${slug}.png`)
            mainImageRef = uploaded.ref
          } catch (imageError) {
            const msg =
              imageError instanceof Error ? imageError.message : 'upload image echoue'
            throw new Error(`Image "${imageUrl}" : ${msg}`)
          }
        }

        const payload = {
          name,
          slug,
          description: row.description?.trim() || '',
          shortDescription: '',
          priceHt,
          vatRate,
          stock,
          categoryId,
          status: statusRaw as 'draft' | 'published',
          ...(mainImageRef ? { mainImageRef } : {}),
        }

        const updatePayload = {
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
          shortDescription: payload.shortDescription,
          priceHt: payload.priceHt,
          vatRate: payload.vatRate,
          stock: payload.stock,
          categoryId: payload.categoryId,
          status: payload.status,
          ...(mainImageRef ? { mainImageRef } : {}),
        }

        const cachedId = existingBySlug.get(slug.toLowerCase())
        if (cachedId) {
          const updatedProduct = await productsApi.update(cachedId, updatePayload)
          upsertedProducts.push(updatedProduct)
          updated += 1
        } else {
          try {
            const createdProduct = await productsApi.create(payload)
            existingBySlug.set(slug.toLowerCase(), createdProduct.id)
            upsertedProducts.push(createdProduct)
            created += 1
          } catch (createError) {
            if (!isConflict409(createError)) throw createError

            // Race ou cache obsolete : refetch et retry via update.
            const refreshed = await productsApi.listBackoffice()
            existingBySlug = new Map(
              refreshed.map((p) => [p.slug.toLowerCase(), p.id]),
            )
            const foundId = existingBySlug.get(slug.toLowerCase())
            if (!foundId) {
              throw new Error('Conflit 409 mais produit introuvable apres refetch.')
            }
            const updatedProduct = await productsApi.update(foundId, updatePayload)
            upsertedProducts.push(updatedProduct)
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

    if (upsertedProducts.length > 0) {
      const upsertedIds = new Set(upsertedProducts.map((p) => p.id))
      setProducts((prev) => [
        ...upsertedProducts,
        ...prev.filter((p) => !upsertedIds.has(p.id)),
      ])
    }

    setImportResult({ total: rows.length, created, updated, failed })
    setIsImporting(false)

    const succeeded = created + updated

    if (failed.length === 0 && succeeded > 0) {
      pushToast({
        type: 'success',
        title: 'Import termine',
        message: `${created} cree${created > 1 ? 's' : ''}, ${updated} mis a jour.`,
      })
    } else if (succeeded > 0) {
      pushToast({
        type: 'info',
        title: 'Import partiel',
        message: `${created} crees, ${updated} mis a jour, ${failed.length} echec${failed.length > 1 ? 's' : ''}.`,
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
    let productBySlug = new Map<string, string>()
    try {
      const adminList = await productsApi.listBackoffice()
      productBySlug = new Map(adminList.map((p) => [p.slug.toLowerCase(), p.id]))
    } catch {
      // On continue sans cache — le lookup echouera ligne par ligne si besoin.
    }

    const categoryBySlug = new Map(
      categories.map((category) => [category.slug.toLowerCase(), category.id]),
    )

    const stillFailed: ImportFailure[] = []
    const upserted: Product[] = []
    let retryUpdated = 0

    for (let i = 0; i < failedWithRaw.length; i++) {
      const failure = failedWithRaw[i]
      const row = failure.raw as Record<string, string>
      try {
        const name = row.name?.trim()
        if (!name) throw new Error('Colonne "name" vide.')

        const rawCategorySlug = (row.categorySlug || row.category || '').trim().toLowerCase()
        if (!rawCategorySlug) throw new Error('Colonne "categorySlug" vide.')
        const categoryId = categoryBySlug.get(rawCategorySlug)
        if (!categoryId) throw new Error(`Categorie introuvable pour le slug "${rawCategorySlug}".`)

        const priceHtRaw = (row.priceHt || row.priceHT || row.prix_ht || '').replace(',', '.')
        const priceHt = Number(priceHtRaw)
        if (!Number.isFinite(priceHt) || priceHt < 0) {
          throw new Error(`priceHt invalide : "${row.priceHt}".`)
        }

        const vatRaw = (row.vatRate || row.tva || '').replace(',', '.')
        const vatRate = vatRaw === '' ? 20 : Number(vatRaw)
        if (![0, 5.5, 10, 20].includes(vatRate)) {
          throw new Error(`vatRate non supporte : "${row.vatRate}".`)
        }

        const stockRaw = row.stock ?? ''
        const stock = stockRaw === '' ? 0 : Number(stockRaw)
        if (!Number.isInteger(stock) || stock < 0) {
          throw new Error(`stock invalide : "${row.stock}".`)
        }

        const statusRaw = (row.status || 'draft').toLowerCase()
        if (statusRaw !== 'draft' && statusRaw !== 'published') {
          throw new Error(`status invalide : "${row.status}".`)
        }

        const slug = row.slug?.trim() || toSlug(name)
        const existingId = productBySlug.get(slug.toLowerCase())
        if (!existingId) {
          throw new Error(`Aucun produit existant avec slug "${slug}" — retry se limite a l'update.`)
        }

        let mainImageRef: string | undefined
        const imageUrl = row.imageUrl?.trim()
        if (imageUrl) {
          const uploaded = await mediaApi.uploadFromUrl(imageUrl, `${slug}.png`)
          mainImageRef = uploaded.ref
        }

        const updatePayload = {
          name,
          slug,
          description: row.description?.trim() || '',
          shortDescription: '',
          priceHt,
          vatRate,
          stock,
          categoryId,
          status: statusRaw as 'draft' | 'published',
          ...(mainImageRef ? { mainImageRef } : {}),
        }

        const updatedProduct = await productsApi.update(existingId, updatePayload)
        upserted.push(updatedProduct)
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

    if (upserted.length > 0) {
      const upsertedIds = new Set(upserted.map((p) => p.id))
      setProducts((prev) => [
        ...upserted,
        ...prev.filter((p) => !upsertedIds.has(p.id)),
      ])
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
        message: `${retryUpdated} produit${retryUpdated > 1 ? 's' : ''} mis a jour via update.`,
      })
    } else {
      pushToast({
        type: 'info',
        title: 'Retry partiel',
        message: `${retryUpdated} OK, ${stillFailed.length} echec${stillFailed.length > 1 ? 's' : ''} restant${stillFailed.length > 1 ? 's' : ''}.`,
      })
    }
  }

  const handleBulkExport = (format: 'csv' | 'excel') => {
    if (selectedProducts.length === 0) return

    const rows = products.filter((product) => selectedProductsSet.has(product.id))
    const header = ['id', 'nom', 'description', 'categorie', 'prix_ht', 'tva', 'prix_ttc', 'stock', 'statut', 'date_creation']
    const body = rows.map((product) => [
      product.id,
      product.name,
      product.description,
      product.category.name,
      product.priceHT.toFixed(2),
      String(product.tva),
      product.price.toFixed(2),
      String(product.stock),
      product.status,
      formatDate(product.createdAt),
    ])

    const delimiter = format === 'csv' ? ';' : '\t'
    const content = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(delimiter))
      .join('\n')

    const blob = new Blob([content], {
      type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = format === 'csv' ? 'produits-selection.csv' : 'produits-selection.xls'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const columns: Column<Product>[] = [
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
          aria-label="Selectionner tous les produits visibles"
        />
      ),
      render: (product) => (
        <input
          type="checkbox"
          checked={selectedProductsSet.has(product.id)}
          onChange={() => toggleProductSelection(product.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          aria-label={`Selectionner ${product.name}`}
        />
      ),
    },
    {
      key: 'image',
      label: 'Image',
      render: (product) => {
        const heroUrl = getProductHeroUrl(product)
        return (
        <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-gray-100">
          {heroUrl ? (
            <Image
              src={heroUrl}
              alt={product.name}
              width={48}
              height={48}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              IMG
            </div>
          )}
        </div>
        )
      },
    },
    {
      key: 'name',
      label: 'Nom du produit',
      sortable: true,
      render: (product) => (
        <div>
          <div className="font-medium text-gray-900">{product.name}</div>
          <div className="text-sm text-gray-500 truncate max-w-xs">
            {product.description}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Catégorie',
      sortable: true,
      render: (product) => product.category.name,
    },
    {
      key: 'priceHT',
      label: 'Prix HT',
      sortable: true,
      render: (product) => (
        <span className="text-gray-900">{formatCurrency(product.priceHT)}</span>
      ),
    },
    {
      key: 'tva',
      label: 'TVA',
      sortable: true,
      render: (product) => <span className="text-gray-600">{product.tva}%</span>,
    },
    {
      key: 'price',
      label: 'Prix TTC',
      sortable: true,
      render: (product) => (
        <span className="font-medium text-gray-900">
          {formatCurrency(product.price)}
        </span>
      ),
    },
    {
      key: 'stock',
      label: 'Stock',
      sortable: true,
      render: (product) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-900">{product.stock}</span>
          {product.stock === 0 && <Badge variant="error">Rupture</Badge>}
          {product.stock > 0 && product.stock < 10 && (
            <Badge variant="warning">Faible</Badge>
          )}
          {product.stock >= 10 && <Badge variant="success">Disponible</Badge>}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      render: (product) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleRowStatusToggle(product.id)}
            title={product.status === 'published' ? 'Cliquer pour mettre en brouillon' : 'Cliquer pour publier'}
            className="rounded transition-opacity hover:opacity-70"
            disabled={Boolean(product.deletedAt)}
          >
            <Badge variant={product.status === 'published' ? 'success' : 'default'}>
              {product.status === 'published' ? 'Publié' : 'Brouillon'}
            </Badge>
          </button>
          {product.deletedAt && (
            <span title={`Soft-delete le ${formatDate(product.deletedAt)}`}>
              <Badge variant="error">Corbeille</Badge>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date de création',
      sortable: true,
      render: (product) => (
        <span className="text-gray-600">{formatDate(product.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (product) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/products/${product.id}`}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
            aria-label={`Voir ${product.name}`}
          >
            <Eye className="h-4 w-4" />
          </Link>
          <Link
            href={`/products/${product.id}?edit=1`}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
            aria-label={`Modifier ${product.name}`}
          >
            <Edit className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => openDeleteConfirm([product.id])}
            className="rounded p-1 text-gray-600 transition-colors hover:text-status-error"
            aria-label={`Supprimer ${product.name}`}
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
        title="Gestion des produits"
        description={`${filteredProducts.length} produit${filteredProducts.length > 1 ? 's' : ''} dans le catalogue.`}
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
            <ExportButton
              fetcher={() => productsApi.exportCsv()}
              filename={`produits-${new Date().toISOString().slice(0, 10)}.csv`}
              label="Exporter CSV"
            />
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Ajouter un produit
            </button>
          </>
        )}
      />

      <div className="app-panel space-y-4 p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <SearchBar
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value)
              setCurrentPage(1)
            }}
            placeholder="Rechercher un produit..."
            ariaLabel="Rechercher un produit"
          />
          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value)
              setCurrentPage(1)
            }}
            className="input-base bg-shell-surface"
          >
            <option value="all">Toutes les catégories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setCurrentPage(1)
            }}
            className="input-base bg-shell-surface"
          >
            <option value="all">Tous les statuts</option>
            <option value="published">Publié</option>
            <option value="draft">Brouillon</option>
          </select>
          <select
            value={filterStock}
            onChange={(e) => {
              setFilterStock(e.target.value)
              setCurrentPage(1)
            }}
            className="input-base bg-shell-surface"
          >
            <option value="all">Tout le stock</option>
            <option value="in-stock">En stock</option>
            <option value="low-stock">Stock faible</option>
            <option value="out-of-stock">Rupture</option>
          </select>
          <select
            value={filterDateRange}
            onChange={(e) => {
              setFilterDateRange(e.target.value)
              setCurrentPage(1)
            }}
            className="input-base bg-shell-surface"
          >
            <option value="all">Toutes dates</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
          </select>
          <select
            value={filterDeleted}
            onChange={(e) => {
              setFilterDeleted(e.target.value as 'hide' | 'only' | 'all')
              setCurrentPage(1)
            }}
            className="input-base bg-shell-surface"
            aria-label="Filtrer par corbeille"
          >
            <option value="hide">Corbeille masquee</option>
            <option value="only">Corbeille seulement</option>
            <option value="all">Tout (actifs + corbeille)</option>
          </select>
        </div>

        {selectedProducts.length > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-primary/10 bg-primary-light/50 p-4">
            <span className="text-sm font-medium text-dark">
              {selectedProducts.length} produit{selectedProducts.length > 1 ? 's' : ''}{' '}
              sélectionné{selectedProducts.length > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => handleBulkStatusUpdate('published')}
              className="rounded-lg bg-dark px-4 py-2 text-sm text-white transition-colors hover:bg-dark/90"
            >
              Publier
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatusUpdate('draft')}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800"
            >
              Mettre en brouillon
            </button>
            <button
              type="button"
              onClick={() => openDeleteConfirm(selectedProducts)}
              className="flex items-center gap-2 rounded-lg bg-status-error px-4 py-2 text-sm text-white transition-colors hover:bg-status-error/90"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => handleBulkExport('csv')}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary-hover"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleBulkExport('excel')}
              className="flex items-center gap-2 rounded-lg bg-dark px-4 py-2 text-sm text-white transition-colors hover:bg-dark/90"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
            <div className="flex items-center gap-2">
              <select
                value={bulkCategoryId}
                onChange={(event) => setBulkCategoryId(event.target.value)}
                className="input-base bg-shell-surface text-sm"
              >
                <option value="">Changer categorie...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleBulkCategoryUpdate}
                disabled={!bulkCategoryId}
                className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Appliquer
              </button>
            </div>
          </div>
        )}
      </div>

      {loadError ? (
        <div className="card space-y-4 text-center" role="alert" aria-live="assertive" aria-atomic="true">
          <div>
            <h3 className="text-lg font-heading font-semibold text-dark">Chargement impossible</h3>
            <p className="mt-1 text-sm text-gray-600">{loadError}</p>
          </div>
          <div className="flex justify-center">
            <button type="button" onClick={retryLoadData} className="btn-primary">
              Reessayer
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-0">
          <DataTable
            columns={columns}
            data={paginatedProducts}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            emptyMessage="Aucun produit trouve"
            isLoading={isLoading}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredProducts.length}
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
        title="Import CSV produits"
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
                  <p className="text-xs uppercase tracking-wide text-status-success">Crees</p>
                  <p className="text-lg font-semibold text-status-success">{importResult.created}</p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary-light/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-primary">Mis a jour</p>
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
                title="Matche chaque ligne en echec a un produit existant par slug et force un PUT /products/admin/:id"
              >
                Retenter en update des existants
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
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Confirmer la suppression"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Vous allez supprimer {deleteTargetIds.length} produit{deleteTargetIds.length > 1 ? 's' : ''}.
            {deleteForce
              ? ' Cette action sera definitive (purge DB via ?force=true).'
              : ' Par defaut l\'API fait un soft delete : les produits restent en base avec un flag deletedAt.'}
          </p>

          <label className="flex items-start gap-3 rounded-lg border border-status-error/30 bg-status-error/5 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={deleteForce}
              onChange={(event) => setDeleteForce(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-status-error focus:ring-status-error"
            />
            <span>
              <span className="font-medium text-status-error">Suppression definitive (hard delete)</span>
              <br />
              Ajoute <code className="rounded bg-gray-100 px-1 text-xs">?force=true</code> a la requete.
              A utiliser pour purger la corbeille. Si l&apos;API ne supporte pas ce parametre, l&apos;effet
              sera identique a un soft delete.
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirmedDelete}
              className="rounded-lg bg-status-error px-4 py-2 text-sm text-white transition-colors hover:bg-status-error/90"
            >
              {deleteForce ? 'Purger definitivement' : 'Confirmer la suppression'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!viewProduct}
        onClose={() => setViewProduct(null)}
        title="Detail du produit"
        size="md"
      >
        {viewProduct && (
          <div className="space-y-4 text-sm text-gray-700">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {(() => {
                const heroUrl = getProductHeroUrl(viewProduct)
                return heroUrl ? (
                  <Image
                    src={heroUrl}
                    alt={viewProduct.name}
                    width={720}
                    height={320}
                    className="h-56 w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center text-gray-400">
                    Aucune image
                  </div>
                )
              })()}
            </div>
            <p><span className="font-medium text-dark">Nom:</span> {viewProduct.name}</p>
            <p><span className="font-medium text-dark">Categorie:</span> {viewProduct.category.name}</p>
            <p><span className="font-medium text-dark">Prix TTC:</span> {formatCurrency(viewProduct.price)}</p>
            <p><span className="font-medium text-dark">Stock:</span> {viewProduct.stock}</p>
            <p><span className="font-medium text-dark">Statut:</span> {viewProduct.status === 'published' ? 'Publie' : 'Brouillon'}</p>
            <p><span className="font-medium text-dark">Description:</span> {viewProduct.description}</p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingProduct(null)
          editProductForm.reset()
        }}
        title="Modifier le produit"
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleUpdateProduct}>
          <FormField label="Nom du produit" htmlFor="edit-product-name" error={editProductForm.formState.errors.name?.message}>
            <input
              id="edit-product-name"
              type="text"
              {...editProductForm.register('name')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <FormField label="Description" htmlFor="edit-product-description" error={editProductForm.formState.errors.description?.message}>
            <textarea
              id="edit-product-description"
              rows={3}
              {...editProductForm.register('description')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Prix HT" htmlFor="edit-product-price" error={editProductForm.formState.errors.priceHT?.message}>
              <input
                id="edit-product-price"
                type="number"
                step="0.01"
                {...editProductForm.register('priceHT', { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
            <FormField label="TVA (%)" htmlFor="edit-product-tva" error={editProductForm.formState.errors.tva?.message}>
              <select
                id="edit-product-tva"
                {...editProductForm.register('tva', { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="20">20%</option>
                <option value="10">10%</option>
                <option value="5.5">5.5%</option>
                <option value="0">0%</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Categorie" htmlFor="edit-product-category" error={editProductForm.formState.errors.categoryId?.message}>
              <select
                id="edit-product-category"
                {...editProductForm.register('categoryId')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Stock" htmlFor="edit-product-stock" error={editProductForm.formState.errors.stock?.message}>
              <input
                id="edit-product-stock"
                type="number"
                {...editProductForm.register('stock', { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>
          </div>
          <FormField label="Statut" htmlFor="edit-product-status" error={editProductForm.formState.errors.status?.message}>
            <select
              id="edit-product-status"
              {...editProductForm.register('status')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="published">Publié</option>
              <option value="draft">Brouillon</option>
            </select>
          </FormField>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Images du produit</p>
            {editingProduct && (
              <ProductImageManager
                productId={editingProduct.id}
                images={editingProduct.images}
                mainImageRef={editingProduct.mainImageRef}
                onImagesChange={handleEditImagesChange}
                onMainImageRefChange={handleEditMainImageRefChange}
                onError={(msg) => pushToast({ type: 'error', title: 'Erreur image', message: msg })}
              />
            )}
          </div>
          <FormActions className="pt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingProduct(null)
                editProductForm.reset()
              }}
              className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={editProductForm.formState.isSubmitting}>
              Enregistrer les modifications
            </button>
          </FormActions>
        </form>
      </Modal>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false)
          addProductForm.reset()
        }}
        title="Ajouter un produit"
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleAddProduct}>
          <FormField label="Nom du produit" htmlFor="add-product-name" error={addProductForm.formState.errors.name?.message}>
            <input
              id="add-product-name"
              type="text"
              {...addProductForm.register('name')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ex: Stéthoscope Littmann"
            />
          </FormField>
          <FormField label="Description" htmlFor="add-product-description" error={addProductForm.formState.errors.description?.message}>
            <textarea
              id="add-product-description"
              rows={3}
              {...addProductForm.register('description')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Description détaillée du produit..."
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prix HT" htmlFor="add-product-price" error={addProductForm.formState.errors.priceHT?.message}>
              <input
                id="add-product-price"
                type="number"
                step="0.01"
                {...addProductForm.register('priceHT', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0.00"
              />
            </FormField>
            <FormField label="TVA (%)" htmlFor="add-product-tva" error={addProductForm.formState.errors.tva?.message}>
              <select
                id="add-product-tva"
                {...addProductForm.register('tva', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="20">20%</option>
                <option value="10">10%</option>
                <option value="5.5">5.5%</option>
                <option value="0">0%</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Categorie" htmlFor="add-product-category" error={addProductForm.formState.errors.categoryId?.message}>
              <select
                id="add-product-category"
                {...addProductForm.register('categoryId')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sélectionner une catégorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Stock" htmlFor="add-product-stock" error={addProductForm.formState.errors.stock?.message}>
              <input
                id="add-product-stock"
                type="number"
                {...addProductForm.register('stock', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0"
              />
            </FormField>
          </div>
          <p className="text-xs text-gray-500">
            Les images peuvent etre ajoutees apres la creation du produit via le bouton Modifier.
          </p>
          <FormActions className="pt-4">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false)
                addProductForm.reset()
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={addProductForm.formState.isSubmitting}>
              Ajouter le produit
            </button>
          </FormActions>
        </form>
      </Modal>
    </div>
  )
}
