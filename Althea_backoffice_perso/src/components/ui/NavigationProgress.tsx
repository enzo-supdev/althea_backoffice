'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  doneNavigationProgress,
  NAVIGATION_PROGRESS_DONE_EVENT,
  NAVIGATION_PROGRESS_START_EVENT,
  startNavigationProgress,
} from '@/lib/navigationProgress'

const START_DELAY_MS = 120
const INCREMENT_MS = 180
const INCREMENT_STEP = 7
const MAX_PROGRESS_BEFORE_DONE = 90
const HIDE_DELAY_MS = 220

export default function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isVisible, setIsVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const startDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const incrementRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isNavigatingRef = useRef(false)

  useEffect(() => {
    if (!isNavigatingRef.current) {
      return
    }

    doneNavigationProgress()
  }, [pathname, searchParams])

  useEffect(() => {
    const clearTimers = () => {
      if (startDelayRef.current) {
        clearTimeout(startDelayRef.current)
        startDelayRef.current = null
      }

      if (incrementRef.current) {
        clearInterval(incrementRef.current)
        incrementRef.current = null
      }

      if (hideDelayRef.current) {
        clearTimeout(hideDelayRef.current)
        hideDelayRef.current = null
      }
    }

    const handleStart = () => {
      clearTimers()
      isNavigatingRef.current = true

      startDelayRef.current = setTimeout(() => {
        setIsVisible(true)
        setProgress(10)

        incrementRef.current = setInterval(() => {
          setProgress((previous) => Math.min(previous + INCREMENT_STEP, MAX_PROGRESS_BEFORE_DONE))
        }, INCREMENT_MS)
      }, START_DELAY_MS)
    }

    const handleDone = () => {
      if (!isNavigatingRef.current) {
        return
      }

      isNavigatingRef.current = false

      if (startDelayRef.current) {
        clearTimeout(startDelayRef.current)
        startDelayRef.current = null
      }

      if (incrementRef.current) {
        clearInterval(incrementRef.current)
        incrementRef.current = null
      }

      setIsVisible(true)
      setProgress(100)

      hideDelayRef.current = setTimeout(() => {
        setIsVisible(false)
        setProgress(0)
      }, HIDE_DELAY_MS)
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        return
      }

      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const target = event.target as HTMLElement | null
      const link = target?.closest('a')
      if (!link) {
        return
      }

      const href = link.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return
      }

      if (!href.startsWith('/')) {
        return
      }

      const currentPath = `${window.location.pathname}${window.location.search}`
      if (href === currentPath) {
        return
      }

      startNavigationProgress()
    }

    window.addEventListener(NAVIGATION_PROGRESS_START_EVENT, handleStart)
    window.addEventListener(NAVIGATION_PROGRESS_DONE_EVENT, handleDone)
    document.addEventListener('click', handleDocumentClick)

    return () => {
      clearTimers()
      window.removeEventListener(NAVIGATION_PROGRESS_START_EVENT, handleStart)
      window.removeEventListener(NAVIGATION_PROGRESS_DONE_EVENT, handleDone)
      document.removeEventListener('click', handleDocumentClick)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] h-1 w-full"
    >
      <div
        className="h-full bg-primary shadow-[0_0_14px_rgba(0,168,181,0.75)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: isVisible ? 1 : 0,
        }}
      />
    </div>
  )
}
