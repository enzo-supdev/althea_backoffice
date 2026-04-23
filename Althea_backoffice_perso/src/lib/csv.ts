export function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0
  while (i < line.length) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i += 2
        continue
      }
      if (char === '"') {
        inQuotes = false
        i++
        continue
      }
      current += char
      i++
      continue
    }
    if (char === '"') {
      inQuotes = true
      i++
      continue
    }
    if (char === delimiter) {
      out.push(current)
      current = ''
      i++
      continue
    }
    current += char
    i++
  }
  out.push(current)
  return out
}

export function parseCsv(text: string): Record<string, string>[] {
  const normalized = text.replace(/^﻿/, '')
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) return []

  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers = parseCsvLine(lines[0], delimiter).map((header) => header.trim())

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter)
    const row: Record<string, string> = {}
    headers.forEach((header, idx) => {
      row[header] = (values[idx] ?? '').trim()
    })
    return row
  })
}

export function escapeCsvCell(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes(',')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildCsv(columns: string[], rows: string[][]): string {
  const lines = [columns.join(';')]
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(';'))
  }
  return lines.join('\n')
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

export const toSlug = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
