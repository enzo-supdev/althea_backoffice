'use client'

import { useEffect, useState } from 'react'
import { Users, Crown, UserPlus, ShoppingBag } from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import type { CustomerAnalytics } from '@/lib/api/types'
import { formatCurrency } from '@/lib/utils'
import type { DateRange } from './AnalyticsFilters'

interface CustomersPanelProps {
  range: DateRange
}

export default function CustomersPanel({ range }: CustomersPanelProps) {
  const [limit, setLimit] = useState<number>(10)
  const [data, setData] = useState<CustomerAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await analyticsApi.getCustomers({
          startDate: range.startDate,
          endDate: range.endDate,
          limit,
        })
        if (!cancelled) setData(response)
      } catch (err) {
        if (!cancelled) {
          console.error('Erreur customer analytics:', err)
          setError('Impossible de charger les stats clients.')
          setData(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [range.startDate, range.endDate, limit])

  if (isLoading) {
    return <p className="text-sm text-gray-500">Chargement des stats clients…</p>
  }

  if (error || !data) {
    return <p className="text-sm text-status-error">{error ?? 'Données indisponibles.'}</p>
  }

  const topCustomers = data.topCustomers ?? []
  const totalRevenueTop = topCustomers.reduce((acc, customer) => acc + (Number(customer.totalSpent) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Nouveaux clients</p>
            <UserPlus className="h-5 w-5 text-status-success" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {data.newCustomers ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">Sur la période sélectionnée</p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">Commandes moyennes</p>
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {(data.averageOrdersPerCustomer ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-500">par client</p>
        </div>
        <div className="app-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">CA top {topCustomers.length}</p>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-heading font-semibold text-dark">
            {formatCurrency(totalRevenueTop)}
          </p>
          <p className="mt-1 text-xs text-gray-500">Contribution cumulée</p>
        </div>
      </div>

      <div className="app-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-heading font-semibold text-dark">Top clients</h3>
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="input-base w-auto px-3 py-1 text-sm"
            aria-label="Nombre de clients"
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
          </select>
        </div>
        {topCustomers.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun client à afficher sur cette période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-left text-gray-600">
                  <th className="py-2 pr-4 font-medium">Client</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Total dépensé</th>
                  <th className="py-2 pr-4 font-medium">Commandes</th>
                  <th className="py-2 pr-4 font-medium">Panier moyen</th>
                  <th className="py-2 pr-4 font-medium">LTV</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, index) => {
                  const fullName = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() || customer.email
                  return (
                    <tr key={customer.userId ?? index} className="border-b border-primary/5">
                      <td className="py-2 pr-4 font-medium text-dark">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Crown className="h-4 w-4 text-status-warning" />}
                          {fullName}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{customer.email}</td>
                      <td className="py-2 pr-4 text-dark">{formatCurrency(customer.totalSpent ?? 0)}</td>
                      <td className="py-2 pr-4 text-gray-600">{customer.orderCount ?? 0}</td>
                      <td className="py-2 pr-4 text-gray-600">
                        {customer.averageOrderValue != null
                          ? formatCurrency(customer.averageOrderValue)
                          : '—'}
                      </td>
                      <td className="py-2 pr-4 text-gray-600">
                        {customer.lifetimeValue != null ? formatCurrency(customer.lifetimeValue) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
