'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bell, CheckCheck, LogOut, Menu, MessageSquare, Search, ShoppingCart } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthContext } from '@/contexts/AuthContext'
import {
  categoriesApi,
  invoicesApi,
  messagesApi,
  ordersApi,
  productsApi,
  usersApi,
} from '@/lib/api'
import { startNavigationProgress } from '@/lib/navigationProgress'
import { Category, Invoice, Message, Order, Product, User } from '@/types'

interface HeaderProps {
  onOpenSidebar: () => void
}

type SearchResultType = 'Produit' | 'Utilisateur' | 'Commande' | 'Facture' | 'Message' | 'Categorie'

interface SearchResult {
  id: string
  type: SearchResultType
  label: string
  details: string
  href: string
}

type NotificationKind = 'message' | 'order' | 'stock'

interface Notification {
  id: string
  kind: NotificationKind
  title: string
  details: string
  href: string
  createdAt: Date | null
}

const NOTIFICATIONS_DISMISSED_KEY = 'althea.notifications.dismissed'
const LOW_STOCK_THRESHOLD = 10

function formatRelativeTime(date: Date | null): string {
  if (!date) {
    return ''
  }
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0 || Number.isNaN(diffMs)) {
    return ''
  }
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(date)
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/products': 'Produits',
  '/categories': 'Categories',
  '/users': 'Utilisateurs',
  '/orders': 'Commandes',
  '/invoices': 'Factures',
  '/messages': 'Messages',
  '/settings': 'Parametres',
}

export default function Header({ onOpenSidebar }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthContext()
  const currentTitle = pageTitles[pathname] || 'Backoffice'
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(NOTIFICATIONS_DISMISSED_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setDismissedIds(new Set(parsed.filter((value): value is string => typeof value === 'string')))
      }
    } catch {
      // ignore corrupted storage
    }
  }, [])

  const persistDismissed = (next: Set<string>) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(NOTIFICATIONS_DISMISSED_KEY, JSON.stringify(Array.from(next)))
    } catch {
      // ignore quota errors
    }
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
      }

      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    if (hasLoadedData || isLoading) {
      return
    }

    let isMounted = true
    setIsLoading(true)

    void Promise.all([
      productsApi.list(),
      usersApi.list(),
      ordersApi.list(),
      invoicesApi.listMyInvoices({ page: 1, limit: 20 }).then((response) => response.data),
      messagesApi.list(),
      categoriesApi.list(),
    ])
      .then(([nextProducts, nextUsers, nextOrders, nextInvoices, nextMessages, nextCategories]) => {
        if (!isMounted) return
        setProducts(nextProducts)
        setUsers(nextUsers)
        setOrders(nextOrders)
        setInvoices(nextInvoices)
        setMessages(nextMessages)
        setCategories(nextCategories)
        setHasLoadedData(true)
      })
      .catch(() => {
        if (!isMounted) return
        setHasLoadedData(true)
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [hasLoadedData, isLoading])

  const results = useMemo<SearchResult[]>(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (normalizedQuery.length < 2 || !hasLoadedData) {
      return []
    }

    const productResults = products
      .filter((product) => {
        return (
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.category.name.toLowerCase().includes(normalizedQuery)
        )
      })
      .map((product) => ({
        id: `product-${product.id}`,
        type: 'Produit' as const,
        label: product.name,
        details: product.category.name,
        href: `/products?search=${encodeURIComponent(product.name)}`,
      }))

    const userResults = users
      .filter((user) => {
        return (
          user.fullName.toLowerCase().includes(normalizedQuery) ||
          user.email.toLowerCase().includes(normalizedQuery)
        )
      })
      .map((user) => ({
        id: `user-${user.id}`,
        type: 'Utilisateur' as const,
        label: user.fullName,
        details: user.email,
        href: `/users?search=${encodeURIComponent(user.fullName)}`,
      }))

    const orderResults = orders
      .filter((order) => {
        return (
          order.orderNumber.toLowerCase().includes(normalizedQuery) ||
          order.customer.fullName.toLowerCase().includes(normalizedQuery)
        )
      })
      .map((order) => ({
        id: `order-${order.id}`,
        type: 'Commande' as const,
        label: order.orderNumber,
        details: order.customer.fullName,
        href: `/orders?search=${encodeURIComponent(order.orderNumber)}`,
      }))

    const invoiceResults = invoices
      .filter((invoice) => {
        return (
          invoice.invoiceNumber.toLowerCase().includes(normalizedQuery) ||
          invoice.customer.fullName.toLowerCase().includes(normalizedQuery)
        )
      })
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        type: 'Facture' as const,
        label: invoice.invoiceNumber,
        details: invoice.customer.fullName,
        href: `/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`,
      }))

    const messageResults = messages
      .filter((message) => {
        return (
          message.subject.toLowerCase().includes(normalizedQuery) ||
          message.email.toLowerCase().includes(normalizedQuery)
        )
      })
      .map((message) => ({
        id: `message-${message.id}`,
        type: 'Message' as const,
        label: message.subject,
        details: message.email,
        href: `/messages?search=${encodeURIComponent(message.subject)}`,
      }))

    const categoryResults = categories
      .filter((category) => {
        return (
          category.name.toLowerCase().includes(normalizedQuery) ||
          category.slug.toLowerCase().includes(normalizedQuery)
        )
      })
      .map((category) => ({
        id: `category-${category.id}`,
        type: 'Categorie' as const,
        label: category.name,
        details: category.slug,
        href: `/categories?search=${encodeURIComponent(category.name)}`,
      }))

    return [
      ...productResults,
      ...userResults,
      ...orderResults,
      ...invoiceResults,
      ...messageResults,
      ...categoryResults,
    ].slice(0, 8)
  }, [categories, hasLoadedData, invoices, messages, orders, products, query, users])

  const notifications = useMemo<Notification[]>(() => {
    if (!hasLoadedData) return []

    const toDate = (value: Date | string | null | undefined): Date | null => {
      if (!value) return null
      const parsed = value instanceof Date ? value : new Date(value)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const messageNotifications: Notification[] = messages
      .filter((message) => message.status === 'unread')
      .map((message) => ({
        id: `message-${message.id}`,
        kind: 'message' as const,
        title: `Nouveau message : ${message.subject || 'Sans sujet'}`,
        details: message.email,
        href: `/messages?search=${encodeURIComponent(message.subject || message.email)}`,
        createdAt: toDate(message.createdAt),
      }))

    const orderNotifications: Notification[] = orders
      .filter((order) => order.status === 'pending' || order.paymentStatus === 'pending')
      .map((order) => ({
        id: `order-${order.id}`,
        kind: 'order' as const,
        title: `Commande à traiter ${order.orderNumber}`,
        details: `${order.customer.fullName}${order.paymentStatus === 'pending' ? ' · paiement en attente' : ''}`,
        href: `/orders/${order.id}`,
        createdAt: toDate(order.createdAt),
      }))

    const stockNotifications: Notification[] = products
      .filter((product) => product.status !== 'archived' && product.stock < LOW_STOCK_THRESHOLD)
      .map((product) => ({
        id: `stock-${product.id}`,
        kind: 'stock' as const,
        title:
          product.stock === 0
            ? `Rupture de stock : ${product.name}`
            : `Stock faible : ${product.name}`,
        details:
          product.stock === 0
            ? 'Plus aucune unité disponible'
            : `${product.stock} unité${product.stock > 1 ? 's' : ''} restante${product.stock > 1 ? 's' : ''}`,
        href: `/products/${product.id}`,
        createdAt: toDate(product.updatedAt),
      }))

    const all = [...messageNotifications, ...orderNotifications, ...stockNotifications]
    all.sort((a, b) => {
      const aTime = a.createdAt ? a.createdAt.getTime() : 0
      const bTime = b.createdAt ? b.createdAt.getTime() : 0
      return bTime - aTime
    })

    return all.filter((notification) => !dismissedIds.has(notification.id))
  }, [dismissedIds, hasLoadedData, messages, orders, products])

  const unreadCount = notifications.length
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount)

  const handleDismissNotification = (id: string) => {
    setDismissedIds((previous) => {
      const next = new Set(previous)
      next.add(id)
      persistDismissed(next)
      return next
    })
  }

  const handleMarkAllAsRead = () => {
    setDismissedIds((previous) => {
      const next = new Set(previous)
      notifications.forEach((notification) => next.add(notification.id))
      persistDismissed(next)
      return next
    })
  }

  const handleOpenNotification = (notification: Notification) => {
    handleDismissNotification(notification.id)
    setIsNotificationsOpen(false)
    startNavigationProgress()
    router.push(notification.href)
  }

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (results.length === 0) {
      return
    }

    const target = activeIndex >= 0 && activeIndex < results.length
      ? results[activeIndex]
      : results[0]

    startNavigationProgress()
    router.push(target.href)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((previous) => (previous + 1) % results.length)
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((previous) => (previous <= 0 ? results.length - 1 : previous - 1))
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  const handleSelectResult = (result: SearchResult) => {
    startNavigationProgress()
    router.push(result.href)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  const handleLogout = () => {
    logout()
    startNavigationProgress()
    router.replace('/login')
  }

  const userDisplayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : 'Session active'
  const userDisplayEmail = user?.email || 'Profil non charge'
  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'AS'
    : 'AS'

  return (
    <header className="sticky top-0 z-30 border-b border-primary/10 bg-shell-surface/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-lg p-2 text-gray-600 hover:bg-primary-light/70 md:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden md:block">
            <p className="text-sm text-gray-500">Backoffice</p>
            <h2 className="font-heading text-lg font-semibold text-dark">{currentTitle}</h2>
          </div>

          <div ref={containerRef} className="relative w-full md:w-[28rem]">
            <form onSubmit={handleSearchSubmit}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value
                  setQuery(nextQuery)
                  setIsOpen(nextQuery.trim().length >= 2)
                  setActiveIndex(-1)
                }}
                onFocus={() => {
                  if (query.trim().length >= 2) {
                    setIsOpen(true)
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher produit, client, commande..."
                className="input-base bg-shell-surface pl-10"
                aria-label="Recherche globale"
              />
            </form>

            {isOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-xl border border-primary/15 bg-white shadow-xl">
                {isLoading && (
                  <p className="px-4 py-3 text-sm text-gray-500">Recherche en cours...</p>
                )}

                {!isLoading && results.length === 0 && query.trim().length >= 2 && (
                  <p className="px-4 py-3 text-sm text-gray-500">Aucun resultat pour cette recherche.</p>
                )}

                {!isLoading && results.length > 0 && (
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {results.map((result, index) => {
                      const isActive = index === activeIndex

                      return (
                        <li key={result.id}>
                          <button
                            type="button"
                            className={`flex w-full items-start justify-between gap-3 px-4 py-2 text-left transition ${
                              isActive ? 'bg-primary-light/70' : 'hover:bg-primary-light/40'
                            }`}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => handleSelectResult(result)}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-dark">{result.label}</span>
                              <span className="block truncate text-xs text-gray-500">{result.details}</span>
                            </span>
                            <span className="rounded-md bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">
                              {result.type}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="ml-3 flex items-center gap-2 md:ml-6 md:gap-4">
          <div ref={notificationsRef} className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((previous) => !previous)}
              className="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-primary-light/70 hover:text-gray-900"
              aria-label="Voir les notifications"
              aria-haspopup="true"
              aria-expanded={isNotificationsOpen}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-status-error px-1 text-[10px] font-semibold leading-none text-white">
                  {badgeLabel}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-80 overflow-hidden rounded-xl border border-primary/15 bg-white shadow-xl sm:w-96">
                <div className="flex items-center justify-between border-b border-primary/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-dark">Notifications</p>
                    <p className="text-xs text-gray-500">
                      {unreadCount === 0
                        ? 'Tout est à jour'
                        : `${unreadCount} à traiter`}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-light/60"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Tout marquer lu
                    </button>
                  )}
                </div>

                {!hasLoadedData && (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">Chargement...</p>
                )}

                {hasLoadedData && notifications.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">
                    Aucune notification pour le moment.
                  </p>
                )}

                {hasLoadedData && notifications.length > 0 && (
                  <ul className="max-h-96 overflow-y-auto divide-y divide-primary/5">
                    {notifications.slice(0, 15).map((notification) => {
                      const Icon =
                        notification.kind === 'message'
                          ? MessageSquare
                          : notification.kind === 'order'
                            ? ShoppingCart
                            : AlertTriangle
                      const iconColor =
                        notification.kind === 'message'
                          ? 'text-primary bg-primary-light/70'
                          : notification.kind === 'order'
                            ? 'text-status-warning bg-status-warning/15'
                            : 'text-status-error bg-status-error/15'

                      return (
                        <li key={notification.id} className="group relative">
                          <button
                            type="button"
                            onClick={() => handleOpenNotification(notification)}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-primary-light/30"
                          >
                            <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full ${iconColor}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-dark">
                                {notification.title}
                              </span>
                              <span className="block truncate text-xs text-gray-500">
                                {notification.details}
                              </span>
                              {notification.createdAt && (
                                <span className="mt-0.5 block text-[11px] text-gray-400">
                                  {formatRelativeTime(notification.createdAt)}
                                </span>
                              )}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleDismissNotification(notification.id)
                            }}
                            className="absolute right-2 top-2 hidden rounded-md px-1.5 py-0.5 text-[11px] font-medium text-gray-500 transition-colors hover:bg-primary-light/70 hover:text-gray-900 group-hover:block"
                            aria-label="Ignorer cette notification"
                          >
                            Ignorer
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="hidden items-center gap-3 rounded-xl border border-primary/10 bg-white/70 px-3 py-2 shadow-sm backdrop-blur sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-dark">{userDisplayName}</p>
              <p className="truncate text-xs text-gray-500">{userDisplayEmail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-600 transition-colors hover:bg-primary-light/70 hover:text-gray-900 md:px-4"
            aria-label="Se deconnecter"
          >
            <LogOut className="h-5 w-5" />
            <span className="hidden text-sm font-medium md:inline">Deconnexion</span>
          </button>
        </div>
      </div>
    </header>
  )
}
