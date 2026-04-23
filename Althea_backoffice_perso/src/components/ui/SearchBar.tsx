'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  debounceMs?: number
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Rechercher...',
  ariaLabel = 'Recherche',
  debounceMs = 250,
}: SearchBarProps) {
  const [draftValue, setDraftValue] = useState(value)

  useEffect(() => {
    setDraftValue(value)
  }, [value])

  useEffect(() => {
    if (draftValue === value) return

    if (debounceMs <= 0) {
      onChange(draftValue)
      return
    }

    const timeoutId = window.setTimeout(() => {
      onChange(draftValue)
    }, debounceMs)

    return () => window.clearTimeout(timeoutId)
  }, [draftValue, value, debounceMs, onChange])

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={draftValue}
        onChange={(e) => setDraftValue(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="input-base bg-shell-surface pl-10"
      />
    </div>
  )
}
