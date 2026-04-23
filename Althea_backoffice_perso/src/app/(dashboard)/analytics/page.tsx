'use client'

import { useState } from 'react'
import {
  TrendingUp,
  Package,
  Users,
  ShoppingBag,
  Globe,
  Warehouse,
  RotateCcw,
} from 'lucide-react'
import clsx from 'clsx'
import PageHeader from '@/components/layout/PageHeader'
import AnalyticsFilters, {
  computeDateRange,
  type DateRange,
  type ReportType,
} from '@/components/analytics/AnalyticsFilters'
import SalesPanel from '@/components/analytics/SalesPanel'
import ProductsPanel from '@/components/analytics/ProductsPanel'
import CustomersPanel from '@/components/analytics/CustomersPanel'
import OrdersStatsPanel from '@/components/analytics/OrdersStatsPanel'
import GeographicPanel from '@/components/analytics/GeographicPanel'
import InventoryPanel from '@/components/analytics/InventoryPanel'
import RefundsPanel from '@/components/analytics/RefundsPanel'

type AnalyticsTab = Exclude<ReportType, 'overview' | 'revenue' | 'contact'>

const tabs: Array<{ id: AnalyticsTab; label: string; icon: typeof TrendingUp }> = [
  { id: 'sales', label: 'Ventes', icon: TrendingUp },
  { id: 'products', label: 'Produits', icon: Package },
  { id: 'customers', label: 'Clients', icon: Users },
  { id: 'orders', label: 'Commandes', icon: ShoppingBag },
  { id: 'categories', label: 'Catégories', icon: Package },
  { id: 'inventory', label: 'Inventaire', icon: Warehouse },
  { id: 'geographic', label: 'Géographie', icon: Globe },
  { id: 'refunds', label: 'Remboursements', icon: RotateCcw },
]

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('sales')
  const [range, setRange] = useState<DateRange>(() => computeDateRange(30))
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Analyses & reporting"
        description="Analyses détaillées : ventes, produits, clients, commandes, inventaire, géographie et remboursements."
      />

      <AnalyticsFilters
        range={range}
        onRangeChange={setRange}
        reportType={activeTab === 'categories' ? 'categories' : activeTab}
      />

      <div className="app-panel p-1">
        <nav className="flex flex-wrap gap-1" aria-label="Sections analytics">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-600 hover:bg-primary-light/60 hover:text-dark'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <section>
        {activeTab === 'sales' && (
          <SalesPanel range={range} groupBy={groupBy} onGroupByChange={setGroupBy} />
        )}
        {activeTab === 'products' && <ProductsPanel range={range} />}
        {activeTab === 'customers' && <CustomersPanel range={range} />}
        {activeTab === 'orders' && <OrdersStatsPanel range={range} />}
        {activeTab === 'categories' && <CategoriesPanelStub range={range} />}
        {activeTab === 'inventory' && <InventoryPanel range={range} />}
        {activeTab === 'geographic' && <GeographicPanel range={range} />}
        {activeTab === 'refunds' && <RefundsPanel range={range} />}
      </section>
    </div>
  )
}

function CategoriesPanelStub({ range }: { range: DateRange }) {
  return (
    <div className="app-panel p-5">
      <p className="text-sm text-gray-500">
        Les graphiques par catégorie sont affichés sur le{' '}
        <a href="/dashboard" className="text-primary underline">
          tableau de bord
        </a>
        . Tu peux exporter le rapport « categories » via le bouton d&apos;export ci-dessus
        pour la période {range.startDate} → {range.endDate}.
      </p>
    </div>
  )
}
