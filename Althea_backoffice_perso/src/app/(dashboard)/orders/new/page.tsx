'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import FormField from '@/components/ui/form/FormField'
import FormActions from '@/components/ui/form/FormActions'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, invoicesApi, ordersApi, usersApi } from '@/lib/api'
import type { Address, PaymentMethod } from '@/lib/api/types'

const SHIPPING_METHODS: Array<{ value: 'STANDARD' | 'EXPRESS' | 'PICKUP'; label: string }> = [
  { value: 'STANDARD', label: 'Livraison standard' },
  { value: 'EXPRESS', label: 'Livraison express' },
  { value: 'PICKUP', label: 'Retrait en magasin' },
]

export default function NewOrderPage() {
  const router = useRouter()
  const { pushToast } = useToast()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('')
  const [shippingMethod, setShippingMethod] = useState<'STANDARD' | 'EXPRESS' | 'PICKUP'>('STANDARD')
  const [couponCode, setCouponCode] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setIsLoading(true)

      try {
        const [loadedAddresses, loadedMethods] = await Promise.all([
          usersApi.getAddresses(),
          usersApi.getPaymentMethods(),
        ])

        if (!isMounted) {
          return
        }

        setAddresses(loadedAddresses)
        const defaultAddress = loadedAddresses.find((address) => address.isDefault) ?? loadedAddresses[0]
        setSelectedAddressId(defaultAddress?.id ?? '')

        setPaymentMethods(loadedMethods)
        const defaultMethod = loadedMethods.find((method) => method.isDefault) ?? loadedMethods[0]
        setSelectedPaymentMethodId(defaultMethod?.id ?? '')
      } catch (error) {
        if (!isMounted) {
          return
        }

        setAddresses([])
        setSelectedAddressId('')
        setPaymentMethods([])
        setSelectedPaymentMethodId('')
        pushToast({
          type: 'error',
          title: 'Chargement impossible',
          message:
            error instanceof ApiError
              ? error.message
              : 'Impossible de charger les adresses et moyens de paiement du compte connecté.',
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [pushToast])

  const handleCreateOrder = async () => {
    if (!selectedAddressId || !selectedPaymentMethodId) {
      pushToast({
        type: 'error',
        title: 'Champs requis',
        message: 'Une adresse de livraison et un moyen de paiement sont requis.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const createdOrder = await ordersApi.createFromCheckout({
        shippingAddressId: selectedAddressId,
        paymentMethodId: selectedPaymentMethodId,
        shippingMethod,
        couponCode: couponCode.trim() || undefined,
      })

      pushToast({
        type: 'success',
        title: 'Commande créée',
        message: `Commande ${createdOrder.orderNumber ?? ''} créée avec succès.`,
      })

      try {
        const invoice = await invoicesApi.ensureInvoiceForOrder(
          createdOrder.id,
          createdOrder.orderNumber,
        )
        if (invoice) {
          pushToast({
            type: 'success',
            title: 'Facture liée',
            message: `Facture ${invoice.invoiceNumber} associée à la commande.`,
          })
        }
      } catch (invoiceError) {
        console.warn('[orders/new] ensureInvoiceForOrder failed:', invoiceError)
      }

      router.push('/orders')
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Création impossible',
        message:
          error instanceof ApiError
            ? error.message
            : 'La commande n\'a pas pu être créée. Vérifie le panier du compte connecté.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Commandes"
        title="Nouvelle commande"
        description="Crée une commande à partir du panier du compte actuellement connecté."
      />

      <div className="app-panel space-y-5 p-6">
        <p className="text-sm text-gray-600">
          Cette action utilise le flux <strong>/orders/checkout</strong>. Le panier doit contenir au moins un article.
        </p>

        <FormField
          label="Adresse de livraison"
          htmlFor="shippingAddressId"
          hint="Requis. Choisit une adresse enregistrée sur le compte connecté."
        >
          <select
            id="shippingAddressId"
            value={selectedAddressId}
            onChange={(event) => setSelectedAddressId(event.target.value)}
            disabled={isLoading || isSubmitting}
            className="input-base"
          >
            <option value="">
              {isLoading
                ? 'Chargement des adresses...'
                : addresses.length > 0
                  ? 'Sélectionner une adresse'
                  : 'Aucune adresse disponible'}
            </option>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {`${address.firstName} ${address.lastName} - ${address.address1}, ${address.postalCode} ${address.city}`}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Moyen de paiement"
          htmlFor="paymentMethodId"
          hint="Requis. Choisit un moyen de paiement enregistré sur le compte connecté."
        >
          <select
            id="paymentMethodId"
            value={selectedPaymentMethodId}
            onChange={(event) => setSelectedPaymentMethodId(event.target.value)}
            disabled={isLoading || isSubmitting}
            className="input-base"
          >
            <option value="">
              {isLoading
                ? 'Chargement des moyens de paiement...'
                : paymentMethods.length > 0
                  ? 'Sélectionner un moyen de paiement'
                  : 'Aucun moyen de paiement disponible'}
            </option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {`${method.brand} •••• ${method.last4} (${method.expMonth}/${method.expYear})`}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Mode de livraison" htmlFor="shippingMethod">
          <select
            id="shippingMethod"
            value={shippingMethod}
            onChange={(event) => setShippingMethod(event.target.value as 'STANDARD' | 'EXPRESS' | 'PICKUP')}
            disabled={isSubmitting}
            className="input-base"
          >
            {SHIPPING_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Code promo (optionnel)" htmlFor="couponCode">
          <input
            id="couponCode"
            type="text"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            disabled={isSubmitting}
            className="input-base"
            placeholder="Ex : BIENVENUE10"
          />
        </FormField>

        <FormActions>
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-dark transition-colors hover:bg-primary-light/40"
          >
            Annuler
          </Link>
          <button
            type="button"
            onClick={handleCreateOrder}
            disabled={isSubmitting || !selectedAddressId || !selectedPaymentMethodId}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Création...' : 'Créer la commande'}
          </button>
        </FormActions>
      </div>
    </div>
  )
}
