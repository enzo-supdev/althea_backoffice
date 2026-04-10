'use client'

import Link from 'next/link'
import { Plus, Package, MessageSquare } from 'lucide-react'

const actions = [
  {
    name: 'Nouvelle commande',
    href: '/orders/new',
    icon: Plus,
    color: 'bg-primary hover:bg-primary-hover shadow-sm shadow-primary/20',
  },
  {
    name: 'Ajouter un produit',
    href: '/products/new',
    icon: Package,
    color: 'bg-status-success hover:bg-status-success/90 shadow-sm shadow-status-success/20',
  },
  {
    name: 'Voir les messages',
    href: '/messages',
    icon: MessageSquare,
    color: 'bg-dark hover:bg-dark/90 shadow-sm shadow-dark/20',
  },
]

export default function QuickActions() {
  return (
    <div className="app-panel p-5 md:p-6">
      <h2 className="section-title mb-4">
        Actions rapides
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className={`${action.color} flex items-center gap-3 rounded-xl p-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`}
          >
            <action.icon className="h-5 w-5" />
            <span className="font-medium">{action.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
