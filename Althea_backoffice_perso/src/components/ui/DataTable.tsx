'use client'

import { ReactNode } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export interface Column<T> {
  key: string
  label: ReactNode
  sortable?: boolean
  render?: (item: T) => ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  onSort?: (key: string) => void
  sortKey?: string
  sortDirection?: 'asc' | 'desc'
  onRowClick?: (item: T) => void
  emptyMessage?: string
  isLoading?: boolean
}

export default function DataTable<T extends { id: string }>({
  columns,
  data,
  onSort,
  sortKey,
  sortDirection,
  onRowClick,
  emptyMessage = 'Aucune donnee disponible',
  isLoading = false,
}: DataTableProps<T>) {
  const handleSort = (key: string) => {
    if (onSort) {
      onSort(key)
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-primary/10 bg-shell-surface shadow-sm">
      <table className="min-w-full divide-y divide-primary/10">
        <thead className="bg-primary-light/40">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-dark/70"
                scope="col"
              >
                <div className="flex items-center gap-2">
                  {column.label}
                  {column.sortable && (
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className="rounded p-0.5 text-gray-400 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`Trier par ${column.label}`}
                      aria-pressed={sortKey === column.key}
                    >
                      {sortKey === column.key ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-primary/10 bg-white">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    <div className="h-4 animate-pulse rounded bg-gray-200" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 py-12 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.id}
                onClick={() => onRowClick?.(item)}
                onKeyDown={(event) => {
                  if (!onRowClick) {
                    return
                  }

                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onRowClick(item)
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? 'Ouvrir le détail de la ligne' : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-primary-light/40' : ''}
              >
                {columns.map((column) => (
                  <td key={column.key} className="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                    {column.render
                      ? column.render(item)
                      : String((item as any)[column.key] || '-')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
