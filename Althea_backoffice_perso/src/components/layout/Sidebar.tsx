'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  X,
  LayoutDashboard, 
  Package, 
  FolderTree, 
  Users, 
  ShoppingCart, 
  FileText, 
  MessageSquare,
  Settings
} from 'lucide-react'
import clsx from 'clsx'

const navigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Produits', href: '/products', icon: Package },
  { name: 'Catégories', href: '/categories', icon: FolderTree },
  { name: 'Utilisateurs', href: '/users', icon: Users },
  { name: 'Commandes', href: '/orders', icon: ShoppingCart },
  { name: 'Factures', href: '/invoices', icon: FileText },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Paramètres', href: '/settings', icon: Settings },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Fermer le menu latéral"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(0,61,92,0.98)_0%,rgba(0,38,61,0.98)_100%)] text-white shadow-[0_20px_60px_rgba(0,38,61,0.25)] transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Navigation principale"
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4 md:justify-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10 backdrop-blur">
              <span className="text-sm font-semibold text-white">AS</span>
            </div>
            <div>
              <h1 className="text-lg font-heading font-semibold text-white md:text-xl">
                Althea Systems
              </h1>
              <p className="text-xs text-white/70">Backoffice</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-200 hover:bg-white/10 md:hidden"
            aria-label="Fermer la navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30',
                  isActive
                    ? 'bg-primary text-white shadow-[0_10px_24px_rgba(0,168,181,0.24)]'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User info */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-sm shadow-primary/30">
              <span className="text-sm font-semibold">AD</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Admin</p>
              <p className="truncate text-xs text-white/60">admin@althea.com</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
