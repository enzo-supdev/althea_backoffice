'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, ordersApi } from '@/lib/api'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Order } from '@/types'

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

const getPaymentStatusBadge = (status: string) => {
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

const getOrderTimeline = (order: Order) => {
  const timeline = [
    {
      label: 'Commande creee',
      date: order.createdAt,
      active: true,
    },
    {
      label: 'Paiement valide',
      date: order.createdAt,
      active: order.paymentStatus === 'validated' || order.paymentStatus === 'refunded',
    },
    {
      label: 'Preparation',
      date: order.createdAt,
      active: order.status === 'processing' || order.status === 'completed',
    },
    {
      label: 'Livraison finalisee',
      date: order.createdAt,
      active: order.status === 'completed',
    },
  ]

  if (order.status === 'cancelled') {
    timeline.push({
      label: 'Commande annulee',
      date: order.createdAt,
      active: true,
    })
  }

  return timeline
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const orderId = params?.id
  const { pushToast } = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!orderId) {
      setIsLoading(false)
      setErrorMessage('Identifiant de commande invalide.')
      return
    }

    let isMounted = true

    const loadOrder = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const loadedOrder = await ordersApi.getById(orderId)
        if (!isMounted) return
        setOrder(loadedOrder)
      } catch (error) {
        if (!isMounted) return

        const listFallback = await ordersApi.list().catch(() => [])
        const fallbackOrder = listFallback.find((item) => item.id === orderId) ?? null

        if (fallbackOrder) {
          setOrder(fallbackOrder)
          return
        }

        setErrorMessage('Impossible de charger cette commande.')
        pushToast({
          type: 'error',
          title: 'Commande introuvable',
          message: error instanceof ApiError ? error.message : 'Le detail de la commande est indisponible.',
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadOrder()

    return () => {
      isMounted = false
    }
  }, [orderId, pushToast])

  const quickActionsDisabled = useMemo(
    () => isUpdating || !order,
    [isUpdating, order],
  )

  const handleStatusUpdate = async (status: Order['status']) => {
    if (!order) return

    setIsUpdating(true)
    try {
      const updated = await ordersApi.updateStatus(order.id, { status })
      setOrder(updated)
      pushToast({
        type: 'success',
        title: 'Statut commande mis a jour',
        message: `La commande est maintenant ${getStatusBadge(status).label.toLowerCase()}.`,
      })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Mise a jour impossible',
        message: error instanceof ApiError ? error.message : 'Le statut de commande n a pas pu etre mis a jour.',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRefund = async () => {
    if (!order) return

    setIsUpdating(true)
    try {
      await ordersApi.processRefund(order.id)
      setOrder({ ...order, paymentStatus: 'refunded' })
      pushToast({
        type: 'success',
        title: 'Remboursement traite',
        message: 'Le statut de paiement passe a rembourse.',
      })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Remboursement impossible',
        message: error instanceof ApiError ? error.message : 'Le remboursement a echoue.',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Operations" title="Detail commande" description="Chargement en cours..." />
        <div className="card">Chargement...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Operations" title="Detail commande" description="Commande introuvable." />
        <div className="card space-y-3">
          <p className="text-sm text-gray-600">{errorMessage || 'Cette commande n existe pas ou n est plus accessible.'}</p>
          <Link href="/orders" className="btn-primary inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour aux commandes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title={`Commande ${order.orderNumber}`}
        description={`${order.customer.fullName} - ${order.customer.email}`}
        actions={(
          <Link href="/orders" className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-dark transition-colors hover:bg-primary-light/40">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 md:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Commande</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-dark">{order.orderNumber}</h3>
            <Badge variant={getStatusBadge(order.status).variant}>{getStatusBadge(order.status).label}</Badge>
            <Badge variant={getPaymentStatusBadge(order.paymentStatus).variant}>{getPaymentStatusBadge(order.paymentStatus).label}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Montant TTC</p>
              <p className="font-medium text-dark">{formatCurrency(order.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Paiement</p>
              <p className="font-medium text-dark">{order.paymentMethod}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Date</p>
              <p className="font-medium text-dark">{formatDateTime(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Articles</p>
              <p className="font-medium text-dark">{order.items.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Actions rapides</p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => handleStatusUpdate('processing')}
              disabled={quickActionsDisabled}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Passer en cours
            </button>
            <button
              type="button"
              onClick={() => handleStatusUpdate('completed')}
              disabled={quickActionsDisabled}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marquer terminee
            </button>
            <button
              type="button"
              onClick={() => handleStatusUpdate('cancelled')}
              disabled={quickActionsDisabled}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Annuler commande
            </button>
            <button
              type="button"
              onClick={handleRefund}
              disabled={quickActionsDisabled}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Rembourser
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="font-semibold text-dark">Articles commandes</h4>
          <div className="mt-4 space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 p-3">
                <div>
                  <p className="font-medium text-dark">{item.product.name}</p>
                  <p className="text-xs text-gray-500">Qte {item.quantity} x {formatCurrency(item.price)}</p>
                </div>
                <p className="font-medium text-dark">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h4 className="font-semibold text-dark">Adresses</h4>
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Livraison</p>
              <p className="mt-1 text-gray-700">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                <br />
                {order.shippingAddress.address1}
                {order.shippingAddress.address2 ? <><br />{order.shippingAddress.address2}</> : null}
                <br />
                {order.shippingAddress.postalCode} {order.shippingAddress.city}
                <br />
                {order.shippingAddress.region}, {order.shippingAddress.country}
                <br />
                {order.shippingAddress.phone}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Facturation</p>
              <p className="mt-1 text-gray-700">
                {order.billingAddress.firstName} {order.billingAddress.lastName}
                <br />
                {order.billingAddress.address1}
                {order.billingAddress.address2 ? <><br />{order.billingAddress.address2}</> : null}
                <br />
                {order.billingAddress.postalCode} {order.billingAddress.city}
                <br />
                {order.billingAddress.region}, {order.billingAddress.country}
                <br />
                {order.billingAddress.phone}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="font-semibold text-dark">Timeline statut</h4>
        <div className="mt-4 space-y-3">
          {getOrderTimeline(order).map((step, index) => (
            <div key={step.label} className="flex items-start gap-3">
              <div className={`mt-1 h-3 w-3 rounded-full ${step.active ? 'bg-primary' : 'bg-gray-300'}`} />
              <div>
                <p className={`font-medium ${step.active ? 'text-dark' : 'text-gray-500'}`}>{step.label}</p>
                <p className="text-xs text-gray-500">{formatDateTime(step.date)}{index === 0 ? ' - point de depart' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
