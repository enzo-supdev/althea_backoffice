'use client'

import { ReactNode } from 'react'

interface FormActionsProps {
  children: ReactNode
  className?: string
}

export default function FormActions({ children, className = '' }: FormActionsProps) {
  return (
    <div className={`flex flex-col-reverse gap-3 sm:flex-row sm:justify-end ${className}`.trim()}>
      {children}
    </div>
  )
}