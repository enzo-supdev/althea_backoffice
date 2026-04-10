'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export default function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) {
    return null
  }

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)
  const pageWindow = 2
  const startPage = Math.max(1, currentPage - pageWindow)
  const endPage = Math.min(totalPages, currentPage + pageWindow)

  const pageNumbers: number[] = []
  for (let page = startPage; page <= endPage; page++) {
    pageNumbers.push(page)
  }

  return (
    <div className="flex flex-col gap-3 border-t border-primary/10 bg-primary-light/20 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <span className="text-sm text-gray-700">
          Affichage de {startItem} a {endItem} sur {totalItems} resultats
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="w-full rounded-lg border border-primary/15 bg-shell-surface px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary md:w-auto"
          aria-label="Nombre d'elements par page"
        >
          <option value={10}>10 par page</option>
          <option value={25}>25 par page</option>
          <option value={50}>50 par page</option>
          <option value={100}>100 par page</option>
        </select>
      </div>

      <div className="flex items-center justify-end gap-1 md:gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-lg p-2 text-gray-600 hover:bg-primary-light/70 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Page precedente"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {startPage > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-primary-light/70"
            >
              1
            </button>
            {startPage > 2 && <span className="px-1 text-gray-400">...</span>}
          </>
        )}

        {pageNumbers.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              page === currentPage
                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                : 'text-gray-600 hover:bg-primary-light/70'
            }`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="px-1 text-gray-400">...</span>}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-primary-light/70"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-lg p-2 text-gray-600 hover:bg-primary-light/70 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Page suivante"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
