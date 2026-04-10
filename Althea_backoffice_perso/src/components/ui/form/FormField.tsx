'use client'

import { ReactNode } from 'react'
import FormError from './FormError'

interface FormFieldProps {
  label: string
  htmlFor: string
  children: ReactNode
  error?: string
  hint?: string
}

export default function FormField({ label, htmlFor, children, error, hint }: FormFieldProps) {
  const errorId = error ? `${htmlFor}-error` : undefined
  const hintId = hint ? `${htmlFor}-hint` : undefined

  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
      <FormError id={errorId} message={error} />
    </div>
  )
}