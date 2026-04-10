import StatsCards from '@/components/dashboard/StatsCards'
import SalesByCategoryChart from '@/components/dashboard/SalesByCategoryChart'
import SalesHistogram from '@/components/dashboard/SalesHistogram'
import AverageBasketChart from '@/components/dashboard/AverageBasketChart'
import QuickActions from '@/components/dashboard/QuickActions'
import RecentOrdersPanel from '@/components/dashboard/RecentOrdersPanel'
import PageHeader from '@/components/layout/PageHeader'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pilotage"
        title="Tableau de bord"
        description="Vue d'ensemble de l'activité, dans un cadre plus clair et plus homogène."
      />

      <StatsCards />

      <QuickActions />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SalesByCategoryChart />
        <SalesHistogram />
      </div>

      <AverageBasketChart />

      <RecentOrdersPanel />
    </div>
  )
}
