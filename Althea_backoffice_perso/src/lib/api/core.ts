import axios from 'axios'
import { ApiError, ApiErrorPayload } from './types'

/**
 * Extrait un message d'erreur lisible depuis une exception (Axios, ApiError, Error, ...).
 * Privilégie le message renvoyé par le backend dans le corps 4xx/5xx — qui contient
 * souvent la raison exacte du rejet (validation de champ, ref introuvable, etc.).
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message || fallback
  }

  if (axios.isAxiosError(error)) {
    const body: any = error.response?.data
    if (body) {
      if (typeof body === 'string') return body
      if (typeof body.error?.message === 'string') return body.error.message
      if (typeof body.message === 'string') return body.message
      if (body.errors && typeof body.errors === 'object') {
        const first = Object.values(body.errors)[0]
        if (typeof first === 'string') return first
        if (Array.isArray(first) && typeof first[0] === 'string') return first[0]
      }
    }
    if (error.message) return error.message
  }

  if (error instanceof Error) return error.message || fallback
  return fallback
}

export interface StorageEnvelope<T> {
  schemaVersion: number
  updatedAt: string
  items: T[]
}

export const API_SCHEMA_VERSION = 2

function createFallbackEnvelope<T>(fallback: T[]): StorageEnvelope<T> {
  return {
    schemaVersion: API_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    items: fallback,
  }
}

function migrateEnvelope<T>(key: string, parsed: Partial<StorageEnvelope<T>>): StorageEnvelope<T> {
  if (parsed.schemaVersion === 1) {
    const migrated = {
      schemaVersion: API_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      items: Array.isArray(parsed.items) ? parsed.items : [],
    }

    window.localStorage.setItem(key, JSON.stringify(migrated))
    return migrated
  }

  return createFallbackEnvelope([])
}

export async function withLatency<T>(factory: () => T, latencyMs = 120): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, latencyMs))
  return factory()
}

export function throwApiError(payload: ApiErrorPayload): never {
  throw new ApiError(payload)
}

export function readStore<T>(key: string, fallback: T[]): StorageEnvelope<T> {
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return createFallbackEnvelope(fallback)
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StorageEnvelope<T>>

    if (!Array.isArray(parsed.items)) {
      return createFallbackEnvelope(fallback)
    }

    if ((parsed.schemaVersion ?? 0) < API_SCHEMA_VERSION) {
      return migrateEnvelope(key, parsed)
    }

    return {
      schemaVersion: parsed.schemaVersion ?? API_SCHEMA_VERSION,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      items: parsed.items,
    }
  } catch {
    return createFallbackEnvelope(fallback)
  }
}

export function writeStore<T>(key: string, items: T[]): StorageEnvelope<T> {
  const envelope: StorageEnvelope<T> = {
    schemaVersion: API_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    items,
  }

  window.localStorage.setItem(key, JSON.stringify(envelope))
  return envelope
}
