'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import type { AdminCreditNote } from '@/lib/api/invoicesApi'
import ExportButton from '@/components/ui/ExportButton'

const SERVER_SORT_FIELDS = new Set(['invoiceNumber', 'createdAt', 'amount', 'status'])

function mapStatusToApi(status: string): string | undefined {
  if (status === 'all') return undefined
  return status.toUpperCase()
}

const editInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1, 'Le numero de facture est requis.'),
  amount: z.number().min(0.01, 'Le montant doit etre superieur a 0.'),
  createdAt: z.string().trim().min(1, 'La date d\'emission est requise.').refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    'Date d\'emission invalide.',
  ),
  status: z.enum(['paid', 'pending', 'cancelled', 'refunded']),
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

function mapApiCreditNote(raw: AdminCreditNote): CreditNote {
  return {
    id: raw.id,
    sourceInvoiceId: raw.invoice?.id ?? '',
    creditNumber: raw.number ?? '',
    invoiceNumber: raw.invoice?.number ?? '',
    customerFullName: '',
    amount: typeof raw.amount === 'string' ? Number(raw.amount) : raw.amount,
    reason: raw.notes ?? raw.reason ?? '',
    createdAt: raw.issuedAt ? new Date(raw.issuedAt) : new Date(),
  }
}

type PdfImage = {
  bytes: Uint8Array
  width: number
  height: number
}

const LOGO_SRC = typeof psltLogo === 'string' ? psltLogo : psltLogo.src

function normalizePdfText(value: string | null | undefined): string {
  return String(value ?? '')
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

function pdfImage(x: number, y: number, width: number, height: number): string {
  return ['q', `${width} 0 0 ${height} ${x} ${y} cm`, '/Im1 Do', 'Q'].join('\n')
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

function formatDateMaybe(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return formatDate(date)
}

function InvoicePreviewContent({
  invoice,
  pdfUrl,
  detailLoading,
  onClose,
  onDownload,
}: {
  invoice: Invoice
  pdfUrl: string
  detailLoading: boolean
  onClose: () => void
  onDownload: () => void
}) {
  const statusLabel =
    invoice.status === 'paid'
      ? 'Payee'
      : invoice.status === 'pending'
        ? 'En attente'
        : invoice.status === 'refunded'
          ? 'Remboursee'
          : 'Annulee'

  const statusClass =
    invoice.status === 'paid'
      ? 'bg-green-100 text-green-800'
      : invoice.status === 'pending'
        ? 'bg-orange-100 text-orange-800'
        : invoice.status === 'refunded'
          ? 'bg-gray-200 text-gray-800'
          : 'bg-red-100 text-red-800'

  const customerName =
    invoice.customerSnapshot
      ? [invoice.customerSnapshot.firstName, invoice.customerSnapshot.lastName].filter(Boolean).join(' ').trim() ||
        invoice.customer.fullName
      : invoice.customer.fullName
  const customerEmail = invoice.customerSnapshot?.email ?? invoice.customer.email

  const billing = invoice.billingAddressSnapshot ?? invoice.order.billingAddress ?? null

  const items = (invoice.items && invoice.items.length > 0 ? invoice.items : invoice.order.items) as Invoice['items']

  const subtotalHt = typeof invoice.subtotalHt === 'number' ? invoice.subtotalHt : null
  const totalVat = typeof invoice.totalVat === 'number' ? invoice.totalVat : null
  const totalTtc =
    typeof invoice.totalTtc === 'number' && invoice.totalTtc > 0 ? invoice.totalTtc : invoice.amount

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 text-sm text-gray-700">
        <div className="space-y-1">
          <p><span className="font-medium text-dark">Numero :</span> {invoice.invoiceNumber}</p>
          <p><span className="font-medium text-dark">Emission :</span> {formatDateMaybe(invoice.issuedAt ?? invoice.createdAt)}</p>
          {invoice.paidAt && (
            <p><span className="font-medium text-dark">Paiement :</span> {formatDateMaybe(invoice.paidAt)}</p>
          )}
          {invoice.cancelledAt && (
            <p><span className="font-medium text-dark">Annulation :</span> {formatDateMaybe(invoice.cancelledAt)}</p>
          )}
          <p><span className="font-medium text-dark">Commande :</span> {invoice.order.orderNumber}</p>
        </div>
        <div className="space-y-1 text-right">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
          <p className="text-lg font-semibold text-dark">{formatCurrency(totalTtc)}</p>
          <p className="text-xs text-gray-500">Total TTC</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Facturer a</h3>
          <p className="mt-2 font-medium text-dark">{customerName}</p>
          <p className="text-sm text-gray-600">{customerEmail}</p>
          {billing ? (
            <address className="mt-2 not-italic text-sm text-gray-600">
              {billing.address1}
              {billing.address2 ? (
                <>
                  <br />
                  {billing.address2}
                </>
              ) : null}
              <br />
              {billing.postalCode} {billing.city}
              <br />
              {billing.country}
              {billing.phone ? (
                <>
                  <br />
                  Tel : {billing.phone}
                </>
              ) : null}
            </address>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Adresse de facturation non renseignee.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Synthese</h3>
          <dl className="mt-2 space-y-1 text-sm text-gray-700">
            {subtotalHt !== null && (
              <div className="flex justify-between">
                <dt>Sous-total HT</dt>
                <dd className="font-medium text-dark">{formatCurrency(subtotalHt)}</dd>
              </div>
            )}
            {totalVat !== null && (
              <div className="flex justify-between">
                <dt>TVA</dt>
                <dd className="font-medium text-dark">{formatCurrency(totalVat)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base">
              <dt className="font-semibold text-dark">Total TTC</dt>
              <dd className="font-semibold text-dark">{formatCurrency(totalTtc)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Articles</span>
          {detailLoading ? <span className="text-gray-400">Chargement...</span> : null}
        </div>
        {items && items.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">Designation</th>
                <th className="px-4 py-2">Qte</th>
                <th className="px-4 py-2">PU HT</th>
                <th className="px-4 py-2">TVA</th>
                <th className="px-4 py-2">PU TTC</th>
                <th className="px-4 py-2 text-right">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const unitHt = typeof item.priceHt === 'number' ? item.priceHt : null
                const unitTtc = typeof item.priceTtc === 'number' ? item.priceTtc : item.price
                const rate = typeof item.vatRate === 'number' ? item.vatRate : null
                return (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-dark">{item.productName ?? item.product.name}</td>
                    <td className="px-4 py-2">{item.quantity}</td>
                    <td className="px-4 py-2">{unitHt !== null ? formatCurrency(unitHt) : '-'}</td>
                    <td className="px-4 py-2">{rate !== null ? `${Math.round(rate * 100)}%` : '-'}</td>
                    <td className="px-4 py-2">{formatCurrency(unitTtc)}</td>
                    <td className="px-4 py-2 text-right font-medium text-dark">
                      {formatCurrency(unitTtc * item.quantity)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-gray-500">
            {detailLoading ? 'Chargement des lignes...' : 'Aucun article lie a cette facture.'}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm">
        {pdfUrl ? (
          <iframe
            title={`Apercu PDF ${invoice.invoiceNumber}`}
            src={pdfUrl}
            className="h-[60vh] w-full bg-white"
          />
        ) : (
          <div className="flex h-[60vh] items-center justify-center text-sm text-gray-500">
            Chargement de l&apos;apercu PDF...
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDownload}
          className="btn-primary"
        >
          Telecharger PDF
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'invoices' | 'credits'>('invoices')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortKey, setSortKey] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const [previewPdfUrl, setPreviewPdfUrl] = useState('')
  const [previewDetailLoading, setPreviewDetailLoading] = useState(false)
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null)
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null)
  const [creditNotesPage, setCreditNotesPage] = useState(1)
  const [creditNotesTotal, setCreditNotesTotal] = useState(0)
  const [creditNotesLoading, setCreditNotesLoading] = useState(false)
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

  const pushToastRef = useRef(pushToast)
  useEffect(() => {
    pushToastRef.current = pushToast
  }, [pushToast])

  const loadInvoices = useCallback(async () => {
    setLoadError('')
    setIsLoading(true)

    const params: Parameters<typeof invoicesApi.list>[0] = {
      page: currentPage,
      limit: pageSize,
      search: searchQuery || undefined,
      status: mapStatusToApi(filterStatus),
      sortBy: SERVER_SORT_FIELDS.has(sortKey) ? sortKey : undefined,
      order: sortDirection,
    }

    try {
      const result = await invoicesApi.list(params)
      setInvoices(result.data)
      setTotalItems(result.meta?.total ?? result.data.length)
    } catch (error) {
      setInvoices([])
      setTotalItems(0)
      setLoadError(
        error instanceof ApiError
          ? error.message
          : 'Impossible de récupérer les factures (voir la console pour le détail serveur).',
      )
      pushToastRef.current({
        type: 'error',
        title: 'Chargement factures impossible',
        message: error instanceof ApiError ? error.message : 'Le serveur a renvoyé une erreur (voir console).',
      })
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, pageSize, searchQuery, filterStatus, sortKey, sortDirection])

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchQuery(searchInput.trim())
      setCurrentPage(1)
    }, 350)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const loadCreditNotesFromApi = useCallback(async () => {
    setCreditNotesLoading(true)
    try {
      const res = await invoicesApi.listCreditNotes({
        page: creditNotesPage,
        limit: pageSize,
      })
      setCreditNotes(res.creditNotes.map(mapApiCreditNote))
      setCreditNotesTotal(res.pagination.total ?? res.creditNotes.length)
    } catch (error) {
      setCreditNotes([])
      setCreditNotesTotal(0)
      pushToastRef.current({
        type: 'error',
        title: 'Chargement avoirs impossible',
        message: error instanceof ApiError ? error.message : 'Le serveur a renvoyé une erreur (voir console).',
      })
    } finally {
      setCreditNotesLoading(false)
    }
  }, [creditNotesPage, pageSize])

  useEffect(() => {
    void loadCreditNotesFromApi()
  }, [loadCreditNotesFromApi])

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
    setPreviewDetailLoading(false)
  }

  const retryLoadInvoices = () => {
    void loadInvoices()
  }

  const createCreditNoteForInvoice = async (
    invoice: Invoice,
    reason: 'cancellation' | 'refund' | 'error',
    notes: string,
  ): Promise<boolean> => {
    try {
      await invoicesApi.createCreditNote(invoice.id, {
        amount: invoice.amount,
        reason,
        notes,
        sendEmail: false,
      })
      await loadCreditNotesFromApi()
      return true
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Avoir non créé',
        message:
          error instanceof ApiError
            ? error.message
            : 'La création de l\'avoir côté serveur a échoué.',
      })
      return false
    }
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

  const handleSaveInvoiceMetadata = editInvoiceForm.handleSubmit(async (values) => {
    if (!invoiceToEdit) return

    if (values.status === 'cancelled' && invoiceToEdit.status !== 'cancelled') {
      const ok = await createCreditNoteForInvoice(
        invoiceToEdit,
        'cancellation',
        'Facture annulée depuis la fiche métadonnées',
      )
      if (!ok) return
      await loadInvoices()
      pushToast({
        type: 'success',
        title: 'Avoir créé',
        message: 'Un avoir a été émis côté serveur.',
      })
    } else {
      pushToast({
        type: 'info',
        title: 'Aucune action serveur',
        message: 'Les métadonnées de facture ne sont pas modifiables via l\'API actuelle.',
      })
    }

    setInvoiceToEdit(null)
    editInvoiceForm.reset()
  })

  const removeInvoice = async () => {
    if (!invoiceToDelete) return
    const ok = await createCreditNoteForInvoice(
      invoiceToDelete,
      'cancellation',
      'Annulation depuis le back-office',
    )
    setInvoiceToDelete(null)
    if (ok) {
      await loadInvoices()
      pushToast({
        type: 'success',
        title: 'Avoir émis',
        message: 'Un avoir a été créé pour cette facture.',
      })
    }
  }

  const handleSimulatedPdfDownload = async (invoice: Invoice) => {
    try {
      const pdf = await invoicesApi.downloadPdf(invoice.id)
      triggerDownload(pdf, `${invoice.invoiceNumber.toLowerCase()}.pdf`)
      pushToast({
        type: 'success',
        title: 'Facture telechargee',
        message: `${invoice.invoiceNumber} exportee depuis le serveur.`,
      })
    } catch (error) {
      console.error('[invoices] Téléchargement PDF serveur échoué :', error)
      pushToast({
        type: 'error',
        title: 'Téléchargement impossible',
        message:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : 'Le serveur n\'a pas renvoyé de PDF pour cette facture.',
      })
    }
  }

  const openInvoicePreview = async (invoice: Invoice) => {
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl)
      setPreviewPdfUrl('')
    }

    // Affiche la modale immédiatement avec les infos de la liste, puis enrichit
    // avec le détail complet (items, snapshots, HT/TVA/TTC) dès que possible.
    setPreviewInvoice(invoice)
    setPreviewDetailLoading(true)

    try {
      const detail = await invoicesApi.getAdminById(invoice.id)
      setPreviewInvoice(detail as unknown as Invoice)
    } catch (error) {
      console.warn('[invoices] Détail facture indisponible, repli sur la liste :', error)
    } finally {
      setPreviewDetailLoading(false)
    }

    try {
      const pdfBlob = await invoicesApi.downloadPdf(invoice.id)
      const pdfUrl = URL.createObjectURL(pdfBlob)
      setPreviewPdfUrl(pdfUrl)
    } catch (error) {
      console.error('[invoices] Aperçu PDF serveur échoué :', error)
      pushToast({
        type: 'error',
        title: 'Aperçu PDF indisponible',
        message:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : 'Le serveur n\'a pas renvoyé le PDF de la facture.',
      })
    }
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

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const handleSort = (key: string) => {
    setCurrentPage(1)
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
                : invoice.status === 'refunded'
                  ? 'default'
                  : 'error'
          }
        >
          {invoice.status === 'paid' && 'Payee'}
          {invoice.status === 'pending' && 'En attente'}
          {invoice.status === 'cancelled' && 'Annulee'}
          {invoice.status === 'refunded' && 'Remboursee'}
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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-dark md:text-3xl">
            Gestion des Factures
          </h1>
          <p className="mt-1 text-gray-600">Gerez les factures et les avoirs</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            fetcher={() => invoicesApi.exportAdmin({ format: 'csv' })}
            filename={`factures-${new Date().toISOString().slice(0, 10)}.csv`}
            label="Exporter CSV"
          />
          <ExportButton
            fetcher={() => invoicesApi.exportAdmin({ format: 'xlsx' })}
            filename={`factures-${new Date().toISOString().slice(0, 10)}.xlsx`}
            label="Exporter XLSX"
          />
        </div>
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
            Factures ({totalItems})
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
            Avoirs ({creditNotesTotal})
          </button>
        </nav>
      </div>

      {activeTab === 'invoices' ? (
        <>
          <div className="card space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchBar
                value={searchInput}
                onChange={setSearchInput}
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
                <option value="refunded">Remboursee</option>
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
                data={invoices}
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
                totalItems={totalItems}
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
            title="Apercu facture PDF"
            size="xl"
          >
            {previewInvoice && (
              <InvoicePreviewContent
                invoice={previewInvoice}
                pdfUrl={previewPdfUrl}
                detailLoading={previewDetailLoading}
                onClose={closeInvoicePreview}
                onDownload={() => void handleSimulatedPdfDownload(previewInvoice)}
              />
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
                      <option value="refunded">Remboursee</option>
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
                  {creditNotesTotal} avoir{creditNotesTotal > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            {creditNotesLoading ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
                Chargement des avoirs…
              </div>
            ) : creditNotes.length === 0 ? (
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
                      <p className="text-sm text-gray-600">
                        Facture source {creditNote.invoiceNumber}
                        {creditNote.customerFullName ? ` · ${creditNote.customerFullName}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {creditNote.reason || '—'} · {formatDate(creditNote.createdAt)}
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
          {creditNotesTotal > pageSize ? (
            <Pagination
              currentPage={creditNotesPage}
              totalPages={Math.max(1, Math.ceil(creditNotesTotal / pageSize))}
              pageSize={pageSize}
              totalItems={creditNotesTotal}
              onPageChange={setCreditNotesPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setCreditNotesPage(1)
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
