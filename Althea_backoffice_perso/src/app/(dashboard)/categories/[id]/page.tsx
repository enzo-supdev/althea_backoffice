'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import PageHeader from '@/components/layout/PageHeader'
import Badge from '@/components/ui/Badge'
import DataTable, { Column } from '@/components/ui/DataTable'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, categoriesApi, productsApi } from '@/lib/api'
import type { Category as ApiCategory } from '@/lib/api/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Category, Product } from '@/types'

export default function CategoryDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { pushToast } = useToast()

  const [category, setCategory] = useState<ApiCategory | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadDetails = async () => {
      setIsLoading(true)

      try {
        const [categoryResult, productsResult] = await Promise.all([
          categoriesApi.getById(params.id),
          productsApi.listBackoffice(),
        ])

        if (!isMounted) return

        setCategory(categoryResult)
        setProducts(productsResult.filter((product) => product.category.id === params.id))
      } catch (error) {
        if (!isMounted) return
        pushToast({
          type: 'error',
          title: 'Chargement impossible',
          message: error instanceof ApiError ? error.message : 'Le detail categorie est indisponible.',
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadDetails()

    return () => {
      isMounted = false
    }
  }, [params.id, pushToast])

  const columns = useMemo<Column<Product>[]>(
    () => [
      {
        key: 'image',
        label: 'Image',
        render: (product) => (
          <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-gray-100">
            {product.images[0] ? (
              <Image src={product.images[0]} alt={product.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">IMG</div>
            )}
          </div>
        ),
      },
      { key: 'name', label: 'Produit', render: (product) => <span className="font-medium text-gray-900">{product.name}</span> },
      { key: 'price', label: 'Prix TTC', render: (product) => formatCurrency(product.price) },
      { key: 'stock', label: 'Stock', render: (product) => product.stock },
      {
        key: 'status',
        label: 'Statut',
        render: (product) => (
          <Badge variant={product.status === 'published' ? 'success' : 'default'}>
            {product.status === 'published' ? 'Publie' : 'Brouillon'}
          </Badge>
        ),
      },
      { key: 'createdAt', label: 'Cree le', render: (product) => formatDate(product.createdAt) },
    ],
    []
  )

  if (!category && !isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Categorie introuvable.</p>
        <button type="button" className="btn-primary" onClick={() => router.push('/categories')}>
          Retour categories
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title={category ? `Categorie: ${category.name}` : 'Chargement categorie'}
        description={category?.description || 'Detail de la categorie et produits associes.'}
        actions={
          <Link href="/categories" className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-dark transition-colors hover:bg-primary-light/40">
            Retour categories
          </Link>
        }
      />

      {category && (
        <div className="app-panel grid grid-cols-1 gap-4 p-5 md:grid-cols-2 md:p-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Slug</p>
            <p className="text-sm text-dark">{category.slug}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Statut</p>
            <Badge variant={category.status === 'active' ? 'success' : 'default'}>
              {category.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Nombre de produits</p>
            <p className="text-sm text-dark">{products.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Date creation</p>
            <p className="text-sm text-dark">{formatDate(new Date(category.createdAt))}</p>
          </div>
        </div>
      )}

      <div className="card p-0">
        <DataTable
          columns={columns}
          data={products}
          isLoading={isLoading}
          emptyMessage="Aucun produit associe a cette categorie"
        />
      </div>
    </div>
  )
}
