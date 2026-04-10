'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { ToastProvider } from '@/components/ui/ToastProvider'
import NavigationProgress from '@/components/ui/NavigationProgress'
import { useAuthContext } from '@/contexts/AuthContext'
import { TWO_FACTOR_PENDING_KEY } from '@/lib/security'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isAuthenticated, loading, logout } = useAuthContext()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    if (loading) {
      return
    }

    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    if (user?.role !== 'admin') {
      logout()
      router.replace('/login')
      return
    }

    const requiresSecondFactor = typeof window !== 'undefined' && window.localStorage.getItem(TWO_FACTOR_PENDING_KEY) === 'true'
    if (requiresSecondFactor) {
      router.replace('/login')
    }
  }, [isAuthenticated, loading, logout, router, user?.role])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-600">Vérification des accès...</p>
      </div>
    )
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null
  }

  return (
    <ToastProvider>
      <NavigationProgress />
      <div className="min-h-screen md:flex">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <div className="flex min-h-screen flex-1 flex-col overflow-hidden bg-shell-canvas/60 md:bg-transparent">
          <Header onOpenSidebar={() => setIsSidebarOpen(true)} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
