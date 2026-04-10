'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Package } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { ordersApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'

type RecentOrder = {
  id: string
  orderNumber: string
  totalAmount: number
  status: string
  paymentStatus: string
  createdAt: Date
  customer: {
    fullName: string
    email: string
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return { variant: 'success' as const, label: 'Terminee' }
    case 'processing':
      return { variant: 'info' as const, label: 'En cours' }
    case 'pending':
      return { variant: 'warning' as const, label: 'En attente' }
    case 'cancelled':
      return { variant: 'error' as const, label: 'Annulee' }
    default:
      return { variant: 'default' as const, label: status }
  }
}

const getPaymentBadge = (status: string) => {
  switch (status) {
    case 'validated':
      return { variant: 'success' as const, label: 'Valide' }
    case 'pending':
      return { variant: 'warning' as const, label: 'En attente' }
    case 'failed':
      return { variant: 'error' as const, label: 'Echoue' }
    case 'refunded':
      return { variant: 'default' as const, label: 'Rembourse' }
    default:
      return { variant: 'default' as const, label: status }
  }
}

export default function RecentOrdersPanel() {
  const [orders, setOrders] = useState<RecentOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadRecentOrders = async () => {
      setIsLoading(true)

      try {
        const response = await ordersApi.listAdmin({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' })

        if (!isMounted) {
          return
        }

        setOrders(response.data as unknown as RecentOrder[])
      } catch (error) {
        if (!isMounted) {
          return
        }

        console.error('❌ Erreur RecentOrdersPanel:', error)
        setOrders([])
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadRecentOrders()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="app-panel p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="section-title">Dernières commandes</h2>
          <p className="mt-1 text-sm text-gray-600">
            Données réelles chargées depuis l’API admin commandes.
          </p>
        </div>
        <Link href="/orders" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover">
          Voir toutes
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-primary/10 bg-white p-4">
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
              <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-primary/20 bg-primary-light/20 p-6 text-sm text-gray-600">
          Aucune commande récente disponible pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const statusBadge = getStatusBadge(order.status)
            const paymentBadge = getPaymentBadge(order.paymentStatus)

            return (
              <div key={order.id} className="rounded-xl border border-primary/10 bg-white p-4 transition-shadow hover:shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <h3 className="truncate font-heading font-semibold text-dark">
                        {order.orderNumber}
                      </h3>
                      <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      <Badge variant={paymentBadge.variant}>{paymentBadge.label}</Badge>
                    </div>
                    <p className="mt-2 truncate text-sm text-gray-600">
                      {order.customer.fullName} · {order.customer.email}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 md:text-right">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">TTC</p>
                      <p className="font-heading text-lg font-semibold text-dark">
                        {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                    <Link
                      href={`/orders?search=${encodeURIComponent(order.orderNumber)}`}
                      className="rounded-lg border border-primary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-light/40"
                    >
                      Ouvrir
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
