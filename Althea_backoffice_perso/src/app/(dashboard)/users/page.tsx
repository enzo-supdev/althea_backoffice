'use client'

import { useEffect, useMemo, useState } from 'react'
import { Mail, Key, UserX, Trash2 } from 'lucide-react'
import DataTable, { Column } from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import SearchBar from '@/components/ui/SearchBar'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { User } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ApiError, usersApi } from '@/lib/api'
import PageHeader from '@/components/layout/PageHeader'

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([])
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [resetTargetId, setResetTargetId] = useState<string | null>(null)
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false)
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null)
  const [viewUserId, setViewUserId] = useState<string | null>(null)
  const { pushToast } = useToast()

  useEffect(() => {
    let isMounted = true

    const loadUsers = async () => {
      setLoadError('')
      setIsLoading(true)

      try {
        const loadedUsers = await usersApi.list()
        if (!isMounted) return
        setUsers(loadedUsers)
      } catch (error) {
        if (!isMounted) return
        setLoadError('Le service utilisateurs est indisponible.')
        pushToast({
          type: 'error',
          title: 'Chargement utilisateurs impossible',
          message: error instanceof ApiError ? error.message : 'Les donnees locales ont ete ignorees.',
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      isMounted = false
    }
  }, [pushToast])

  const persistUsers = async (nextUsers: User[]) => {
    setUsers(nextUsers)

    try {
      await usersApi.save(nextUsers)
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Sauvegarde impossible',
        message: error instanceof ApiError ? error.message : 'La synchronisation locale a echoue.',
      })
    }
  }

  const retryLoadUsers = () => {
    setIsLoading(true)
    setLoadError('')

    void usersApi.list()
      .then((loadedUsers) => {
        setUsers(loadedUsers)
      })
      .catch((error) => {
        setLoadError('Le service utilisateurs est indisponible.')
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

  const selectedUsersSet = useMemo(() => new Set(selectedUsers), [selectedUsers])
  const viewUser = useMemo(
    () => users.find((user) => user.id === viewUserId) ?? null,
    [users, viewUserId],
  )

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    const filtered = users.filter((user) => {
      const matchesSearch =
        !query ||
        user.fullName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'archived' ? user.archived : user.status === filterStatus && !user.archived)

      return matchesSearch && matchesStatus
    })

    filtered.sort((a, b) => {
      let aValue: string | number = (a as any)[sortKey] ?? ''
      let bValue: string | number = (b as any)[sortKey] ?? ''

      if (sortKey === 'createdAt' || sortKey === 'lastLogin') {
        aValue = (a as any)[sortKey].getTime()
        bValue = (b as any)[sortKey].getTime()
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
  }, [users, searchQuery, filterStatus, sortKey, sortDirection])

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))

  const allVisibleSelected =
    paginatedUsers.length > 0 && paginatedUsers.every((user) => selectedUsersSet.has(user.id))

  const someVisibleSelected =
    paginatedUsers.some((user) => selectedUsersSet.has(user.id)) && !allVisibleSelected

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const toggleVisibleSelection = () => {
    const visibleIds = paginatedUsers.map((user) => user.id)

    if (allVisibleSelected) {
      setSelectedUsers((prev) => prev.filter((id) => !visibleIds.includes(id)))
      return
    }

    setSelectedUsers((prev) => Array.from(new Set([...prev, ...visibleIds])))
  }

  const handleBulkStatusUpdate = async (nextStatus: User['status']) => {
    if (selectedUsers.length === 0) return

    const nextUsers: User[] = users.map((user) =>
      selectedUsersSet.has(user.id)
        ? { ...user, status: nextStatus, archived: false, archivedAt: null }
        : user
    )

    await persistUsers(nextUsers)

    pushToast({
      type: 'success',
      title: 'Utilisateurs mis a jour',
      message: `${selectedUsers.length} compte${selectedUsers.length > 1 ? 's' : ''} modifie${selectedUsers.length > 1 ? 's' : ''}.`,
    })
  }

  const openDeleteConfirm = (ids: string[]) => {
    if (ids.length === 0) return
    setDeleteTargetIds(ids)
    setIsDeleteConfirmOpen(true)
  }

  const handleConfirmedDelete = async () => {
    const targetIds = new Set(deleteTargetIds)
    const nextUsers: User[] = users.filter((user) => !targetIds.has(user.id))
    await persistUsers(nextUsers)
    setSelectedUsers((prev) => prev.filter((id) => !targetIds.has(id)))
    setIsDeleteConfirmOpen(false)
    setDeleteTargetIds([])

    pushToast({
      type: 'success',
      title: 'Comptes supprimes',
      message: 'La suppression a ete effectuee.',
    })
  }

  const handleSingleStatusUpdate = async (userId: string, nextStatus: User['status']) => {
    const nextUsers: User[] = users.map((user) =>
      user.id === userId
        ? { ...user, status: nextStatus, archived: false, archivedAt: null }
        : user
    )

    await persistUsers(nextUsers)

    pushToast({
      type: 'info',
      title: 'Compte mis a jour',
      message: `Le statut est maintenant ${nextStatus}.`,
    })
  }

  const openResetPasswordConfirm = (userId: string) => {
    setResetTargetId(userId)
    setIsResetConfirmOpen(true)
  }

  const openArchiveConfirm = (userId: string) => {
    setArchiveTargetId(userId)
    setIsArchiveConfirmOpen(true)
  }

  const handleResetPasswordConfirmed = async () => {
    if (!resetTargetId) return

    const nextUsers: User[] = users.map((user) =>
      user.id === resetTargetId
        ? { ...user, status: 'pending', archived: false, archivedAt: null }
        : user
    )

    await persistUsers(nextUsers)
    setIsResetConfirmOpen(false)
    setResetTargetId(null)

    pushToast({
      type: 'success',
      title: 'Mot de passe reinitialise',
      message: 'Un email de reinitialisation simule a ete prepare.',
    })
  }

  const handleArchiveConfirmed = async () => {
    if (!archiveTargetId) return

    const nextUsers: User[] = users.map((user) =>
      user.id === archiveTargetId
        ? { ...user, archived: true, archivedAt: new Date() }
        : user
    )

    await persistUsers(nextUsers)
    setIsArchiveConfirmOpen(false)
    setArchiveTargetId(null)

    pushToast({
      type: 'success',
      title: 'Compte archive',
      message: 'Le compte est masque dans la vue active.',
    })
  }

  const handleReactivateUser = async (userId: string) => {
    const nextUsers: User[] = users.map((user) =>
      user.id === userId
        ? { ...user, status: 'active', archived: false, archivedAt: null }
        : user
    )

    await persistUsers(nextUsers)

    pushToast({
      type: 'success',
      title: 'Compte reactive',
      message: 'Le compte est repasse actif.',
    })
  }

  const columns: Column<User>[] = [
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
          aria-label="Selectionner tous les utilisateurs visibles"
        />
      ),
      render: (user) => (
        <input
          type="checkbox"
          checked={selectedUsersSet.has(user.id)}
          onChange={() => toggleUserSelection(user.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          aria-label={`Selectionner ${user.fullName}`}
        />
      ),
    },
    {
      key: 'fullName',
      label: 'Nom complet',
      sortable: true,
      render: (user) => (
        <div>
          <div className="font-medium text-gray-900">{user.fullName}</div>
          <div className="text-sm text-gray-500">{user.email}</div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: "Date d'inscription",
      sortable: true,
      render: (user) => formatDate(user.createdAt),
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      render: (user) => (
        <Badge
          variant={
            user.archived
              ? 'default'
              : user.status === 'active'
              ? 'success'
              : user.status === 'pending'
                ? 'warning'
                : 'error'
          }
        >
          {user.archived && 'Archive'}
          {user.status === 'active' && 'Actif'}
          {user.status === 'pending' && 'En attente'}
          {user.status === 'inactive' && 'Inactif'}
        </Badge>
      ),
    },
    {
      key: 'ordersCount',
      label: 'Commandes',
      sortable: true,
    },
    {
      key: 'totalRevenue',
      label: 'CA genere',
      sortable: true,
      render: (user) => (
        <span className="font-medium text-gray-900">
          {formatCurrency(user.totalRevenue)}
        </span>
      ),
    },
    {
      key: 'lastLogin',
      label: 'Derniere connexion',
      sortable: true,
      render: (user) => (
        <span className="text-gray-600">{formatDate(user.lastLogin)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Envoyer un email"
            onClick={() => {
              window.location.href = `mailto:${user.email}`
            }}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Voir le detail"
            onClick={() => setViewUserId(user.id)}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
          >
            <span className="text-xs font-semibold">Voir</span>
          </button>
          <button
            type="button"
            title="Reinitialiser mot de passe"
            onClick={() => openResetPasswordConfirm(user.id)}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
          >
            <Key className="h-4 w-4" />
          </button>
          {user.status !== 'active' && !user.archived && (
            <button
              type="button"
              title="Reactivater compte"
              onClick={() => handleReactivateUser(user.id)}
              className="rounded p-1 text-gray-600 transition-colors hover:text-status-success"
            >
              <Mail className="h-4 w-4" />
            </button>
          )}
          {!user.archived && (
            <button
              type="button"
              title="Archiver compte"
              onClick={() => openArchiveConfirm(user.id)}
              className="rounded p-1 text-gray-600 transition-colors hover:text-status-warning"
            >
              <UserX className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            title="Supprimer compte"
            onClick={() => openDeleteConfirm([user.id])}
            className="rounded p-1 text-gray-600 transition-colors hover:text-status-error"
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
        eyebrow="Accès"
        title="Gestion des utilisateurs"
        description={`${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? 's' : ''} dans l’espace backoffice.`}
      />

      <div className="app-panel space-y-4 p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SearchBar
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value)
              setCurrentPage(1)
            }}
            placeholder="Rechercher nom, email..."
            ariaLabel="Rechercher un utilisateur"
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
            <option value="active">Actif</option>
            <option value="pending">En attente</option>
            <option value="inactive">Inactif</option>
            <option value="archived">Archives</option>
          </select>
        </div>
      </div>

      {selectedUsers.length > 0 && (
        <div className="app-panel flex flex-wrap items-center justify-between gap-3 border-primary/10 bg-primary-light/50 p-4">
          <span className="text-sm font-medium text-dark">
            {selectedUsers.length} utilisateur{selectedUsers.length > 1 ? 's' : ''} selectionne{selectedUsers.length > 1 ? 's' : ''}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkStatusUpdate('inactive')}
              className="rounded-lg bg-status-warning px-4 py-2 text-sm text-white transition-colors hover:bg-status-warning/90"
            >
              Desactiver
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatusUpdate('pending')}
              className="rounded-lg bg-gray-700 px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800"
            >
              Mettre en attente
            </button>
            <button
              type="button"
              onClick={() => setSelectedUsers((prev) => prev)}
              className="rounded-lg bg-status-success px-4 py-2 text-sm text-white transition-colors hover:bg-status-success/90"
              disabled
              title="Archivage global a venir"
            >
              Archiver
            </button>
            <button
              type="button"
              onClick={() => openDeleteConfirm(selectedUsers)}
              className="inline-flex items-center gap-2 rounded-lg bg-status-error px-4 py-2 text-sm text-white transition-colors hover:bg-status-error/90"
            >
              <Trash2 className="h-4 w-4" />
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
            <button type="button" onClick={retryLoadUsers} className="btn-primary">
              Reessayer
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-0">
          <DataTable
            columns={columns}
            data={paginatedUsers}
            onSort={handleSort}
            sortKey={sortKey}
            sortDirection={sortDirection}
            emptyMessage="Aucun utilisateur trouve"
            isLoading={isLoading}
          />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredUsers.length}
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
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              Vous allez supprimer {deleteTargetIds.length} utilisateur{deleteTargetIds.length > 1 ? 's' : ''}. Cette action est irreversible.
            </p>
            <p className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-2 text-xs text-status-warning">
              Avertissement RGPD: cette suppression doit etre justifiee et tracer la base legale de retention/suppression des donnees personnelles.
            </p>
          </div>
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

      <Modal
        isOpen={!!viewUser}
        onClose={() => setViewUserId(null)}
        title="Detail utilisateur"
        size="lg"
      >
        {viewUser && (
          <div className="space-y-4 text-sm text-gray-700">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Client</p>
                <p className="font-medium text-dark">{viewUser.fullName}</p>
                <p>{viewUser.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Chiffres</p>
                <p>Commandes: <span className="font-medium text-dark">{viewUser.ordersCount}</span></p>
                <p>CA total: <span className="font-medium text-dark">{formatCurrency(viewUser.totalRevenue)}</span></p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">Adresses de facturation / livraison</p>
              {viewUser.addresses.length === 0 ? (
                <p className="text-gray-500">Aucune adresse enregistree.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {viewUser.addresses.map((address) => (
                    <div key={address.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="font-medium text-dark">{address.firstName} {address.lastName}</p>
                      <p>{address.address1}</p>
                      {address.address2 ? <p>{address.address2}</p> : null}
                      <p>{address.postalCode} {address.city}</p>
                      <p>{address.region}, {address.country}</p>
                      <p>{address.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => {
          setIsResetConfirmOpen(false)
          setResetTargetId(null)
        }}
        title="Confirmer la reinitialisation"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Une reinitialisation de mot de passe sera simulee pour ce compte et son statut passera en attente.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsResetConfirmOpen(false)
                setResetTargetId(null)
              }}
              className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleResetPasswordConfirmed}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary-hover"
            >
              Confirmer
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isArchiveConfirmOpen}
        onClose={() => {
          setIsArchiveConfirmOpen(false)
          setArchiveTargetId(null)
        }}
        title="Confirmer l'archivage"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Ce compte sera archive localement et masque de la vue active.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsArchiveConfirmOpen(false)
                setArchiveTargetId(null)
              }}
              className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleArchiveConfirmed}
              className="rounded-lg bg-status-warning px-4 py-2 text-sm text-white transition-colors hover:bg-status-warning/90"
            >
              Archiver
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
