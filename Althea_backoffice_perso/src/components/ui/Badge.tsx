'use client'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default'
  size?: 'sm' | 'md'
}

export default function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  const variantClasses = {
    success: 'bg-status-success/10 text-status-success border border-status-success/20',
    warning: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
    error: 'bg-status-error/10 text-status-error border border-status-error/20',
    info: 'bg-primary/10 text-primary border border-primary/20',
    default: 'bg-primary-light/70 text-dark border border-primary/10',
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  )
}
