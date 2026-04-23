'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Download, FileText, RefreshCw } from 'lucide-react'
import axios from 'axios'
import PageHeader from '@/components/layout/PageHeader'
import Badge from '@/components/ui/Badge'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, invoicesApi, ordersApi } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { Order } from '@/types'

type LinkedInvoice = {
  id: string
  invoiceNumber: string
  status: 'paid' | 'pending' | 'cancelled'
  amount: number
  createdAt: Date
}

function toLinkedInvoice(raw: any): LinkedInvoice | null {
  if (!raw?.id) return null
  const createdAt = raw.createdAt instanceof Date ? raw.createdAt : new Date(raw.createdAt ?? Date.now())
  return {
    id: String(raw.id),
    invoiceNumber: raw.invoiceNumber ?? `INV-${raw.id}`,
    status: (raw.status as LinkedInvoice['status']) ?? 'pending',
    amount: Number(raw.amount ?? 0),
    createdAt,
  }
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { message?: string; error?: { message?: string }; errors?: Record<string, string[] | string> }
      | undefined
    if (body?.error?.message) return body.error.message
    if (body?.message) return body.message
    if (body?.errors) {
      const messages = Object.values(body.errors)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(Boolean)
        .join(' ')
      if (messages) return messages
    }
    if (error.response?.status) return `${fallback} (HTTP ${error.response.status})`
  }
  if (error instanceof Error) return error.message
  return fallback
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
  const [invoice, setInvoice] = useState<LinkedInvoice | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceDownloading, setInvoiceDownloading] = useState(false)

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

  const loadInvoice = useCallback(
    async (currentOrder: Order, mode: 'lookup' | 'ensure' = 'lookup') => {
      setInvoiceLoading(true)
      try {
        const found = mode === 'ensure'
          ? await invoicesApi.ensureInvoiceForOrder(currentOrder.id, currentOrder.orderNumber)
          : await invoicesApi.findInvoiceForOrder(currentOrder.id, currentOrder.orderNumber)
        setInvoice(toLinkedInvoice(found))
        return toLinkedInvoice(found)
      } catch (error) {
        console.warn('[orders/id] loadInvoice failed:', error)
        setInvoice(null)
        return null
      } finally {
        setInvoiceLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!order) return
    void loadInvoice(order, 'lookup')
  }, [order, loadInvoice])

  const handleGenerateInvoice = async () => {
    if (!order) return
    const generated = await loadInvoice(order, 'ensure')
    pushToast(
      generated
        ? {
            type: 'success',
            title: 'Facture générée',
            message: `Facture ${generated.invoiceNumber} liée à la commande.`,
          }
        : {
            type: 'error',
            title: 'Génération impossible',
            message: 'Le serveur n a pas pu générer de facture pour cette commande.',
          },
    )
  }

  const handleDownloadInvoice = async () => {
    if (!invoice) return
    setInvoiceDownloading(true)
    try {
      const blob = await invoicesApi.downloadPdf(invoice.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.invoiceNumber.toLowerCase()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Téléchargement impossible',
        message: extractErrorMessage(error, 'La facture PDF n a pas pu être récupérée.'),
      })
    } finally {
      setInvoiceDownloading(false)
    }
  }

  const handleStatusUpdate = async (status: Order['status']) => {
    if (!order) return

    console.info(
      '[handleStatusUpdate] statut actuel:',
      order.status,
      '→ cible:',
      status,
      '| paymentStatus:',
      order.paymentStatus
    )

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
      if (axios.isAxiosError(error)) {
        console.error(
          'Erreur updateStatus commande:',
          error.response?.status,
          JSON.stringify(error.response?.data, null, 2)
        )
      }
      pushToast({
        type: 'error',
        title: 'Mise a jour impossible',
        message: extractErrorMessage(error, 'Le statut de commande n a pas pu etre mis a jour.'),
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRefund = async () => {
    if (!order) return

    const amount = Number(order.totalAmount) || 0
    if (amount <= 0) {
      pushToast({
        type: 'error',
        title: 'Remboursement impossible',
        message: 'Le montant de la commande est nul.',
      })
      return
    }

    setIsUpdating(true)
    try {
      await invoicesApi.refundOrder({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount,
        reason: `Remboursement commande ${order.orderNumber}`,
        sendEmail: true,
      })
      setOrder({ ...order, paymentStatus: 'refunded' })
      pushToast({
        type: 'success',
        title: 'Avoir créé',
        message: 'Un avoir a été généré pour cette commande.',
      })
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Erreur refund commande:',
          error.response?.status,
          JSON.stringify(error.response?.data, null, 2)
        )
      }
      pushToast({
        type: 'error',
        title: 'Remboursement impossible',
        message: extractErrorMessage(error, 'Le remboursement a echoue.'),
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="flex items-center gap-2 font-semibold text-dark">
              <FileText className="h-4 w-4 text-primary" /> Facture liée
            </h4>
            <p className="mt-1 text-xs text-gray-500">
              Créée automatiquement à la création de la commande (snapshots figés).
            </p>
          </div>
          {invoice ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadInvoice}
                disabled={invoiceDownloading}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-3 py-2 text-sm font-medium text-dark transition-colors hover:bg-primary-light/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {invoiceDownloading ? 'Téléchargement...' : 'Télécharger PDF'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerateInvoice}
              disabled={invoiceLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/20 px-3 py-2 text-sm font-medium text-dark transition-colors hover:bg-primary-light/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${invoiceLoading ? 'animate-spin' : ''}`} />
              {invoiceLoading ? 'Génération...' : 'Générer la facture'}
            </button>
          )}
        </div>

        {invoice ? (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Numéro</p>
              <Link
                href={`/invoices?query=${encodeURIComponent(invoice.invoiceNumber)}`}
                className="font-medium text-primary hover:underline"
              >
                {invoice.invoiceNumber}
              </Link>
            </div>
            <div>
              <p className="text-xs text-gray-500">Montant</p>
              <p className="font-medium text-dark">{formatCurrency(invoice.amount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Statut</p>
              <Badge
                variant={
                  invoice.status === 'paid'
                    ? 'success'
                    : invoice.status === 'pending'
                      ? 'warning'
                      : 'error'
                }
              >
                {invoice.status === 'paid' && 'Payee'}
                {invoice.status === 'pending' && 'En attente'}
                {invoice.status === 'cancelled' && 'Annulee'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500">Émise le</p>
              <p className="font-medium text-dark">{formatDate(invoice.createdAt)}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-600">
            {invoiceLoading
              ? 'Chargement de la facture...'
              : 'Aucune facture n est encore liée. Utilise "Générer la facture" pour la créer (backfill).'}
          </p>
        )}
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
