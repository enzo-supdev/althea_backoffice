'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Bell, Building2, CheckCircle2, Clock3, GripVertical, Plus, RefreshCcw, Shield, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import PageHeader from '@/components/layout/PageHeader'
import FormActions from '@/components/ui/form/FormActions'
import FormField from '@/components/ui/form/FormField'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { ApiError, authApi, homepageApi, mediaApi } from '@/lib/api'
import { HomepageCarouselSlide } from '@/lib/api/types'
import { axiosInstance } from '@/lib/api/axiosInstance'
import { TWO_FACTOR_PENDING_KEY, TWO_FACTOR_VERIFIED_AT_KEY } from '@/lib/security'

type HomepageSlide = {
  id: string
  imageRef: string
  imageUrl: string
  title: string
  redirectUrl: string
  textContent: string
  displayOrder: number
  isMainImage: boolean
  isActive: boolean
}

const settingsSchema = z.object({
  companyName: z.string().trim().min(1, 'Le nom de la societe est requis.'),
  supportEmail: z.string().trim().email('Adresse e-mail valide requise.'),
  supportPhone: z.string().trim().min(1, 'Le telephone support est requis.'),
  billingAddress: z.string().trim().min(1, 'L adresse de facturation est requise.'),
  notifications: z.object({
    orderAlerts: z.boolean(),
    stockAlerts: z.boolean(),
    supportAlerts: z.boolean(),
  }),
  security: z.object({
    loginAlerts: z.boolean(),
    sessionTimeoutMinutes: z.number().int().min(5).max(180),
  }),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est requis.'),
    newPassword: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caracteres.'),
    confirmPassword: z.string().min(1, 'La confirmation est requise.'),
  })
  .superRefine((values, context) => {
    if (values.newPassword !== values.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'La confirmation du mot de passe ne correspond pas.',
      })
    }
  })

type SettingsForm = z.infer<typeof settingsSchema>
type PasswordForm = z.infer<typeof passwordSchema>

const STORAGE_KEY = 'althea_backoffice_settings_v1'

const DEFAULT_VALUES: SettingsForm = {
  companyName: 'Althea Systems',
  supportEmail: 'support@althea-systems.com',
  supportPhone: '+33 1 23 45 67 89',
  billingAddress: '12 avenue de la Sante, 75014 Paris',
  notifications: {
    orderAlerts: true,
    stockAlerts: true,
    supportAlerts: true,
  },
  security: {
    loginAlerts: true,
    sessionTimeoutMinutes: 30,
  },
}

function loadStoredSettings(): SettingsForm {
  if (typeof window === 'undefined') {
    return DEFAULT_VALUES
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return DEFAULT_VALUES
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SettingsForm>
    return {
      ...DEFAULT_VALUES,
      ...parsed,
      notifications: {
        ...DEFAULT_VALUES.notifications,
        ...parsed.notifications,
      },
      security: {
        ...DEFAULT_VALUES.security,
        ...parsed.security,
      },
    }
  } catch {
    return DEFAULT_VALUES
  }
}

const MEDIA_BASE_URL = (axiosInstance.defaults.baseURL ?? '').replace(/\/api\/v1\/?$/, '')

const resolveMediaUrl = (ref: string | null | undefined): string => {
  if (!ref) {
    return ''
  }

  if (/^https?:\/\//i.test(ref)) {
    return ref
  }

  if (!MEDIA_BASE_URL) {
    return ref
  }

  return `${MEDIA_BASE_URL}/api/v1/media/${ref}`
}

const mapSlideFromApi = (slide: HomepageCarouselSlide): HomepageSlide => ({
  id: slide.id,
  imageRef: slide.imageRef ?? '',
  imageUrl: resolveMediaUrl(slide.imageRef),
  title: slide.title ?? '',
  redirectUrl: slide.redirectUrl ?? '',
  textContent: slide.textContent ?? '',
  displayOrder: slide.displayOrder ?? 0,
  isMainImage: Boolean(slide.isMainImage),
  isActive: Boolean(slide.isActive),
})

export default function SettingsPage() {
  const { pushToast } = useToast()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorMethod, setTwoFactorMethod] = useState<'totp' | 'hotp' | null>(null)
  const [twoFactorProvisioningUri, setTwoFactorProvisioningUri] = useState('')
  const [twoFactorRecoveryCodesCount, setTwoFactorRecoveryCodesCount] = useState<number | null>(null)
  const [isUpdating2fa, setIsUpdating2fa] = useState(false)
  const [slides, setSlides] = useState<HomepageSlide[]>([])
  const [draggingSlideId, setDraggingSlideId] = useState<string | null>(null)
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null)
  const [isLoadingCarousel, setIsLoadingCarousel] = useState(true)
  const [isSavingSlide, setIsSavingSlide] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  })

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isChangingPassword },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onSubmit',
  })

  useEffect(() => {
    const stored = loadStoredSettings()
    reset(stored)

    void authApi.getTwoFactorStatus()
      .then((status) => {
        setTwoFactorEnabled(status.enabled)
        setTwoFactorMethod(status.method ?? null)
        setTwoFactorProvisioningUri(status.provisioningUri ?? '')
        setTwoFactorRecoveryCodesCount(status.recoveryCodesCount ?? null)
      })
      .catch(() => {
        setTwoFactorEnabled(false)
        setTwoFactorMethod(null)
        setTwoFactorProvisioningUri('')
        setTwoFactorRecoveryCodesCount(null)
      })

    setIsLoadingCarousel(true)
    void homepageApi.getCarousel()
      .then((loadedSlides) => {
        const mapped = loadedSlides
          .map(mapSlideFromApi)
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .slice(0, 3)

        setSlides(mapped)
        if (mapped.length > 0) {
          setEditingSlideId(mapped[0].id)
        }
      })
      .catch((error) => {
        setSlides([])
        pushToast({
          type: 'error',
          title: 'Chargement carrousel impossible',
          message: error instanceof ApiError ? error.message : 'Impossible de charger les slides depuis l API.',
        })
      })
      .finally(() => {
        setIsLoadingCarousel(false)
      })

    if (typeof window !== 'undefined') {
      const savedAt = window.localStorage.getItem(`${STORAGE_KEY}_saved_at`)
      setLastSavedAt(savedAt)
    }
  }, [pushToast, reset])

  const updatedLabel = useMemo(() => {
    if (!lastSavedAt) return 'Jamais sauvegarde'
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastSavedAt))
  }, [lastSavedAt])

  const onSave = async (values: SettingsForm) => {
    try {
      const now = new Date().toISOString()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
      window.localStorage.setItem(`${STORAGE_KEY}_saved_at`, now)
      setLastSavedAt(now)
      reset(values)

      pushToast({
        type: 'success',
        title: 'Parametres backoffice sauvegardes',
        message: 'La configuration admin a ete enregistree localement.',
      })
    } catch {
      pushToast({
        type: 'error',
        title: 'Sauvegarde impossible',
        message: 'La configuration n a pas pu etre enregistree.',
      })
    }
  }

  const onResetDefaults = () => {
    reset(DEFAULT_VALUES)
    pushToast({
      type: 'info',
      title: 'Valeurs par defaut restaurees',
      message: 'Les parametres backoffice ont ete remis aux valeurs par defaut.',
    })
  }

  const onChangePassword = handleSubmitPassword(async (values) => {
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })

      resetPassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setIsPasswordModalOpen(false)

      pushToast({
        type: 'success',
        title: 'Mot de passe mis a jour',
        message: 'Le mot de passe administrateur a ete modifie.',
      })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Mise a jour impossible',
        message: error instanceof ApiError ? error.message : 'La modification du mot de passe a echoue.',
      })
    }
  })

  const handleToggle2FA = () => {
    setIsUpdating2fa(true)

    const action = twoFactorEnabled
      ? authApi.disableTwoFactor()
      : authApi.enableTwoFactor()

    void action
      .then((result) => {
        if (twoFactorEnabled) {
          setTwoFactorEnabled(false)
          setTwoFactorMethod(null)
          setTwoFactorProvisioningUri('')
          setTwoFactorRecoveryCodesCount(null)
          window.localStorage.removeItem(TWO_FACTOR_PENDING_KEY)
          window.localStorage.removeItem(TWO_FACTOR_VERIFIED_AT_KEY)

          pushToast({
            type: 'success',
            title: '2FA desactivee',
            message: 'La verification forte est desactivee cote serveur.',
          })
          return
        }

        const status = result as {
          enabled: boolean
          method?: 'totp' | 'hotp'
          provisioningUri?: string
          recoveryCodesCount?: number
        }

        setTwoFactorEnabled(Boolean(status.enabled))
        setTwoFactorMethod(status.method ?? 'totp')
        setTwoFactorProvisioningUri(status.provisioningUri ?? '')
        setTwoFactorRecoveryCodesCount(status.recoveryCodesCount ?? null)

        pushToast({
          type: 'success',
          title: '2FA activee',
          message: 'Provisionnez le facteur OTP dans votre application d authentification.',
        })
      })
      .catch((error) => {
        pushToast({
          type: 'error',
          title: 'Mise a jour 2FA impossible',
          message: error instanceof ApiError ? error.message : 'La configuration 2FA serveur a echoue.',
        })
      })
      .finally(() => {
        setIsUpdating2fa(false)
      })
  }

  const handleAddSlide = () => {
    if (slides.length >= 3) {
      pushToast({ type: 'info', title: 'Limite atteinte', message: 'Le carrousel est limite a 3 slides.' })
      return
    }

    setIsSavingSlide(true)
    void homepageApi.createCarouselSlide({
      imageRef: null,
      title: `Slide ${slides.length + 1}`,
      textContent: 'Nouveau slide',
      redirectUrl: null,
      displayOrder: slides.length,
      isMainImage: false,
      isActive: true,
    })
      .then((created) => {
        const createdSlide = mapSlideFromApi(created)
        setSlides((prev) => [...prev, createdSlide].sort((left, right) => left.displayOrder - right.displayOrder))
        setEditingSlideId(createdSlide.id)
        pushToast({ type: 'success', title: 'Slide ajoute', message: 'Le slide a ete cree.' })
      })
      .catch((error) => {
        pushToast({
          type: 'error',
          title: 'Creation slide impossible',
          message: error instanceof ApiError ? error.message : 'La creation du slide a echoue.',
        })
      })
      .finally(() => {
        setIsSavingSlide(false)
      })
  }

  const handleDeleteSlide = (slideId: string) => {
    setIsSavingSlide(true)
    void homepageApi.deleteCarouselSlide(slideId)
      .then(() => {
        setSlides((prev) => prev.filter((slide) => slide.id !== slideId))
        if (editingSlideId === slideId) {
          setEditingSlideId(null)
        }
        pushToast({ type: 'success', title: 'Slide supprime', message: 'Le slide a ete retire du carrousel.' })
      })
      .catch((error) => {
        pushToast({
          type: 'error',
          title: 'Suppression slide impossible',
          message: error instanceof ApiError ? error.message : 'La suppression du slide a echoue.',
        })
      })
      .finally(() => {
        setIsSavingSlide(false)
      })
  }

  const handleSlideImageUpload = (slideId: string, file: File) => {
    setIsSavingSlide(true)
    void mediaApi.upload(file)
      .then((uploaded) => homepageApi.updateCarouselSlide(slideId, { imageRef: uploaded.ref }))
      .then((updated) => {
        const mapped = mapSlideFromApi(updated)
        setSlides((prev) => prev.map((slide) => (slide.id === slideId ? mapped : slide)))
        pushToast({ type: 'success', title: 'Image mise a jour', message: 'Image du slide envoyee avec succes.' })
      })
      .catch((error) => {
        pushToast({
          type: 'error',
          title: 'Upload image impossible',
          message: error instanceof ApiError ? error.message : 'Le televersement de l image a echoue.',
        })
      })
      .finally(() => {
        setIsSavingSlide(false)
      })
  }

  const handlePersistSlide = (slideId: string) => {
    const target = slides.find((slide) => slide.id === slideId)
    if (!target) return

    setIsSavingSlide(true)
    void homepageApi.updateCarouselSlide(slideId, {
      title: target.title || null,
      textContent: target.textContent || null,
      redirectUrl: target.redirectUrl || null,
      imageRef: target.imageRef || null,
      displayOrder: target.displayOrder,
      isMainImage: target.isMainImage,
      isActive: target.isActive,
    })
      .then((updated) => {
        const mapped = mapSlideFromApi(updated)
        setSlides((prev) => prev.map((slide) => (slide.id === slideId ? mapped : slide)))
        pushToast({ type: 'success', title: 'Slide enregistre', message: 'Le slide a ete sauvegarde.' })
      })
      .catch((error) => {
        pushToast({
          type: 'error',
          title: 'Sauvegarde slide impossible',
          message: error instanceof ApiError ? error.message : 'La sauvegarde du slide a echoue.',
        })
      })
      .finally(() => {
        setIsSavingSlide(false)
      })
  }

  const handleSlideDrop = (targetId: string) => {
    if (!draggingSlideId || draggingSlideId === targetId) return
    const next = [...slides]
    const sourceIndex = next.findIndex((slide) => slide.id === draggingSlideId)
    const targetIndex = next.findIndex((slide) => slide.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)
    const reordered = next.map((slide, index) => ({ ...slide, displayOrder: index }))
    setSlides(reordered)
    setDraggingSlideId(null)

    setIsSavingSlide(true)
    void Promise.all(
      reordered.map((slide) => homepageApi.updateCarouselSlide(slide.id, { displayOrder: slide.displayOrder }))
    )
      .catch((error) => {
        pushToast({
          type: 'error',
          title: 'Reorganisation impossible',
          message: error instanceof ApiError ? error.message : 'L ordre des slides n a pas pu etre sauvegarde.',
        })
      })
      .finally(() => {
        setIsSavingSlide(false)
      })
  }

  const activeSlide = slides.find((slide) => slide.id === editingSlideId) ?? null

  const applyTextCommand = (command: 'bold' | 'italic' | 'foreColor' | 'createLink', value?: string) => {
    if (typeof document === 'undefined') return
    if (command === 'createLink') {
      const link = window.prompt('URL du lien')
      if (link) {
        document.execCommand(command, false, link)
      }
      return
    }
    document.execCommand(command, false, value)
  }

  const notifications = watch('notifications')
  const security = watch('security')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Parametres Backoffice"
        description="Configurez les parametres generaux de l espace administrateur (entreprise, alertes, securite)."
        actions={(
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-gray-200">
              <Clock3 className="h-4 w-4 text-primary" />
              Derniere sauvegarde: {updatedLabel}
            </span>
            {isDirty && (
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Modifications non sauvegardees
              </span>
            )}
          </div>
        )}
      />

      <form onSubmit={handleSubmit(onSave)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="app-panel p-5 md:p-6 xl:col-span-2">
            <div className="flex items-start gap-3">
              <Building2 className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-heading font-semibold text-dark">Informations entreprise</h2>
                <p className="mt-1 text-sm text-gray-500">Donnees utilisees pour la gestion backoffice et la communication support.</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Nom de la societe" htmlFor="companyName" error={errors.companyName?.message}>
                <input
                  id="companyName"
                  type="text"
                  {...register('companyName')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </FormField>

              <FormField label="E-mail support" htmlFor="supportEmail" error={errors.supportEmail?.message}>
                <input
                  id="supportEmail"
                  type="email"
                  {...register('supportEmail')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </FormField>

              <FormField label="Telephone support" htmlFor="supportPhone" error={errors.supportPhone?.message}>
                <input
                  id="supportPhone"
                  type="text"
                  {...register('supportPhone')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </FormField>

              <FormField label="Adresse de facturation" htmlFor="billingAddress" error={errors.billingAddress?.message}>
                <input
                  id="billingAddress"
                  type="text"
                  {...register('billingAddress')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </FormField>
            </div>
          </section>

          <section className="app-panel p-5 md:p-6">
            <div className="flex items-start gap-3">
              <Shield className="mt-1 h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-heading font-semibold text-dark">Securite admin</h2>
                <p className="mt-1 text-sm text-gray-500">Parametres de securite pour les sessions administrateur.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm">
                <span>Alertes de connexion</span>
                <input type="checkbox" className="h-4 w-4" {...register('security.loginAlerts')} />
              </label>

              <FormField
                label="Timeout session (minutes)"
                htmlFor="sessionTimeoutMinutes"
                error={errors.security?.sessionTimeoutMinutes?.message}
              >
                <input
                  id="sessionTimeoutMinutes"
                  type="number"
                  min={5}
                  max={180}
                  {...register('security.sessionTimeoutMinutes', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </FormField>

              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-left text-sm transition-colors hover:border-primary hover:bg-primary-light"
              >
                Changer le mot de passe administrateur
              </button>
            </div>
          </section>
        </div>

        <section className="app-panel p-5 md:p-6">
          <div className="flex items-start gap-3">
            <Bell className="mt-1 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-heading font-semibold text-dark">Notifications backoffice</h2>
              <p className="mt-1 text-sm text-gray-500">Activez les alertes metier pour les equipes internes.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm">
              <span>Alertes commandes</span>
              <input type="checkbox" className="h-4 w-4" {...register('notifications.orderAlerts')} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm">
              <span>Alertes stock</span>
              <input type="checkbox" className="h-4 w-4" {...register('notifications.stockAlerts')} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm">
              <span>Alertes support</span>
              <input type="checkbox" className="h-4 w-4" {...register('notifications.supportAlerts')} />
            </label>
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <p>Etat actuel: commandes {notifications.orderAlerts ? 'ON' : 'OFF'}, stock {notifications.stockAlerts ? 'ON' : 'OFF'}, support {notifications.supportAlerts ? 'ON' : 'OFF'}.</p>
            <p className="mt-1">Securite: alertes de connexion {security.loginAlerts ? 'ON' : 'OFF'}, timeout {security.sessionTimeoutMinutes} min.</p>
          </div>
        </section>

        <section className="app-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-heading font-semibold text-dark">Authentification forte (2FA)</h2>
              <p className="mt-1 text-sm text-gray-500">Active une verification OTP serveur (TOTP/HOTP) pour les admins.</p>
            </div>
            <button
              type="button"
              onClick={handleToggle2FA}
              disabled={isUpdating2fa}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${twoFactorEnabled ? 'bg-status-error hover:bg-status-error/90' : 'bg-status-success hover:bg-status-success/90'}`}
            >
              {isUpdating2fa ? 'Mise a jour...' : twoFactorEnabled ? 'Desactiver 2FA' : 'Activer 2FA'}
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
            <p>Etat: <strong>{twoFactorEnabled ? 'Active' : 'Inactive'}</strong></p>
            <p className="mt-1">Methode: <strong>{twoFactorMethod ? twoFactorMethod.toUpperCase() : 'Non configuree'}</strong></p>
            <p className="mt-1">URI de provisionning: <code>{twoFactorProvisioningUri || 'non disponible'}</code></p>
            <p className="mt-1">Codes de recuperation restants: <strong>{twoFactorRecoveryCodesCount ?? 'n/a'}</strong></p>
          </div>
        </section>

        <section className="app-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-heading font-semibold text-dark">Carrousel accueil</h2>
              <p className="mt-1 text-sm text-gray-500">3 slides max, image + lien + texte, lecture via /homepage/carousel et edition via /homepage/admin/carousel.</p>
            </div>
            <button
              type="button"
              onClick={handleAddSlide}
              disabled={isSavingSlide || isLoadingCarousel}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" /> Ajouter slide
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {isLoadingCarousel ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Chargement des slides...</p>
              ) : slides.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Aucun slide configure.</p>
              ) : (
                slides.map((slide, index) => (
                  <div
                    key={slide.id}
                    draggable
                    onDragStart={() => setDraggingSlideId(slide.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleSlideDrop(slide.id)}
                    onDragEnd={() => setDraggingSlideId(null)}
                    className={`rounded-lg border p-3 ${editingSlideId === slide.id ? 'border-primary bg-primary-light/20' : 'border-gray-200 bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => setEditingSlideId(slide.id)} className="text-left">
                        <p className="text-sm font-medium text-dark">{slide.title || `Slide ${index + 1}`}</p>
                        <p className="text-xs text-gray-500">{slide.redirectUrl || 'Aucun lien'}</p>
                      </button>
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <button
                          type="button"
                          onClick={() => handleDeleteSlide(slide.id)}
                          className="rounded p-1 text-gray-500 transition-colors hover:text-status-error"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              {!activeSlide ? (
                <p className="text-sm text-gray-500">Selectionnez un slide pour le modifier.</p>
              ) : (
                <div className="space-y-3">
                  <FormField label="Titre" htmlFor="slide-title">
                    <input
                      id="slide-title"
                      type="text"
                      value={activeSlide.title}
                      onChange={(event) => setSlides((prev) => prev.map((slide) => (slide.id === activeSlide.id ? { ...slide, title: event.target.value } : slide)))}
                      className="input-base"
                    />
                  </FormField>

                  <FormField label="Lien de redirection" htmlFor="slide-link">
                    <input
                      id="slide-link"
                      type="url"
                      value={activeSlide.redirectUrl}
                      onChange={(event) => setSlides((prev) => prev.map((slide) => (slide.id === activeSlide.id ? { ...slide, redirectUrl: event.target.value } : slide)))}
                      className="input-base"
                    />
                  </FormField>

                  <FormField label="Image du slide" htmlFor="slide-image-url">
                    <input
                      id="slide-image-url"
                      type="text"
                      value={activeSlide.imageRef}
                      onChange={(event) => setSlides((prev) => prev.map((slide) => (slide.id === activeSlide.id ? { ...slide, imageRef: event.target.value, imageUrl: resolveMediaUrl(event.target.value) } : slide)))}
                      className="input-base"
                    />
                  </FormField>

                  {activeSlide.imageUrl && (
                    <div className="relative h-28 w-full overflow-hidden rounded-lg">
                      <Image src={activeSlide.imageUrl} alt={activeSlide.title || 'Slide'} fill className="object-cover" unoptimized />
                    </div>
                  )}

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        handleSlideImageUpload(activeSlide.id, file)
                      }
                    }}
                    className="text-sm"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => applyTextCommand('bold')} className="rounded border border-gray-300 px-2 py-1 text-xs">Gras</button>
                    <button type="button" onClick={() => applyTextCommand('italic')} className="rounded border border-gray-300 px-2 py-1 text-xs">Italique</button>
                    <button type="button" onClick={() => applyTextCommand('createLink')} className="rounded border border-gray-300 px-2 py-1 text-xs">Lien</button>
                    <button type="button" onClick={() => applyTextCommand('foreColor', '#00a8b5')} className="rounded border border-gray-300 px-2 py-1 text-xs">Couleur</button>
                  </div>

                  <div
                    className="min-h-[120px] rounded-lg border border-gray-300 p-3 text-sm"
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: activeSlide.textContent }}
                    onInput={(event) => {
                      const html = (event.target as HTMLDivElement).innerHTML
                      setSlides((prev) => prev.map((slide) => (slide.id === activeSlide.id ? { ...slide, textContent: html } : slide)))
                    }}
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handlePersistSlide(activeSlide.id)}
                      disabled={isSavingSlide}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingSlide ? 'Enregistrement...' : 'Enregistrer le slide'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <FormActions>
          <button
            type="button"
            onClick={onResetDefaults}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
          >
            <RefreshCcw className="h-4 w-4" />
            Restaurer valeurs par defaut
          </button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            Sauvegarder la configuration
          </button>
        </FormActions>
      </form>

      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false)
          resetPassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
        }}
        title="Modifier le mot de passe administrateur"
        size="sm"
      >
        <form onSubmit={onChangePassword} className="space-y-4">
          <FormField label="Mot de passe actuel" htmlFor="current-password" error={passwordErrors.currentPassword?.message}>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              {...registerPassword('currentPassword')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>

          <FormField label="Nouveau mot de passe" htmlFor="new-password" error={passwordErrors.newPassword?.message}>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              {...registerPassword('newPassword')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>

          <FormField label="Confirmation" htmlFor="confirm-password" error={passwordErrors.confirmPassword?.message}>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              {...registerPassword('confirmPassword')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsPasswordModalOpen(false)
                resetPassword({ currentPassword: '', newPassword: '', confirmPassword: '' })
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={isChangingPassword}>
              {isChangingPassword ? 'Mise a jour...' : 'Mettre a jour'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
