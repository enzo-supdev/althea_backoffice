import { ApiError, ApiErrorPayload } from './types'

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
