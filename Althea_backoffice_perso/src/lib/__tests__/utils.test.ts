import { cn, formatCurrency, formatDate, formatDateTime, downloadBlob } from '../utils'

describe('cn', () => {
  it('concatène les classes non falsy', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('ignore les valeurs falsy', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('gère les tableaux et objets', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c')
  })
})

describe('formatCurrency', () => {
  it('formate un entier en euros français', () => {
    expect(formatCurrency(1234).replace(/\s/g, ' ')).toMatch(/1\s?234,00\s?€/)
  })

  it('formate une valeur décimale', () => {
    expect(formatCurrency(9.5).replace(/\s/g, ' ')).toMatch(/9,50\s?€/)
  })

  it('formate zéro', () => {
    expect(formatCurrency(0).replace(/\s/g, ' ')).toMatch(/0,00\s?€/)
  })
})

describe('formatDate', () => {
  it('formate une date au format JJ/MM/AAAA', () => {
    const date = new Date(2026, 3, 22) // 22 avril 2026
    expect(formatDate(date)).toBe('22/04/2026')
  })
})

describe('formatDateTime', () => {
  it('inclut heures et minutes', () => {
    const date = new Date(2026, 3, 22, 14, 5)
    const output = formatDateTime(date)
    expect(output).toMatch(/22\/04\/2026/)
    expect(output).toMatch(/14[:\s]05/)
  })
})

describe('downloadBlob', () => {
  let appendChildSpy: jest.SpyInstance
  let removeChildSpy: jest.SpyInstance
  let createObjectURLMock: jest.Mock
  let revokeObjectURLMock: jest.Mock

  beforeEach(() => {
    createObjectURLMock = jest.fn().mockReturnValue('blob://fake')
    revokeObjectURLMock = jest.fn()
    Object.defineProperty(window.URL, 'createObjectURL', {
      value: createObjectURLMock,
      writable: true,
    })
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      value: revokeObjectURLMock,
      writable: true,
    })
    appendChildSpy = jest.spyOn(document.body, 'appendChild')
    removeChildSpy = jest.spyOn(document.body, 'removeChild')
  })

  afterEach(() => {
    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  })

  it('crée un lien, clique, puis le retire et libère l\'URL', () => {
    const blob = new Blob(['data'], { type: 'text/plain' })
    downloadBlob(blob, 'file.txt')

    expect(createObjectURLMock).toHaveBeenCalledWith(blob)
    expect(appendChildSpy).toHaveBeenCalledTimes(1)
    expect(removeChildSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob://fake')

    const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(link.href).toBe('blob://fake')
    expect(link.download).toBe('file.txt')
  })
})
