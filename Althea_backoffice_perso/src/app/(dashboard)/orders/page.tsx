'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, Eye } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import SearchBar from '@/components/ui/SearchBar'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { Order } from '@/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { ApiError, ordersApi } from '@/lib/api'
import PageHeader from '@/components/layout/PageHeader'

export default function OrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all')
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([])
  const { pushToast } = useToast()

  useEffect(() => {
    const initialQuery = searchParams.get('search') ?? searchParams.get('query')
    if (initialQuery) {
      setSearchQuery(initialQuery)
      setCurrentPage(1)
    }
  }, [searchParams])

  useEffect(() => {
    let isMounted = true

    const loadOrders = async () => {
      setLoadError('')
      setIsLoading(true)

      try {
        const loadedOrders = await ordersApi.list()
        if (!isMounted) return
        setOrders(loadedOrders)
      } catch (error) {
        if (!isMounted) return
        setLoadError('Le service commandes est indisponible.')
        pushToast({
          type: 'error',
          title: 'Chargement commandes impossible',
          message: error instanceof ApiError ? error.message : 'Les donnees locales ont ete ignorees.',
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      isMounted = false
    }
  }, [pushToast])

  const persistOrders = async (nextOrders: Order[]) => {
    setOrders(nextOrders)

    try {
      await ordersApi.save(nextOrders)
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Sauvegarde impossible',
        message: error instanceof ApiError ? error.message : 'La synchronisation locale a echoue.',
      })
    }
  }

  const retryLoadOrders = () => {
    setIsLoading(true)
    setLoadError('')

    void ordersApi.list()
      .then((loadedOrders) => {
        setOrders(loadedOrders)
      })
      .catch((error) => {
        setLoadError('Le service commandes est indisponible.')
        pushToast({
          type: 'error',
          title: 'Rechargement impossible',
          message: error instanceof ApiError ? error.message : 'La tentative de rechargement a echoue.',
        })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const selectedOrdersSet = useMemo(() => new Set(selectedOrders), [selectedOrders])

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

  const filteredOrders = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    const filtered = orders.filter((order) => {
      const matchesQuery =
        !query ||
        order.orderNumber.toLowerCase().includes(query) ||
        order.customer.fullName.toLowerCase().includes(query) ||
        order.customer.email.toLowerCase().includes(query)

      const matchesStatus = filterStatus === 'all' || order.status === filterStatus
      const matchesPaymentStatus =
        filterPaymentStatus === 'all' || order.paymentStatus === filterPaymentStatus

      return matchesQuery && matchesStatus && matchesPaymentStatus
    })

    filtered.sort((a, b) => {
      let aValue: string | number = ''
      let bValue: string | number = ''

      if (sortKey === 'customer') {
        aValue = a.customer.fullName
        bValue = b.customer.fullName
      } else if (sortKey === 'createdAt') {
        aValue = a.createdAt.getTime()
        bValue = b.createdAt.getTime()
      } else {
        aValue = (a as any)[sortKey] ?? ''
        bValue = (b as any)[sortKey] ?? ''
      }

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
  }, [orders, searchQuery, filterStatus, filterPaymentStatus, sortKey, sortDirection])

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredOrders.slice(start, start + pageSize)
  }, [filteredOrders, currentPage, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))

  const allVisibleSelected =
    paginatedOrders.length > 0 && paginatedOrders.every((order) => selectedOrdersSet.has(order.id))

  const someVisibleSelected =
    paginatedOrders.some((order) => selectedOrdersSet.has(order.id)) && !allVisibleSelected

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    )
  }

  const toggleVisibleSelection = () => {
    const visibleIds = paginatedOrders.map((order) => order.id)

    if (allVisibleSelected) {
      setSelectedOrders((prev) => prev.filter((id) => !visibleIds.includes(id)))
      return
    }

    setSelectedOrders((prev) => Array.from(new Set([...prev, ...visibleIds])))
  }

  const handleBulkStatusUpdate = async (nextStatus: Order['status']) => {
    if (selectedOrders.length === 0) return

    const nextOrders: Order[] = orders.map((order) =>
      selectedOrdersSet.has(order.id)
        ? { ...order, status: nextStatus }
        : order
    )

    await persistOrders(nextOrders)

    pushToast({
      type: 'success',
      title: 'Commandes mises a jour',
      message: `${selectedOrders.length} commande${selectedOrders.length > 1 ? 's' : ''} modifiee${selectedOrders.length > 1 ? 's' : ''}.`,
    })
  }

  const handleBulkPaymentUpdate = async (nextStatus: Order['paymentStatus']) => {
    if (selectedOrders.length === 0) return

    const nextOrders: Order[] = orders.map((order) =>
      selectedOrdersSet.has(order.id)
        ? { ...order, paymentStatus: nextStatus }
        : order
    )

    await persistOrders(nextOrders)

    pushToast({
      type: 'success',
      title: 'Paiements mis a jour',
      message: `Statut paiement -> ${nextStatus}.`,
    })
  }

  const openDeleteConfirm = (ids: string[]) => {
    if (ids.length === 0) return
    setDeleteTargetIds(ids)
    setIsDeleteConfirmOpen(true)
  }

  const handleConfirmedDelete = async () => {
    const targetIds = new Set(deleteTargetIds)
    const nextOrders: Order[] = orders.filter((order) => !targetIds.has(order.id))
    await persistOrders(nextOrders)
    setSelectedOrders((prev) => prev.filter((id) => !targetIds.has(id)))
    setIsDeleteConfirmOpen(false)
    setDeleteTargetIds([])

    pushToast({
      type: 'success',
      title: 'Commandes supprimees',
      message: 'La suppression a ete effectuee.',
    })
  }

  const columns: Column<Order>[] = [
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
          aria-label="Selectionner toutes les commandes visibles"
        />
      ),
      render: (order) => (
        <input
          type="checkbox"
          checked={selectedOrdersSet.has(order.id)}
          onChange={() => toggleOrderSelection(order.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          aria-label={`Selectionner la commande ${order.orderNumber}`}
        />
      ),
    },
    {
      key: 'orderNumber',
      label: 'N° commande',
      sortable: true,
      render: (order) => (
        <span className="font-medium text-gray-900">{order.orderNumber}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date et heure',
      sortable: true,
      render: (order) => (
        <span className="text-gray-600">{formatDateTime(order.createdAt)}</span>
      ),
    },
    {
      key: 'customer',
      label: 'Client',
      sortable: true,
      render: (order) => (
        <div>
          <div className="font-medium text-gray-900">{order.customer.fullName}</div>
          <div className="text-sm text-gray-500">{order.customer.email}</div>
        </div>
      ),
    },
    {
      key: 'totalAmount',
      label: 'Montant TTC',
      sortable: true,
      render: (order) => (
        <span className="font-medium text-gray-900">
          {formatCurrency(order.totalAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      render: (order) => {
        const { variant, label } = getStatusBadge(order.status)
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      key: 'paymentMethod',
      label: 'Mode paiement',
      sortable: true,
      render: (order) => <span className="text-gray-700">{order.paymentMethod}</span>,
    },
    {
      key: 'paymentStatus',
      label: 'Paiement',
      sortable: true,
      render: (order) => {
        const { variant, label } = getPaymentStatusBadge(order.paymentStatus)
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (order) => (
        <Link
          href={`/orders/${order.id}`}
          className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
          aria-label="Voir le detail de la commande"
        >
          <Eye className="h-4 w-4" />
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Opérations"
        title="Gestion des commandes"
        description={`${filteredOrders.length} commande${filteredOrders.length > 1 ? 's' : ''} à suivre.`}
        actions={(
          <Link href="/orders/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nouvelle commande
          </Link>
        )}
      />

      <div className="app-panel space-y-4 p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SearchBar
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value)
              setCurrentPage(1)
            }}
            placeholder="Rechercher commande, client, email..."
            ariaLabel="Rechercher une commande"
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setCurrentPage(1)
            }}
            className="input-base bg-shell-surface"
            aria-label="Filtrer par statut de commande"
          >
            <option value="all">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="processing">En cours</option>
            <option value="completed">Terminee</option>
            <option value="cancelled">Annulee</option>
          </select>
          <select
            value={filterPaymentStatus}
            onChange={(e) => {
              setFilterPaymentStatus(e.target.value)
              setCurrentPage(1)
            }}
            className="input-base bg-shell-surface"
            aria-label="Filtrer par statut de paiement"
          >
            <option value="all">Tous les paiements</option>
            <option value="validated">Valide</option>
            <option value="pending">En attente</option>
            <option value="failed">Echoue</option>
            <option value="refunded">Rembourse</option>
          </select>
        </div>
      </div>

      {selectedOrders.length > 0 && (
        <div className="app-panel flex flex-wrap items-center justify-between gap-3 border-primary/10 bg-primary-light/50 p-4">
          <span className="text-sm font-medium text-dark">
            {selectedOrders.length} commande{selectedOrders.length > 1 ? 's' : ''} selectionnee{selectedOrders.length > 1 ? 's' : ''}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkStatusUpdate('processing')}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800"
            >
              Mettre en cours
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatusUpdate('completed')}
              className="rounded-lg bg-status-success px-4 py-2 text-sm text-white transition-colors hover:bg-status-success/90"
            >
              Marquer terminee
            </button>
            <button
              type="button"
              onClick={() => handleBulkPaymentUpdate('validated')}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary-hover"
            >
              Paiement valide
            </button>
            <button
              type="button"
              onClick={() => handleBulkPaymentUpdate('refunded')}
              className="rounded-lg bg-status-warning px-4 py-2 text-sm text-white transition-colors hover:bg-status-warning/90"
            >
              Rembourser
            </button>
            <button
              type="button"
              onClick={() => openDeleteConfirm(selectedOrders)}
              className="rounded-lg bg-status-error px-4 py-2 text-sm text-white transition-colors hover:bg-status-error/90"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}

      {loadError ? (
        <div className="card space-y-4 text-center" role="alert" aria-live="assertive" aria-atomic="true">
          <div>
            <h3 className="text-lg font-heading font-semibold text-dark">Chargement impossible</h3>
            <p className="mt-1 text-sm text-gray-600">{loadError}</p>
          </div>
          <div className="flex justify-center">
            <button type="button" onClick={retryLoadOrders} className="btn-primary">
              Reessayer
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-0">
          <DataTable
            columns={columns}
            data={paginatedOrders}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            emptyMessage="Aucune commande trouvee"
            isLoading={isLoading}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredOrders.length}
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
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Confirmer la suppression"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Vous allez supprimer {deleteTargetIds.length} commande{deleteTargetIds.length > 1 ? 's' : ''}. Cette action est irreversible.
          </p>
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
              Confirmer la suppression
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
