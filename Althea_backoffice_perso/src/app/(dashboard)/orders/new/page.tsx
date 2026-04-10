'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/layout/PageHeader'
import FormField from '@/components/ui/form/FormField'
import FormActions from '@/components/ui/form/FormActions'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, ordersApi, usersApi } from '@/lib/api'
import type { Address } from '@/lib/api/types'

export default function NewOrderPage() {
  const router = useRouter()
  const { pushToast } = useToast()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadAddresses = async () => {
      setIsLoadingAddresses(true)

      try {
        const loadedAddresses = await usersApi.getAddresses()

        if (!isMounted) {
          return
        }

        setAddresses(loadedAddresses)
        const defaultAddress = loadedAddresses.find((address) => address.isDefault) ?? loadedAddresses[0]
        setSelectedAddressId(defaultAddress?.id ?? '')
      } catch (error) {
        if (!isMounted) {
          return
        }

        setAddresses([])
        setSelectedAddressId('')
        pushToast({
          type: 'error',
          title: 'Chargement des adresses impossible',
          message:
            error instanceof ApiError
              ? error.message
              : 'Impossible de charger les adresses du compte connecté.',
        })
      } finally {
        if (isMounted) {
          setIsLoadingAddresses(false)
        }
      }
    }

    void loadAddresses()

    return () => {
      isMounted = false
    }
  }, [pushToast])

  const handleCreateOrder = async () => {
    setIsSubmitting(true)

    try {
      const payload = selectedAddressId ? { addressId: selectedAddressId } : undefined
      const createdOrder = await ordersApi.createFromCheckout(payload)

      pushToast({
        type: 'success',
        title: 'Commande créée',
        message: `Commande ${createdOrder.orderNumber ?? ''} créée avec succès.`,
      })

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
          Cette action utilise le flux legacy <strong>/orders/checkout</strong>. Le panier doit contenir au moins un article.
        </p>

        <FormField
          label="Adresse de livraison (optionnelle)"
          htmlFor="addressId"
          hint="Si aucune adresse n'est choisie, l'API tentera de créer la commande avec l'adresse par défaut."
        >
          <select
            id="addressId"
            value={selectedAddressId}
            onChange={(event) => setSelectedAddressId(event.target.value)}
            disabled={isLoadingAddresses || isSubmitting}
            className="input-base"
          >
            <option value="">
              {isLoadingAddresses
                ? 'Chargement des adresses...'
                : addresses.length > 0
                  ? 'Utiliser l\'adresse par défaut du compte'
                  : 'Aucune adresse disponible'}
            </option>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {`${address.firstName} ${address.lastName} - ${address.address1}, ${address.postalCode} ${address.city}`}
              </option>
            ))}
          </select>
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
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Création...' : 'Créer la commande'}
          </button>
        </FormActions>
      </div>
    </div>
  )
}
