'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import PageHeader from '@/components/layout/PageHeader'
import FormField from '@/components/ui/form/FormField'
import FormActions from '@/components/ui/form/FormActions'
import Badge from '@/components/ui/Badge'
import ProductImageManager from '@/components/ui/ProductImageManager'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, categoriesApi, productsApi, resolveMediaUrl } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Category, Product, ProductImage } from '@/types'

const toSlug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

type ProductEdition = {
  name: string
  description: string
  priceHT: number
  tva: number
  stock: number
  categoryId: string
  status: 'published' | 'draft' | 'archived'
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { pushToast } = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const isEditMode = searchParams.get('edit') === '1'

  const form = useForm<ProductEdition>({
    defaultValues: {
      name: '',
      description: '',
      priceHT: 0,
      tva: 20,
      stock: 0,
      categoryId: '',
      status: 'draft',
    },
  })

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setIsLoading(true)

      try {
        const [productData, allCategories] = await Promise.all([
          productsApi.getAdminById(params.id),
          categoriesApi.list(),
        ])

        if (!isMounted) return

        setProduct(productData)
        setCategories(allCategories)

        form.reset({
          name: productData.name,
          description: productData.description,
          priceHT: productData.priceHT,
          tva: productData.tva,
          stock: productData.stock,
          categoryId: productData.category.id,
          status: productData.status,
        })
      } catch (error) {
        if (!isMounted) return
        pushToast({
          type: 'error',
          title: 'Chargement impossible',
          message: error instanceof ApiError ? error.message : 'Le detail produit est indisponible.',
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
  }, [form, params.id, pushToast])

  const computedTtc = useMemo(() => {
    const priceHT = Number(form.watch('priceHT') || 0)
    const tva = Number(form.watch('tva') || 0)
    return Number((priceHT * (1 + tva / 100)).toFixed(2))
  }, [form])

  const handleImagesChange = (nextImages: ProductImage[]) => {
    setProduct((prev) => prev ? { ...prev, images: nextImages } : prev)
  }

  const handleMainImageRefChange = (nextMainImageRef: string | null) => {
    setProduct((prev) => prev ? { ...prev, mainImageRef: nextMainImageRef } : prev)
  }

  const heroImageUrl = useMemo(() => {
    if (!product) return ''
    if (product.mainImageRef) {
      const matching = product.images.find((img) => img.imageRef === product.mainImageRef)
      return matching?.url ?? resolveMediaUrl(product.mainImageRef)
    }
    return product.images[0]?.url ?? ''
  }, [product])

  const handleSave = form.handleSubmit(async (values) => {
    if (!product) return

    try {
      const updated = await productsApi.update(product.id, {
        name: values.name.trim(),
        slug: toSlug(values.name),
        description: values.description.trim(),
        priceHt: values.priceHT,
        vatRate: values.tva,
        stock: values.stock,
        categoryId: values.categoryId,
        status: values.status,
      })
      setProduct(updated)
      pushToast({ type: 'success', title: 'Produit mis a jour' })
      router.push(`/products/${product.id}`)
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Enregistrement impossible',
        message: error instanceof ApiError ? error.message : 'La mise a jour produit a echoue.',
      })
    }
  })

  if (!product && !isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Produit introuvable.</p>
        <Link href="/products" className="btn-primary inline-flex">Retour catalogue</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title={product ? product.name : 'Chargement produit'}
        description={isEditMode ? 'Edition du produit' : 'Fiche detail produit'}
        actions={
          <div className="flex items-center gap-2">
            {!isEditMode && product ? (
              <Link href={`/products/${product.id}?edit=1`} className="btn-primary inline-flex">Modifier</Link>
            ) : null}
            <Link href="/products" className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-dark transition-colors hover:bg-primary-light/40">
              Retour catalogue
            </Link>
          </div>
        }
      />

      {isLoading ? (
        <div className="app-panel p-6 text-sm text-gray-500">Chargement du produit...</div>
      ) : !product ? null : isEditMode ? (
        <form onSubmit={handleSave} className="app-panel space-y-4 p-5 md:p-6">
          <FormField label="Nom" htmlFor="product-name">
            <input id="product-name" className="input-base" {...form.register('name')} />
          </FormField>
          <FormField label="Description" htmlFor="product-description">
            <textarea id="product-description" className="input-base min-h-[120px]" {...form.register('description')} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField label="Prix HT" htmlFor="product-price-ht">
              <input id="product-price-ht" type="number" step="0.01" className="input-base" {...form.register('priceHT', { valueAsNumber: true })} />
            </FormField>
            <FormField label="TVA" htmlFor="product-tva">
              <select id="product-tva" className="input-base" {...form.register('tva', { valueAsNumber: true })}>
                <option value={20}>20%</option>
                <option value={10}>10%</option>
                <option value={5.5}>5.5%</option>
                <option value={0}>0%</option>
              </select>
            </FormField>
            <FormField label="Prix TTC calcule" htmlFor="product-price-ttc">
              <input id="product-price-ttc" type="text" className="input-base" value={formatCurrency(computedTtc)} readOnly />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField label="Stock" htmlFor="product-stock">
              <input id="product-stock" type="number" className="input-base" {...form.register('stock', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Categorie" htmlFor="product-category">
              <select id="product-category" className="input-base" {...form.register('categoryId')}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Statut" htmlFor="product-status">
              <select id="product-status" className="input-base" {...form.register('status')}>
                <option value="draft">Brouillon</option>
                <option value="published">Publie</option>
                <option value="archived">Archive</option>
              </select>
            </FormField>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Images du produit</p>
            <ProductImageManager
              productId={params.id}
              images={product.images}
              mainImageRef={product.mainImageRef}
              onImagesChange={handleImagesChange}
              onMainImageRefChange={handleMainImageRefChange}
              onError={(msg) => pushToast({ type: 'error', title: 'Erreur image', message: msg })}
            />
          </div>

          <FormActions>
            <Link href={`/products/${product.id}`} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100">Annuler</Link>
            <button type="submit" className="btn-primary">Enregistrer</button>
          </FormActions>
        </form>
      ) : (
        <div className="app-panel space-y-4 p-5 md:p-6">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
            {heroImageUrl ? (
              <Image src={heroImageUrl} alt={product.name} width={1200} height={420} className="h-64 w-full object-cover" unoptimized />
            ) : (
              <div className="flex h-64 items-center justify-center text-gray-400">Aucune image</div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <p><span className="font-medium text-dark">Categorie:</span> {product.category.name}</p>
            <p><span className="font-medium text-dark">Statut:</span> <Badge variant={product.status === 'published' ? 'success' : 'default'}>{product.status === 'published' ? 'Publie' : 'Brouillon'}</Badge></p>
            <p><span className="font-medium text-dark">Prix HT:</span> {formatCurrency(product.priceHT)}</p>
            <p><span className="font-medium text-dark">TVA:</span> {product.tva}%</p>
            <p><span className="font-medium text-dark">Prix TTC:</span> {formatCurrency(product.price)}</p>
            <p><span className="font-medium text-dark">Stock:</span> {product.stock}</p>
            <p><span className="font-medium text-dark">Date creation:</span> {formatDate(product.createdAt)}</p>
            <p><span className="font-medium text-dark">Derniere mise a jour:</span> {formatDate(product.updatedAt)}</p>
          </div>
          <div>
            <p className="font-medium text-dark">Description</p>
            <p className="mt-1 text-gray-700">{product.description}</p>
          </div>
        </div>
      )}
    </div>
  )
}
