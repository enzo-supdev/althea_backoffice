import axios from 'axios'
import { extractErrorMessage, readStore, writeStore, throwApiError, API_SCHEMA_VERSION } from '../core'
import { ApiError } from '../types'

describe('extractErrorMessage', () => {
  it('utilise le message d\'un ApiError', () => {
    const err = new ApiError({ code: 'VALIDATION', message: 'Champ invalide' })
    expect(extractErrorMessage(err, 'fallback')).toBe('Champ invalide')
  })

  it('utilise le fallback quand ApiError a un message vide', () => {
    const err = new ApiError({ code: 'X', message: '' })
    expect(extractErrorMessage(err, 'fallback')).toBe('fallback')
  })

  it('récupère body.error.message sur une AxiosError', () => {
    const err = {
      isAxiosError: true,
      response: { data: { error: { message: 'Token expiré' } } },
      message: 'Request failed',
    }
    jest.spyOn(axios, 'isAxiosError').mockReturnValueOnce(true)
    expect(extractErrorMessage(err, 'fallback')).toBe('Token expiré')
  })

  it('récupère body.message sur une AxiosError', () => {
    const err = {
      isAxiosError: true,
      response: { data: { message: 'Interdit' } },
      message: 'x',
    }
    jest.spyOn(axios, 'isAxiosError').mockReturnValueOnce(true)
    expect(extractErrorMessage(err, 'fallback')).toBe('Interdit')
  })

  it('récupère la première erreur de body.errors (tableau)', () => {
    const err = {
      isAxiosError: true,
      response: { data: { errors: { email: ['Email invalide'] } } },
      message: 'x',
    }
    jest.spyOn(axios, 'isAxiosError').mockReturnValueOnce(true)
    expect(extractErrorMessage(err, 'fallback')).toBe('Email invalide')
  })

  it('retombe sur error.message quand aucune structure connue', () => {
    const err = { isAxiosError: true, response: undefined, message: 'net::ERR_FAILED' }
    jest.spyOn(axios, 'isAxiosError').mockReturnValueOnce(true)
    expect(extractErrorMessage(err, 'fallback')).toBe('net::ERR_FAILED')
  })

  it('utilise le message d\'un Error standard', () => {
    expect(extractErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('retombe sur fallback pour une valeur inconnue', () => {
    expect(extractErrorMessage('string', 'fallback')).toBe('fallback')
    expect(extractErrorMessage(null, 'fallback')).toBe('fallback')
  })
})

describe('throwApiError', () => {
  it('lève une ApiError construite depuis le payload', () => {
    expect(() => throwApiError({ code: 'X', message: 'nope' })).toThrow(ApiError)
    try {
      throwApiError({ code: 'X', message: 'nope', fieldErrors: { a: 'b' } })
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).code).toBe('X')
      expect((err as ApiError).fieldErrors).toEqual({ a: 'b' })
    }
  })
})

describe('readStore / writeStore', () => {
  const KEY = 'test:store'

  beforeEach(() => {
    localStorage.clear()
  })

  it('retourne un fallback quand la clé est absente', () => {
    const envelope = readStore(KEY, [{ id: 'a' }])
    expect(envelope.schemaVersion).toBe(API_SCHEMA_VERSION)
    expect(envelope.items).toEqual([{ id: 'a' }])
  })

  it('retourne le fallback si JSON invalide', () => {
    localStorage.setItem(KEY, 'not-json')
    const envelope = readStore(KEY, [])
    expect(envelope.items).toEqual([])
  })

  it('retourne le fallback si items n\'est pas un tableau', () => {
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 2, items: null }))
    const envelope = readStore(KEY, [{ id: 'fb' }])
    expect(envelope.items).toEqual([{ id: 'fb' }])
  })

  it('migre une enveloppe v1 vers la version courante', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ schemaVersion: 1, items: [{ id: '1' }] }),
    )
    const envelope = readStore(KEY, [])
    expect(envelope.schemaVersion).toBe(API_SCHEMA_VERSION)
    expect(envelope.items).toEqual([{ id: '1' }])
    const persisted = JSON.parse(localStorage.getItem(KEY) as string)
    expect(persisted.schemaVersion).toBe(API_SCHEMA_VERSION)
  })

  it('writeStore persiste avec schemaVersion et updatedAt', () => {
    const envelope = writeStore(KEY, [{ id: 'x' }])
    expect(envelope.schemaVersion).toBe(API_SCHEMA_VERSION)
    expect(envelope.items).toEqual([{ id: 'x' }])
    const persisted = JSON.parse(localStorage.getItem(KEY) as string)
    expect(persisted.items).toEqual([{ id: 'x' }])
    expect(typeof persisted.updatedAt).toBe('string')
  })
})
