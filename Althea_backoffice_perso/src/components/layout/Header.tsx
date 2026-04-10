'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Search, LogOut, Menu } from 'lucide-react'
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
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return

      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)
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
      invoicesApi.list(),
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
          <button
            type="button"
            className="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-primary-light/70 hover:text-gray-900"
            aria-label="Voir les notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-status-warning" />
          </button>

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
