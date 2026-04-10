'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import PageHeader from '@/components/layout/PageHeader'
import FormField from '@/components/ui/form/FormField'
import FormActions from '@/components/ui/form/FormActions'
import ProductImageManager from '@/components/ui/ProductImageManager'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, categoriesApi, productsApi } from '@/lib/api'
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
  const [images, setImages] = useState<string[]>([])

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
    () => !isSubmitting && !isLoadingCategories && categories.length > 0,
    [categories.length, isLoadingCategories, isSubmitting]
  )

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
      }

      await productsApi.create(payload)

      if (images.length > 0) {
        pushToast({
          type: 'info',
          title: 'Images ajoutees en local',
          message: 'Les images sont pretes cote front. Le rattachement API image sera active des que le backend media est branche.',
        })
      }

      pushToast({
        type: 'success',
        title: 'Produit créé',
        message: `${values.name} a été ajouté au catalogue.`,
      })

      router.push('/products')
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

        <FormField label="Medias produit" htmlFor="product-images">
          <div id="product-images">
            <ProductImageManager images={images} onChange={setImages} />
          </div>
        </FormField>

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
