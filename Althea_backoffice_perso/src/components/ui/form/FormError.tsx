'use client'

interface FormErrorProps {
  id?: string
  message?: string
}

export default function FormError({ id, message }: FormErrorProps) {
  if (!message) {
    return null
  }

  return (
    <p id={id} className="mt-1 text-xs text-status-error" role="alert" aria-live="assertive">
      {message}
    </p>
  )
}