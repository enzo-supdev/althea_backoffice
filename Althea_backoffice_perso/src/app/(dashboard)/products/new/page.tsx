'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Upload, Loader2, X } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import FormField from '@/components/ui/form/FormField'
import FormActions from '@/components/ui/form/FormActions'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, categoriesApi, productsApi } from '@/lib/api'
import { mediaApi } from '@/lib/api/mediaApi'
import { formatCurrency } from '@/lib/utils'
import type { Category } from '@/types'
import type { CreateProductRequest } from '@/lib/api/types'

const productFormSchema = z.object({
  name: z.string().trim().min(2, 'Le nom du produit doit contenir au moins 2 caractères.'),
  slug: z.string().trim().min(2, 'Le slug est requis.'),
  shortDescription: z.string().trim().min(5, 'Le résumé doit contenir au moins 5 caractères.'),
  description: z.string().trim().min(10, 'La description doit contenir au moins 10 caractères.'),
  priceHt: z.number().min(0, 'Le prix HT doit être positif.'),
  vatRate: z.number().refine((value) => [20, 10, 5.5, 0].includes(value), 'TVA non supportée.'),
  stock: z.number().int().min(0, 'Le stock doit être supérieur ou égal à 0.'),
  categoryId: z.string().trim().min(1, 'La catégorie est requise.'),
  status: z.enum(['draft', 'published']),
})

type ProductFormValues = z.infer<typeof productFormSchema>

const normalizeSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export default function NewProductPage() {
  const router = useRouter()
  const { pushToast } = useToast()

  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mainImageRef, setMainImageRef] = useState<string | null>(null)
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      shortDescription: '',
      description: '',
      priceHt: 0,
      vatRate: 20,
      stock: 0,
      categoryId: '',
      status: 'draft',
    },
  })

  const watchedName = form.watch('name')
  const watchedSlug = form.watch('slug')
  const watchedPriceHt = form.watch('priceHt')
  const watchedVatRate = form.watch('vatRate')
  const livePriceTtc = useMemo(() => {
    const priceHt = Number(watchedPriceHt)
    const vatRate = Number(watchedVatRate)
    if (Number.isNaN(priceHt) || Number.isNaN(vatRate)) {
      return 0
    }

    return Number((priceHt * (1 + vatRate / 100)).toFixed(2))
  }, [watchedPriceHt, watchedVatRate])

  useEffect(() => {
    const generatedSlug = normalizeSlug(watchedName)

    if (!generatedSlug) {
      return
    }

    if (!watchedSlug || watchedSlug === normalizeSlug(watchedSlug)) {
      form.setValue('slug', generatedSlug)
    }
  }, [form, watchedName, watchedSlug])

  useEffect(() => {
    let isMounted = true

    const loadCategories = async () => {
      setIsLoadingCategories(true)

      try {
        const loadedCategories = await categoriesApi.listAdmin()

        if (!isMounted) {
          return
        }

        setCategories(loadedCategories)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setCategories([])
        pushToast({
          type: 'error',
          title: 'Chargement catégories impossible',
          message:
            error instanceof ApiError
              ? error.message
              : 'Impossible de charger les catégories produit.',
        })
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false)
        }
      }
    }

    void loadCategories()

    return () => {
      isMounted = false
    }
  }, [pushToast])

  const canSubmit = useMemo(
    () => !isSubmitting && !isLoadingCategories && !isUploadingImage && categories.length > 0,
    [categories.length, isLoadingCategories, isSubmitting, isUploadingImage]
  )

  const handleImageFile = async (file: File) => {
    setIsUploadingImage(true)
    setMainImagePreview(URL.createObjectURL(file))
    try {
      const uploaded = await mediaApi.upload(file)
      setMainImageRef(uploaded.ref)
    } catch {
      pushToast({ type: 'error', title: 'Upload image échoué', message: 'L\'image n\'a pas pu être uploadée.' })
      setMainImagePreview(null)
      setMainImageRef(null)
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true)

    try {
      const payload: CreateProductRequest = {
        name: values.name.trim(),
        slug: normalizeSlug(values.slug),
        description: values.description.trim(),
        shortDescription: values.shortDescription.trim(),
        priceHt: values.priceHt,
        vatRate: values.vatRate,
        stock: values.stock,
        categoryId: values.categoryId,
        status: values.status,
        ...(mainImageRef ? { mainImageRef } : {}),
      }

      const created = await productsApi.create(payload)

      pushToast({
        type: 'success',
        title: 'Produit créé',
        message: `${values.name} a été ajouté.${mainImageRef ? '' : ' Vous pouvez maintenant ajouter des images.'}`,
      })

      router.push(`/products/${created.id}?edit=1`)
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Création impossible',
        message:
          error instanceof ApiError
            ? error.message
            : 'La création du produit a échoué. Vérifie les champs puis réessaie.',
      })
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Nouveau produit"
        description="Crée un produit et publie-le immédiatement ou en brouillon."
      />

      <form onSubmit={handleSubmit} className="app-panel p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Nom du produit" htmlFor="name" error={form.formState.errors.name?.message}>
            <input
              id="name"
              type="text"
              className="input-base"
              disabled={isSubmitting}
              {...form.register('name')}
            />
          </FormField>

          <FormField label="Slug" htmlFor="slug" hint="Généré automatiquement, modifiable" error={form.formState.errors.slug?.message}>
            <input
              id="slug"
              type="text"
              className="input-base"
              disabled={isSubmitting}
              {...form.register('slug')}
            />
          </FormField>
        </div>

        <FormField
          label="Résumé court"
          htmlFor="shortDescription"
          error={form.formState.errors.shortDescription?.message}
        >
          <input
            id="shortDescription"
            type="text"
            className="input-base"
            disabled={isSubmitting}
            {...form.register('shortDescription')}
          />
        </FormField>

        <FormField label="Description" htmlFor="description" error={form.formState.errors.description?.message}>
          <textarea
            id="description"
            className="input-base min-h-[140px]"
            disabled={isSubmitting}
            {...form.register('description')}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <FormField label="Prix HT" htmlFor="priceHt" error={form.formState.errors.priceHt?.message}>
            <input
              id="priceHt"
              type="number"
              min={0}
              step="0.01"
              className="input-base"
              disabled={isSubmitting}
              {...form.register('priceHt', { valueAsNumber: true })}
            />
          </FormField>

          <FormField label="TVA" htmlFor="vatRate" error={form.formState.errors.vatRate?.message}>
            <select
              id="vatRate"
              className="input-base"
              disabled={isSubmitting}
              {...form.register('vatRate', { valueAsNumber: true })}
            >
              <option value={20}>20%</option>
              <option value={10}>10%</option>
              <option value={5.5}>5.5%</option>
              <option value={0}>0%</option>
            </select>
          </FormField>

          <FormField label="Stock" htmlFor="stock" error={form.formState.errors.stock?.message}>
            <input
              id="stock"
              type="number"
              min={0}
              step={1}
              className="input-base"
              disabled={isSubmitting}
              {...form.register('stock', { valueAsNumber: true })}
            />
          </FormField>

          <FormField label="Statut" htmlFor="status" error={form.formState.errors.status?.message}>
            <select
              id="status"
              className="input-base"
              disabled={isSubmitting}
              {...form.register('status')}
            >
              <option value="draft">Brouillon</option>
              <option value="published">Publié</option>
            </select>
          </FormField>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary-light/30 px-4 py-3 text-sm text-dark">
          <span className="font-medium">Prix TTC calcule en direct:</span>{' '}
          <span className="font-semibold">{formatCurrency(livePriceTtc)}</span>
        </div>

        <FormField label="Catégorie" htmlFor="categoryId" error={form.formState.errors.categoryId?.message}>
          <select
            id="categoryId"
            className="input-base"
            disabled={isSubmitting || isLoadingCategories || categories.length === 0}
            {...form.register('categoryId')}
          >
            <option value="">
              {isLoadingCategories
                ? 'Chargement des catégories...'
                : categories.length > 0
                  ? 'Sélectionner une catégorie'
                  : 'Aucune catégorie disponible'}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Image principale <span className="font-normal text-gray-400">(optionnel)</span></p>
          <div
            className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files?.[0]
              if (file) void handleImageFile(file)
            }}
          >
            {mainImagePreview ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mainImagePreview} alt="Aperçu" className="h-16 w-16 rounded object-cover" />
                <div className="flex-1 text-sm text-gray-600">
                  {isUploadingImage ? 'Upload en cours...' : 'Image prête'}
                </div>
                <button
                  type="button"
                  onClick={() => { setMainImagePreview(null); setMainImageRef(null) }}
                  className="rounded p-1 text-gray-400 hover:text-status-error"
                  title="Supprimer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="flex-1 text-sm text-gray-500">Glisser-déposer ou choisir un fichier. D&apos;autres images pourront être ajoutées après création.</p>
                <button
                  type="button"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60"
                >
                  {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Choisir
                </button>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImageFile(file)
              e.target.value = ''
            }}
          />
        </div>

        <FormActions>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-dark transition-colors hover:bg-primary-light/40"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Création...' : 'Créer le produit'}
          </button>
        </FormActions>
      </form>
    </div>
  )
}
