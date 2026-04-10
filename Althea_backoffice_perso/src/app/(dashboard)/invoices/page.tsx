'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, Mail, Edit, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import psltLogo from '../../../../AltheaLogo.png'
import DataTable, { Column } from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import SearchBar from '@/components/ui/SearchBar'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import FormActions from '@/components/ui/form/FormActions'
import FormField from '@/components/ui/form/FormField'
import { Invoice } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ApiError, invoicesApi } from '@/lib/api'

const editInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1, 'Le numero de facture est requis.'),
  amount: z.number().min(0.01, 'Le montant doit etre superieur a 0.'),
  createdAt: z.string().trim().min(1, 'La date d\'emission est requise.').refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    'Date d\'emission invalide.',
  ),
  status: z.enum(['paid', 'pending', 'cancelled']),
})

type EditInvoiceFormValues = z.infer<typeof editInvoiceSchema>

interface CreditNote {
  id: string
  sourceInvoiceId: string
  creditNumber: string
  invoiceNumber: string
  customerFullName: string
  amount: number
  reason: string
  createdAt: Date
}

const CREDIT_NOTES_STORAGE_KEY = 'althea.ui.credit-notes'

function loadCreditNotes(): CreditNote[] {
  if (typeof window === 'undefined') return []

  const raw = window.localStorage.getItem(CREDIT_NOTES_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Array<Omit<CreditNote, 'createdAt'> & { createdAt: string }>
    return parsed.map((creditNote) => ({
      ...creditNote,
      createdAt: new Date(creditNote.createdAt),
    }))
  } catch {
    return []
  }
}

function saveCreditNotes(creditNotes: CreditNote[]): void {
  window.localStorage.setItem(
    CREDIT_NOTES_STORAGE_KEY,
    JSON.stringify(
      creditNotes.map((creditNote) => ({
        ...creditNote,
        createdAt: creditNote.createdAt.toISOString(),
      }))
    )
  )
}

type PdfItemRow = {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

type PdfImage = {
  bytes: Uint8Array
  width: number
  height: number
}

const LOGO_SRC = typeof psltLogo === 'string' ? psltLogo : psltLogo.src

function normalizePdfText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/€/g, 'EUR')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?')
}

function formatPdfCurrency(amount: number): string {
  return formatCurrency(amount).replace(/[\u00A0\u202F]/g, ' ').replace('€', 'EUR')
}

function truncatePdfText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function wrapPdfText(value: string, maxLength: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  if (!words.length) return ['']

  const lines: string[] = []
  let currentLine = words[0]

  for (const word of words.slice(1)) {
    if ((currentLine + ' ' + word).length > maxLength) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine += ` ${word}`
    }
  }

  lines.push(currentLine)
  return lines
}

function pdfText(x: number, y: number, text: string, options: { size?: number; font?: string; color?: [number, number, number] } = {}): string {
  const { size = 11, font = 'F1', color = [0, 0, 0] } = options
  const [r, g, b] = color
  return [
    'BT',
    `/${font} ${size} Tf`,
    `${r} ${g} ${b} rg`,
    `1 0 0 1 ${x} ${y} Tm`,
    `(${normalizePdfText(text)}) Tj`,
    'ET',
  ].join('\n')
}

function pdfRect(x: number, y: number, width: number, height: number, options: { fill?: [number, number, number]; stroke?: [number, number, number]; lineWidth?: number } = {}): string {
  const parts: string[] = []
  const { fill, stroke, lineWidth = 1 } = options

  if (fill) {
    const [r, g, b] = fill
    parts.push(`${r} ${g} ${b} rg`)
    parts.push(`${x} ${y} ${width} ${height} re f`)
  }

  if (stroke) {
    const [r, g, b] = stroke
    parts.push(`${lineWidth} w`)
    parts.push(`${r} ${g} ${b} RG`)
    parts.push(`${x} ${y} ${width} ${height} re S`)
  }

  return parts.join('\n')
}

function pdfLine(x1: number, y1: number, x2: number, y2: number, color: [number, number, number] = [0.86, 0.87, 0.9], lineWidth = 1): string {
  const [r, g, b] = color
  return [
    `${lineWidth} w`,
    `${r} ${g} ${b} RG`,
    `${x1} ${y1} m ${x2} ${y2} l S`,
  ].join('\n')
}

function pdfImage(x: number, y: number, width: number, height: number): string {
  return ['q', `${width} 0 0 ${height} ${x} ${y} cm`, '/Im1 Do', 'Q'].join('\n')
}

function getInvoiceStatusLabel(status: Invoice['status']): string {
  if (status === 'paid') return 'Payee'
  if (status === 'pending') return 'En attente'
  return 'Annulee'
}

function getInvoiceStatusColor(status: Invoice['status']): [number, number, number] {
  if (status === 'paid') return [0.17, 0.53, 0.31]
  if (status === 'pending') return [0.78, 0.53, 0.08]
  return [0.72, 0.23, 0.22]
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join('')
}

function buildPdfDocument(contentStream: string, logo?: PdfImage | null): Blob {
  const pageWidth = 595.28
  const pageHeight = 841.89
  const encoder = new TextEncoder()
  const header = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n'
  const imageObjectNumber = logo ? 6 : 0
  const contentObjectNumber = logo ? 7 : 6
  const objects = logo
    ? [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 ${imageObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>\nendobj\n`,
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
        `6 0 obj\n<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${bytesToHex(logo.bytes).length + 1} >>\nstream\n${bytesToHex(logo.bytes)}>\nendstream\nendobj\n`,
        `7 0 obj\n<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
      ]
    : [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${contentObjectNumber} 0 R >>\nendobj\n`,
        '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
        `6 0 obj\n<< /Length ${encoder.encode(contentStream).length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
      ]

  let offset = encoder.encode(header).length
  const offsets = ['0000000000 65535 f \n']
  const serializedObjects = objects.map((object) => {
    offsets.push(`${String(offset).padStart(10, '0')} 00000 n \n`)
    offset += encoder.encode(object).length
    return object
  })

  const xrefOffset = offset
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    ...offsets,
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    `${xrefOffset}`,
    '%%EOF',
  ].join('\n') + '\n'

  return new Blob([encoder.encode(header + serializedObjects.join('') + xref)], { type: 'application/pdf' })
}

async function loadLogoImage(): Promise<PdfImage | null> {
  if (typeof window === 'undefined') return null

  try {
    const response = await fetch(LOGO_SRC)
    const sourceBlob = await response.blob()

    const bitmap = await createImageBitmap(sourceBlob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height

    const context = canvas.getContext('2d')
    if (!context) return null

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0)

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const bytes = new Uint8Array(canvas.width * canvas.height * 3)

    for (let index = 0, pixel = 0; index < imageData.data.length; index += 4, pixel += 3) {
      bytes[pixel] = imageData.data[index]
      bytes[pixel + 1] = imageData.data[index + 1]
      bytes[pixel + 2] = imageData.data[index + 2]
    }

    return {
      bytes,
      width: canvas.width,
      height: canvas.height,
    }
  } catch {
    return null
  }
}

async function buildInvoicePdf(invoice: Invoice): Promise<Blob> {
  const width = 595.28
  const pageHeight = 841.89
  const statusColor = getInvoiceStatusColor(invoice.status)
  const statusLabel = getInvoiceStatusLabel(invoice.status)
  const itemRows: PdfItemRow[] = invoice.order.items.map((item) => ({
    description: truncatePdfText(item.product.name, 42),
    quantity: item.quantity,
    unitPrice: item.price,
    total: item.quantity * item.price,
  }))
  const subtotal = itemRows.reduce((sum, item) => sum + item.total, 0)
  const logo = await loadLogoImage()
  const content: string[] = []

  content.push(pdfRect(0, 760, width, 82, { fill: [0.11, 0.17, 0.29] }))
  content.push(pdfRect(0, 752, width, 8, { fill: [0.76, 0.59, 0.21] }))
  content.push(pdfRect(36, 772, 176, 44, { fill: [1, 1, 1], stroke: [0.82, 0.84, 0.88], lineWidth: 0.8 }))
  if (logo) {
    content.push(pdfImage(44, 776, 148, 30))
  } else {
    content.push(pdfRect(44, 781, 24, 24, { fill: [0.18, 0.27, 0.43] }))
    content.push(pdfText(48, 798, 'AS', { size: 10, font: 'F2', color: [1, 1, 1] }))
  }
  content.push(pdfRect(447, 780, 112, 32, { fill: statusColor }))
  content.push(pdfText(471, 800, 'STATUT', { size: 7.5, font: 'F2', color: [1, 1, 1] }))
  content.push(pdfText(471, 786, statusLabel, { size: 10.5, font: 'F2', color: [1, 1, 1] }))
  content.push(pdfText(444, 770, invoice.invoiceNumber, { size: 11.5, font: 'F2', color: [0.11, 0.17, 0.29] }))

  content.push(pdfRect(36, 620, 246, 106, { fill: [0.97, 0.98, 0.99], stroke: [0.82, 0.84, 0.88], lineWidth: 0.8 }))
  content.push(pdfRect(312, 620, 246, 106, { fill: [0.97, 0.98, 0.99], stroke: [0.82, 0.84, 0.88], lineWidth: 0.8 }))
  content.push(pdfText(50, 708, 'CLIENT', { size: 9, font: 'F2', color: [0.11, 0.17, 0.29] }))
  content.push(pdfText(326, 708, 'DOCUMENT', { size: 9, font: 'F2', color: [0.11, 0.17, 0.29] }))
  content.push(pdfText(50, 686, invoice.customer.fullName, { size: 12, font: 'F2' }))
  content.push(pdfText(50, 670, invoice.customer.email, { size: 8.8, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(50, 655, `Commande: ${invoice.order.orderNumber}`, { size: 8.8, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(50, 640, `Paiement: ${invoice.order.paymentMethod}`, { size: 8.8, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(326, 686, `Numero: ${invoice.invoiceNumber}`, { size: 12, font: 'F2' }))
  content.push(pdfText(326, 670, `Etat: ${statusLabel}`, { size: 8.8, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(326, 655, `Mode: ${invoice.order.paymentStatus}`, { size: 8.8, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(326, 640, `Emission: ${formatDate(invoice.createdAt)}`, { size: 8.8, color: [0.32, 0.35, 0.4] }))

  content.push(pdfText(36, 592, 'ADRESSES', { size: 9, font: 'F2', color: [0.11, 0.17, 0.29] }))
  const billingAddress = invoice.order.billingAddress
  const shippingAddress = invoice.order.shippingAddress
  const addressLeft = [
    'Facturation',
    billingAddress ? `${billingAddress.address1}${billingAddress.address2 ? ` ${billingAddress.address2}` : ''}` : 'Adresse non renseignee',
    billingAddress ? `${billingAddress.postalCode} ${billingAddress.city}` : '',
    billingAddress ? `${billingAddress.region}, ${billingAddress.country}` : '',
  ].filter(Boolean)
  const addressRight = [
    'Livraison',
    shippingAddress ? `${shippingAddress.address1}${shippingAddress.address2 ? ` ${shippingAddress.address2}` : ''}` : 'Adresse non renseignee',
    shippingAddress ? `${shippingAddress.postalCode} ${shippingAddress.city}` : '',
    shippingAddress ? `${shippingAddress.region}, ${shippingAddress.country}` : '',
  ].filter(Boolean)
  addressLeft.forEach((line, index) => {
    content.push(pdfText(40, 574 - index * 13, line, { size: 8.5, color: [0.32, 0.35, 0.4] }))
  })
  addressRight.forEach((line, index) => {
    content.push(pdfText(320, 574 - index * 13, line, { size: 8.5, color: [0.32, 0.35, 0.4] }))
  })

  content.push(pdfRect(36, 388, 528, 170, { fill: [1, 1, 1], stroke: [0.82, 0.84, 0.88], lineWidth: 0.8 }))
  content.push(pdfRect(36, 531, 528, 27, { fill: [0.11, 0.17, 0.29] }))
  content.push(pdfText(52, 539, 'Designation', { size: 9, font: 'F2', color: [1, 1, 1] }))
  content.push(pdfText(318, 539, 'Qté', { size: 9, font: 'F2', color: [1, 1, 1] }))
  content.push(pdfText(380, 539, 'PU', { size: 9, font: 'F2', color: [1, 1, 1] }))
  content.push(pdfText(471, 539, 'Total', { size: 9, font: 'F2', color: [1, 1, 1] }))

  itemRows.forEach((item, index) => {
    const rowTop = 505 - index * 24
    const isStriped = index % 2 === 1
    if (isStriped) {
      content.push(pdfRect(36, rowTop - 4, 528, 20, { fill: [0.98, 0.99, 1] }))
    }
    content.push(pdfLine(36, rowTop + 11, 564, rowTop + 11, [0.9, 0.91, 0.94], 0.6))
    content.push(pdfText(52, rowTop, item.description, { size: 9 }))
    content.push(pdfText(318, rowTop, String(item.quantity), { size: 9 }))
    content.push(pdfText(376, rowTop, formatPdfCurrency(item.unitPrice), { size: 9 }))
    content.push(pdfText(456, rowTop, formatPdfCurrency(item.total), { size: 9, font: 'F2' }))
  })

  content.push(pdfRect(344, 244, 220, 112, { fill: [0.97, 0.98, 0.99], stroke: [0.82, 0.84, 0.88], lineWidth: 0.8 }))
  content.push(pdfText(360, 336, 'SYNTHESE', { size: 9, font: 'F2', color: [0.11, 0.17, 0.29] }))
  content.push(pdfText(360, 312, 'Sous-total', { size: 9, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(485, 312, formatPdfCurrency(subtotal), { size: 10, font: 'F2', color: [0.11, 0.17, 0.29] }))
  content.push(pdfText(360, 294, 'Montant total', { size: 9, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(485, 294, formatPdfCurrency(invoice.amount), { size: 15, font: 'F2', color: [0.11, 0.17, 0.29] }))
  content.push(pdfText(360, 276, 'Etat paiement', { size: 9, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(485, 276, invoice.order.paymentStatus, { size: 9, font: 'F2' }))
  content.push(pdfText(360, 258, 'Lignes', { size: 9, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(485, 258, String(itemRows.length), { size: 9, font: 'F2' }))

  content.push(pdfRect(36, 244, 292, 112, { fill: [1, 1, 1], stroke: [0.82, 0.84, 0.88], lineWidth: 0.8 }))
  content.push(pdfText(50, 336, 'NOTES', { size: 9, font: 'F2', color: [0.11, 0.17, 0.29] }))
  content.push(pdfText(50, 313, 'Paiement conforme aux conditions commerciales standard.', { size: 9, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(50, 297, 'Echeance et relances gerees dans le module facturation.', { size: 9, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(50, 281, 'Document genere localement pour previsualisation front.', { size: 9, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(50, 265, 'Version PDF de simulation en attente du moteur backend.', { size: 9, color: [0.32, 0.35, 0.4] }))

  content.push(pdfRect(36, 205, 528, 1.2, { fill: [0.82, 0.84, 0.88] }))
  content.push(pdfText(40, 186, 'ALTHEA Systems - BackOffice. Document genere automatiquement.', { size: 8.3, color: [0.45, 0.48, 0.54] }))
  content.push(pdfText(486, 186, 'Page 1 / 1', { size: 8.3, color: [0.45, 0.48, 0.54] }))
  content.push(pdfText(40, 170, `Reference interne: ${invoice.invoiceNumber} | Client: ${invoice.customer.fullName}`, { size: 8.3, color: [0.45, 0.48, 0.54] }))
  content.push(pdfText(40, 154, `Emission: ${formatDate(invoice.createdAt)} | Statut: ${statusLabel}`, { size: 8.3, color: [0.45, 0.48, 0.54] }))

  return buildPdfDocument(content.join('\n'), logo)
}

async function buildCreditNotePdf(creditNote: CreditNote): Promise<Blob> {
  const width = 595.28
  const logo = await loadLogoImage()
  const content: string[] = []

  content.push(pdfRect(0, 750, width, 91, { fill: [0.42, 0.2, 0.16] }))
  content.push(pdfRect(36, 772, 176, 44, { fill: [1, 1, 1], stroke: [0.84, 0.79, 0.76], lineWidth: 0.8 }))
  if (logo) {
    content.push(pdfImage(44, 776, 148, 30))
  } else {
    content.push(pdfRect(44, 781, 24, 24, { fill: [0.42, 0.2, 0.16] }))
    content.push(pdfText(48, 798, 'AS', { size: 10, font: 'F2', color: [1, 1, 1] }))
    content.push(pdfText(76, 798, 'ALTHEA SYSTEMS', { size: 11, font: 'F2', color: [0.42, 0.2, 0.16] }))
  }
  content.push(pdfText(92, 794, 'BackOffice - Avoir commercial', { size: 9.5, color: [0.98, 0.92, 0.88] }))
  content.push(pdfText(360, 802, 'AVOIR', { size: 18, font: 'F2', color: [1, 1, 1] }))
  content.push(pdfText(360, 786, creditNote.creditNumber, { size: 11.5, color: [0.98, 0.92, 0.88] }))
  content.push(pdfText(360, 770, formatDate(creditNote.createdAt), { size: 9.5, color: [0.98, 0.92, 0.88] }))

  content.push(pdfRect(36, 612, 528, 108, { fill: [0.99, 0.97, 0.96], stroke: [0.84, 0.79, 0.76], lineWidth: 0.8 }))
  content.push(pdfText(50, 702, 'INFORMATIONS', { size: 10, font: 'F2', color: [0.42, 0.2, 0.16] }))
  content.push(pdfText(50, 680, creditNote.customerFullName, { size: 12, font: 'F2' }))
  content.push(pdfText(50, 663, `Facture source: ${creditNote.invoiceNumber}`, { size: 9, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(50, 646, `Motif: ${truncatePdfText(creditNote.reason, 64)}`, { size: 9, color: [0.32, 0.35, 0.4] }))
  content.push(pdfText(334, 702, 'MONTANT', { size: 10, font: 'F2', color: [0.42, 0.2, 0.16] }))
  content.push(pdfText(334, 680, formatPdfCurrency(creditNote.amount), { size: 13, font: 'F2' }))
  content.push(pdfText(334, 663, `Creation: ${formatDate(creditNote.createdAt)}`, { size: 9, color: [0.32, 0.35, 0.4] }))

  content.push(pdfRect(36, 412, 528, 118, { fill: [1, 1, 1], stroke: [0.84, 0.79, 0.76], lineWidth: 0.8 }))
  content.push(pdfText(50, 513, 'JUSTIFICATIF', { size: 10, font: 'F2', color: [0.42, 0.2, 0.16] }))
  wrapPdfText(creditNote.reason, 72).slice(0, 4).forEach((line, index) => {
    content.push(pdfText(50, 490 - index * 16, line, { size: 9.5 }))
  })
  content.push(pdfText(50, 434, 'Ce document simule le flux de remboursement / annulation.', { size: 8.8, color: [0.45, 0.48, 0.54] }))

  content.push(pdfText(40, 190, 'Document genere localement dans le cadre de la simulation front.', { size: 8.4, color: [0.45, 0.48, 0.54] }))
  content.push(pdfText(470, 150, `Emis le ${formatDate(creditNote.createdAt)}`, { size: 8, color: [0.45, 0.48, 0.54] }))

  return buildPdfDocument(content.join('\n'), logo)
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'invoices' | 'credits'>('invoices')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const [previewPdfUrl, setPreviewPdfUrl] = useState('')
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const { pushToast } = useToast()

  const editInvoiceForm = useForm<EditInvoiceFormValues>({
    resolver: zodResolver(editInvoiceSchema),
    defaultValues: {
      invoiceNumber: '',
      amount: 0,
      createdAt: '',
      status: 'paid',
    },
  })

  useEffect(() => {
    let isMounted = true

    const loadInvoices = async () => {
      setLoadError('')
      setIsLoading(true)

      try {
        const loadedInvoices = await invoicesApi.list()
        if (!isMounted) return
        setInvoices(loadedInvoices)
      } catch (error) {
        if (!isMounted) return
        setLoadError('La facturation est indisponible.')
        pushToast({
          type: 'error',
          title: 'Chargement factures impossible',
          message: error instanceof ApiError ? error.message : 'Les donnees locales ont ete ignorees.',
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadInvoices()

    if (typeof window !== 'undefined') {
      setCreditNotes(loadCreditNotes())
    }

    return () => {
      isMounted = false
    }
  }, [pushToast])

  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl)
      }
    }
  }, [previewPdfUrl])

  const closeInvoicePreview = () => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl)
    }

    setPreviewPdfUrl('')
    setPreviewInvoice(null)
  }

  const persistInvoices = async (nextInvoices: Invoice[]) => {
    setInvoices(nextInvoices)

    try {
      await invoicesApi.save(nextInvoices)
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Sauvegarde impossible',
        message: error instanceof ApiError ? error.message : 'La synchronisation locale a echoue.',
      })
    }
  }

  const retryLoadInvoices = () => {
    setLoadError('')
    setIsLoading(true)

    void invoicesApi.list()
      .then((loadedInvoices) => {
        setInvoices(loadedInvoices)
      })
      .catch((error) => {
        setLoadError('La facturation est indisponible.')
        pushToast({
          type: 'error',
          title: 'Rechargement impossible',
          message: error instanceof ApiError ? error.message : 'La tentative de rechargement a echoue.',
        })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const persistCreditNotes = (nextCreditNotes: CreditNote[]) => {
    setCreditNotes(nextCreditNotes)

    try {
      saveCreditNotes(nextCreditNotes)
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Sauvegarde avoirs impossible',
        message: error instanceof ApiError ? error.message : 'La synchronisation locale a echoue.',
      })
    }
  }

  const createCreditNoteFromInvoice = (invoice: Invoice, reason: string) => {
    if (creditNotes.some((creditNote) => creditNote.sourceInvoiceId === invoice.id)) {
      return
    }

    const nextCreditNote: CreditNote = {
      id: `cn-${Date.now()}`,
      sourceInvoiceId: invoice.id,
      creditNumber: `AV-${invoice.invoiceNumber.replace(/^FACT-/, '')}`,
      invoiceNumber: invoice.invoiceNumber,
      customerFullName: invoice.customer.fullName,
      amount: invoice.amount,
      reason,
      createdAt: new Date(),
    }

    persistCreditNotes([nextCreditNote, ...creditNotes])
  }

  const openEditInvoice = (invoice: Invoice) => {
    setInvoiceToEdit(invoice)
    editInvoiceForm.reset({
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      createdAt: invoice.createdAt.toISOString().slice(0, 10),
      status: invoice.status,
    })
  }

  const updateInvoiceStatus = async (invoiceId: string, nextStatus: Invoice['status']) => {
    const nextInvoices: Invoice[] = invoices.map((invoice) =>
      invoice.id === invoiceId
        ? { ...invoice, status: nextStatus }
        : invoice
    )

    const previousInvoice = invoices.find((invoice) => invoice.id === invoiceId)

    await persistInvoices(nextInvoices)

    if (previousInvoice && nextStatus === 'cancelled' && previousInvoice.status !== 'cancelled') {
      createCreditNoteFromInvoice(previousInvoice, 'Annulation simulée de facture')
    }

    pushToast({
      type: 'success',
      title: 'Statut facture mis a jour',
      message: `La facture est maintenant ${nextStatus === 'paid' ? 'payee' : nextStatus === 'pending' ? 'en attente' : 'annulee'}.`,
    })
  }

  const handleSaveInvoiceMetadata = editInvoiceForm.handleSubmit(async (values) => {
    if (!invoiceToEdit) return

    const createdAt = new Date(values.createdAt)

    const nextInvoices: Invoice[] = invoices.map((invoice) =>
      invoice.id === invoiceToEdit.id
        ? {
            ...invoice,
            invoiceNumber: values.invoiceNumber.trim(),
            amount: values.amount,
            createdAt,
            status: values.status,
          }
        : invoice
    )

    await persistInvoices(nextInvoices)

    if (values.status === 'cancelled' && invoiceToEdit.status !== 'cancelled') {
      createCreditNoteFromInvoice(invoiceToEdit, 'Facture annulee depuis la fiche metadonnees')
    }

    setInvoiceToEdit(null)
    editInvoiceForm.reset()

    pushToast({
      type: 'success',
      title: 'Facture mise a jour',
      message: 'Les metadonnees ont ete enregistrees localement.',
    })
  })

  const removeInvoice = async () => {
    if (!invoiceToDelete) return
    createCreditNoteFromInvoice(invoiceToDelete, 'Suppression simulée de facture')
    const nextInvoices: Invoice[] = invoices.filter((invoice) => invoice.id !== invoiceToDelete.id)
    await persistInvoices(nextInvoices)
    setInvoiceToDelete(null)
    pushToast({
      type: 'success',
      title: 'Facture supprimee',
      message: 'Un avoir pourra etre genere ulterieurement en backend.',
    })
  }

  const handleSimulatedPdfDownload = async (invoice: Invoice) => {
    const pdf = await buildInvoicePdf(invoice)

    triggerDownload(pdf, `${invoice.invoiceNumber.toLowerCase()}-simulation.pdf`)

    pushToast({
      type: 'info',
      title: 'Export simule effectue',
      message: `Fichier de previsualisation exporte pour ${invoice.invoiceNumber}.`,
    })
  }

  const openInvoicePreview = async (invoice: Invoice) => {
    const pdf = await buildInvoicePdf(invoice)
    const pdfUrl = URL.createObjectURL(pdf)

    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl)
    }

    setPreviewInvoice(invoice)
    setPreviewPdfUrl(pdfUrl)
  }

  const handleCreditNoteDownload = async (creditNote: CreditNote) => {
    const pdf = await buildCreditNotePdf(creditNote)

    triggerDownload(pdf, `${creditNote.creditNumber.toLowerCase()}-simulation.pdf`)

    pushToast({
      type: 'info',
      title: 'Avoir exporte',
      message: `Fichier de previsualisation exporte pour ${creditNote.creditNumber}.`,
    })
  }

  const filteredInvoices = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    const filtered = invoices.filter((invoice) => {
      const matchesQuery =
        !query ||
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.customer.fullName.toLowerCase().includes(query) ||
        invoice.customer.email.toLowerCase().includes(query) ||
        invoice.order.orderNumber.toLowerCase().includes(query)

      const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus

      return matchesQuery && matchesStatus
    })

    filtered.sort((a, b) => {
      let aValue: string | number = ''
      let bValue: string | number = ''

      if (sortKey === 'customer') {
        aValue = a.customer.fullName
        bValue = b.customer.fullName
      } else if (sortKey === 'createdAt') {
        aValue = a.createdAt.getTime()
        bValue = b.createdAt.getTime()
      } else {
        aValue = (a as any)[sortKey] ?? ''
        bValue = (b as any)[sortKey] ?? ''
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === 'asc'
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue)
    })

    return filtered
  }, [invoices, searchQuery, filterStatus, sortKey, sortDirection])

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredInvoices.slice(start, start + pageSize)
  }, [filteredInvoices, currentPage, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize))

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      label: 'N° facture',
      sortable: true,
      render: (invoice) => (
        <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date emission',
      sortable: true,
      render: (invoice) => (
        <span className="text-gray-600">{formatDate(invoice.createdAt)}</span>
      ),
    },
    {
      key: 'customer',
      label: 'Client',
      sortable: true,
      render: (invoice) => (
        <div>
          <div className="font-medium text-gray-900">{invoice.customer.fullName}</div>
          <div className="text-sm text-gray-500">{invoice.customer.email}</div>
        </div>
      ),
    },
    {
      key: 'order',
      label: 'N° commande',
      render: (invoice) => (
        <Link
          href={`/orders?query=${encodeURIComponent(invoice.order.orderNumber)}`}
          className="text-primary hover:text-primary-hover hover:underline"
        >
          {invoice.order.orderNumber}
        </Link>
      ),
    },
    {
      key: 'amount',
      label: 'Montant TTC',
      sortable: true,
      render: (invoice) => (
        <span className="font-medium text-gray-900">
          {formatCurrency(invoice.amount)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Statut',
      sortable: true,
      render: (invoice) => (
        <Badge
          variant={
            invoice.status === 'paid'
              ? 'success'
              : invoice.status === 'pending'
                ? 'warning'
                : 'error'
          }
        >
          {invoice.status === 'paid' && 'Payee'}
          {invoice.status === 'pending' && 'En attente'}
          {invoice.status === 'cancelled' && 'Annulee'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (invoice) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Telecharger PDF"
            onClick={() => handleSimulatedPdfDownload(invoice)}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Envoyer par email"
            onClick={() => {
              window.location.href = `mailto:${invoice.customer.email}?subject=Facture ${invoice.invoiceNumber}`
            }}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Modifier les metadonnees"
            onClick={() => openEditInvoice(invoice)}
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void openInvoicePreview(invoice)}
            title="Apercu PDF simule"
            className="rounded p-1 text-gray-600 transition-colors hover:text-primary"
          >
            <span className="text-xs font-semibold">PDF</span>
          </button>
          <button
            type="button"
            title="Annuler / supprimer (genere un avoir)"
            onClick={() => setInvoiceToDelete(invoice)}
            className="rounded p-1 text-gray-600 transition-colors hover:text-status-error"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-dark md:text-3xl">
          Gestion des Factures
        </h1>
        <p className="mt-1 text-gray-600">Gerez les factures et les avoirs</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Onglets facturation">
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`border-b-2 py-2 text-sm font-medium transition-colors ${
              activeTab === 'invoices'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Factures ({invoices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credits')}
            className={`border-b-2 py-2 text-sm font-medium transition-colors ${
              activeTab === 'credits'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Avoirs ({creditNotes.length})
          </button>
        </nav>
      </div>

      {activeTab === 'invoices' ? (
        <>
          <div className="card space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchBar
                value={searchQuery}
                onChange={(value) => {
                  setSearchQuery(value)
                  setCurrentPage(1)
                }}
                placeholder="Rechercher facture, client, commande..."
                ariaLabel="Rechercher une facture"
              />
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value)
                  setCurrentPage(1)
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Filtrer par statut de facture"
              >
                <option value="all">Tous les statuts</option>
                <option value="paid">Payee</option>
                <option value="pending">En attente</option>
                <option value="cancelled">Annulee</option>
              </select>
            </div>
          </div>

          {loadError ? (
            <div className="card space-y-4 text-center" role="alert" aria-live="assertive" aria-atomic="true">
              <div>
                <h3 className="text-lg font-heading font-semibold text-dark">Chargement impossible</h3>
                <p className="mt-1 text-sm text-gray-600">{loadError}</p>
              </div>
              <div className="flex justify-center">
                <button type="button" onClick={retryLoadInvoices} className="btn-primary">
                  Reessayer
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-0">
              <DataTable
                columns={columns}
                data={paginatedInvoices}
                onSort={handleSort}
                sortKey={sortKey}
                sortDirection={sortDirection}
                emptyMessage="Aucune facture trouvee"
                isLoading={isLoading}
              />
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredInvoices.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}

          <Modal
            isOpen={!!previewInvoice}
            onClose={closeInvoicePreview}
            title="Apercu facture (simulation PDF)"
            size="xl"
          >
            {previewInvoice && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-700">
                  <div className="space-y-1">
                    <p><span className="font-medium text-dark">Numero:</span> {previewInvoice.invoiceNumber}</p>
                    <p><span className="font-medium text-dark">Client:</span> {previewInvoice.customer.fullName}</p>
                    <p><span className="font-medium text-dark">Commande:</span> {previewInvoice.order.orderNumber}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p><span className="font-medium text-dark">Date:</span> {formatDate(previewInvoice.createdAt)}</p>
                    <p><span className="font-medium text-dark">Montant:</span> {formatCurrency(previewInvoice.amount)}</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm">
                  {previewPdfUrl ? (
                    <iframe
                      title={`Apercu PDF ${previewInvoice.invoiceNumber}`}
                      src={previewPdfUrl}
                      className="h-[78vh] w-full bg-white"
                    />
                  ) : (
                    <div className="flex h-[78vh] items-center justify-center text-sm text-gray-500">
                      Chargement de l&apos;aperçu PDF...
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeInvoicePreview}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </Modal>

          <Modal
            isOpen={!!invoiceToEdit}
            onClose={() => {
              setInvoiceToEdit(null)
              editInvoiceForm.reset()
            }}
            title="Modifier la facture"
            size="lg"
          >
            {invoiceToEdit && (
              <form className="space-y-4" onSubmit={handleSaveInvoiceMetadata}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    label="Numero facture"
                    error={editInvoiceForm.formState.errors.invoiceNumber?.message}
                    htmlFor="editInvoiceNumber"
                  >
                    <input
                      id="editInvoiceNumber"
                      type="text"
                      {...editInvoiceForm.register('invoiceNumber')}
                      className="input-base"
                    />
                  </FormField>
                  <FormField
                    label="Montant TTC"
                    error={editInvoiceForm.formState.errors.amount?.message}
                    htmlFor="editInvoiceAmount"
                  >
                    <input
                      id="editInvoiceAmount"
                      type="number"
                      step="0.01"
                      {...editInvoiceForm.register('amount', { valueAsNumber: true })}
                      className="input-base"
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    label="Date emission"
                    error={editInvoiceForm.formState.errors.createdAt?.message}
                    htmlFor="editInvoiceCreatedAt"
                  >
                    <input
                      id="editInvoiceCreatedAt"
                      type="date"
                      {...editInvoiceForm.register('createdAt')}
                      className="input-base"
                    />
                  </FormField>
                  <FormField
                    label="Statut"
                    error={editInvoiceForm.formState.errors.status?.message}
                    htmlFor="editInvoiceStatus"
                  >
                    <select
                      id="editInvoiceStatus"
                      {...editInvoiceForm.register('status')}
                      className="input-base"
                    >
                      <option value="paid">Payee</option>
                      <option value="pending">En attente</option>
                      <option value="cancelled">Annulee</option>
                    </select>
                  </FormField>
                </div>
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-600">
                  Toute annulation depuis ce formulaire generera un avoir simulé dans l’onglet dedicacé.
                </div>
                <FormActions>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceToEdit(null)
                      editInvoiceForm.reset()
                    }}
                    className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={editInvoiceForm.formState.isSubmitting}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {editInvoiceForm.formState.isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </FormActions>
              </form>
            )}
          </Modal>

          <Modal
            isOpen={!!invoiceToDelete}
            onClose={() => setInvoiceToDelete(null)}
            title="Confirmer la suppression"
            size="md"
          >
            {invoiceToDelete && (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  Vous allez supprimer ou annuler la facture {invoiceToDelete.invoiceNumber}. Un avoir simulé sera genere.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setInvoiceToDelete(null)}
                    className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={removeInvoice}
                    className="rounded-lg bg-status-error px-4 py-2 text-sm text-white transition-colors hover:bg-status-error/90"
                  >
                    Confirmer la suppression
                  </button>
                </div>
              </div>
            )}
          </Modal>
        </>
      ) : (
        <div className="space-y-4">
          <div className="card p-0">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-dark">Avoirs generes</h2>
                  <p className="text-sm text-gray-500">Crees automatiquement lors d’une annulation ou suppression.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {creditNotes.length} avoir{creditNotes.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            {creditNotes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
                Aucun avoir genere pour le moment
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {creditNotes.map((creditNote) => (
                  <div key={creditNote.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{creditNote.creditNumber}</span>
                        <Badge variant="default">Avoir</Badge>
                      </div>
                      <p className="text-sm text-gray-600">Facture source {creditNote.invoiceNumber} - {creditNote.customerFullName}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {creditNote.reason} · {formatDate(creditNote.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{formatCurrency(creditNote.amount)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = `mailto:?subject=Avoir ${creditNote.creditNumber}&body=${encodeURIComponent(`Bonjour,\n\nVeuillez trouver l'avoir ${creditNote.creditNumber} lie a la facture ${creditNote.invoiceNumber}.\nMontant: ${formatCurrency(creditNote.amount)}\n\nCordialement`)}`
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                      >
                        Envoyer email
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreditNoteDownload(creditNote)}
                        className="btn-primary"
                      >
                        Exporter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
