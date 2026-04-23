'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Bell, Building2, CheckCircle2, Clock3, GripVertical, Loader2, Plus, RefreshCcw, Shield, Trash2, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import PageHeader from '@/components/layout/PageHeader'
import FormActions from '@/components/ui/form/FormActions'
import FormField from '@/components/ui/form/FormField'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/ToastProvider'
import { useAuthContext } from '@/contexts/AuthContext'
import { ApiError, authApi, extractErrorMessage, homepageApi, mediaApi, resolveMediaUrl } from '@/lib/api'
import { HomepageCarouselSlide } from '@/lib/api/types'
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
  const { user, updateUser } = useAuthContext()
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.twoFaEnabled))
  const [isUpdating2fa, setIsUpdating2fa] = useState(false)
  const [twoFaSetup, setTwoFaSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null)
  const [twoFaSetupCode, setTwoFaSetupCode] = useState('')
  const [twoFaDisableOpen, setTwoFaDisableOpen] = useState(false)
  const [twoFaDisableCode, setTwoFaDisableCode] = useState('')
  const [twoFaDisablePassword, setTwoFaDisablePassword] = useState('')
  const [twoFaDisableError, setTwoFaDisableError] = useState<string | null>(null)
  const [twoFaSetupError, setTwoFaSetupError] = useState<string | null>(null)
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
    setTwoFactorEnabled(Boolean(user?.twoFaEnabled))
  }, [user?.twoFaEnabled])

  useEffect(() => {
    const stored = loadStoredSettings()
    reset(stored)

    setIsLoadingCarousel(true)
    void homepageApi.getAdminCarousel()
      .then((loadedSlides) => {
        const mapped = loadedSlides
          .map(mapSlideFromApi)
          .sort((left, right) => left.displayOrder - right.displayOrder)

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
          message: extractErrorMessage(error, 'Impossible de charger les slides depuis l\'API.'),
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

  const handleStartTwoFaSetup = async () => {
    setIsUpdating2fa(true)
    setTwoFaSetupError(null)
    setTwoFaSetupCode('')
    try {
      const setup = await authApi.setupTwoFa()
      setTwoFaSetup(setup)
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Initialisation 2FA impossible',
        message: error instanceof ApiError ? error.message : extractErrorMessage(error, 'Impossible de générer le QR code.'),
      })
    } finally {
      setIsUpdating2fa(false)
    }
  }

  const handleCloseTwoFaSetup = () => {
    setTwoFaSetup(null)
    setTwoFaSetupCode('')
    setTwoFaSetupError(null)
  }

  const handleConfirmTwoFa = async () => {
    if (twoFaSetupCode.trim().length !== 6) {
      setTwoFaSetupError('Code à 6 chiffres requis.')
      return
    }

    setIsUpdating2fa(true)
    setTwoFaSetupError(null)
    try {
      await authApi.confirmTwoFa({ code: twoFaSetupCode.trim() })
      setTwoFactorEnabled(true)
      updateUser((prev) => ({ ...prev, twoFaEnabled: true }))
      handleCloseTwoFaSetup()
      pushToast({
        type: 'success',
        title: '2FA activée',
        message: 'Les prochains logins demanderont un code TOTP.',
      })
    } catch (error) {
      setTwoFaSetupError(
        error instanceof ApiError ? error.message : extractErrorMessage(error, 'Code incorrect, réessayez.'),
      )
    } finally {
      setIsUpdating2fa(false)
    }
  }

  const handleOpenTwoFaDisable = () => {
    setTwoFaDisableOpen(true)
    setTwoFaDisableCode('')
    setTwoFaDisablePassword('')
    setTwoFaDisableError(null)
  }

  const handleCloseTwoFaDisable = () => {
    setTwoFaDisableOpen(false)
    setTwoFaDisableCode('')
    setTwoFaDisablePassword('')
    setTwoFaDisableError(null)
  }

  const handleConfirmTwoFaDisable = async () => {
    if (twoFaDisableCode.trim().length !== 6) {
      setTwoFaDisableError('Code à 6 chiffres requis.')
      return
    }
    if (!twoFaDisablePassword) {
      setTwoFaDisableError('Mot de passe requis.')
      return
    }

    setIsUpdating2fa(true)
    setTwoFaDisableError(null)
    try {
      await authApi.disableTwoFa({
        code: twoFaDisableCode.trim(),
        password: twoFaDisablePassword,
      })
      setTwoFactorEnabled(false)
      updateUser((prev) => ({ ...prev, twoFaEnabled: false }))
      window.localStorage.removeItem(TWO_FACTOR_PENDING_KEY)
      window.localStorage.removeItem(TWO_FACTOR_VERIFIED_AT_KEY)
      handleCloseTwoFaDisable()
      pushToast({
        type: 'success',
        title: '2FA désactivée',
        message: 'Le login redevient à une seule étape.',
      })
    } catch (error) {
      setTwoFaDisableError(
        error instanceof ApiError ? error.message : extractErrorMessage(error, 'Désactivation impossible.'),
      )
    } finally {
      setIsUpdating2fa(false)
    }
  }

  const newSlideFileInputRef = useRef<HTMLInputElement | null>(null)

  /**
   * Flux de création d'un slide :
   *   1. Upload de l'image via /media/upload → récupère la ref
   *   2. POST /homepage/admin/carousel avec { imageRef, ... }
   * L'imageRef est requise par la doc, impossible de créer un slide sans image.
   */
  const handleAddSlideFromFile = async (file: File) => {
    setIsSavingSlide(true)
    try {
      const uploaded = await mediaApi.upload(file)
      const created = await homepageApi.createCarouselSlide({
        imageRef: uploaded.ref,
        title: `Slide ${slides.length + 1}`,
        textContent: '',
        redirectUrl: null,
        displayOrder: slides.length,
        isMainImage: false,
        isActive: true,
      })
      const createdSlide = mapSlideFromApi(created)
      setSlides((prev) =>
        [...prev, createdSlide].sort((left, right) => left.displayOrder - right.displayOrder)
      )
      setEditingSlideId(createdSlide.id)
      pushToast({ type: 'success', title: 'Slide ajouté', message: 'Le slide a été créé.' })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Création slide impossible',
        message: extractErrorMessage(error, 'La création du slide a échoué.'),
      })
    } finally {
      setIsSavingSlide(false)
    }
  }

  const handleDeleteSlide = async (slideId: string) => {
    setIsSavingSlide(true)
    try {
      await homepageApi.deleteCarouselSlide(slideId)
      setSlides((prev) => prev.filter((slide) => slide.id !== slideId))
      if (editingSlideId === slideId) {
        setEditingSlideId(null)
      }
      pushToast({ type: 'success', title: 'Slide supprimé', message: 'Le slide a été retiré du carrousel.' })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Suppression slide impossible',
        message: extractErrorMessage(error, 'La suppression du slide a échoué.'),
      })
    } finally {
      setIsSavingSlide(false)
    }
  }

  /** Remplace l'image d'un slide existant. */
  const handleSlideImageUpload = async (slideId: string, file: File) => {
    setIsSavingSlide(true)
    try {
      const uploaded = await mediaApi.upload(file)
      const updated = await homepageApi.updateCarouselSlide(slideId, { imageRef: uploaded.ref })
      const mapped = mapSlideFromApi(updated)
      setSlides((prev) => prev.map((slide) => (slide.id === slideId ? mapped : slide)))
      pushToast({ type: 'success', title: 'Image mise à jour', message: 'L\'image du slide a été envoyée avec succès.' })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Upload image impossible',
        message: extractErrorMessage(error, 'Le téléversement de l\'image a échoué.'),
      })
    } finally {
      setIsSavingSlide(false)
    }
  }

  const handlePersistSlide = async (slideId: string) => {
    const target = slides.find((slide) => slide.id === slideId)
    if (!target) return

    if (!target.imageRef) {
      pushToast({
        type: 'error',
        title: 'Image requise',
        message: 'Un slide doit toujours avoir une image. Uploadez-en une avant d\'enregistrer.',
      })
      return
    }

    setIsSavingSlide(true)
    try {
      const updated = await homepageApi.updateCarouselSlide(slideId, {
        imageRef: target.imageRef,
        title: target.title || null,
        textContent: target.textContent || null,
        redirectUrl: target.redirectUrl || null,
        displayOrder: target.displayOrder,
        isMainImage: target.isMainImage,
        isActive: target.isActive,
      })
      const mapped = mapSlideFromApi(updated)
      setSlides((prev) => prev.map((slide) => (slide.id === slideId ? mapped : slide)))
      pushToast({ type: 'success', title: 'Slide enregistré', message: 'Le slide a été sauvegardé.' })
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Sauvegarde slide impossible',
        message: extractErrorMessage(error, 'La sauvegarde du slide a échoué.'),
      })
    } finally {
      setIsSavingSlide(false)
    }
  }

  /** Toggle rapide (is_active / is_main_image) sans passer par "Enregistrer". */
  const handleSlideFlagToggle = async (
    slideId: string,
    flag: 'isActive' | 'isMainImage',
    value: boolean,
  ) => {
    setSlides((prev) => prev.map((slide) => (slide.id === slideId ? { ...slide, [flag]: value } : slide)))

    try {
      const updated = await homepageApi.updateCarouselSlide(slideId, { [flag]: value })
      const mapped = mapSlideFromApi(updated)
      setSlides((prev) => prev.map((slide) => (slide.id === slideId ? mapped : slide)))
    } catch (error) {
      setSlides((prev) => prev.map((slide) => (slide.id === slideId ? { ...slide, [flag]: !value } : slide)))
      pushToast({
        type: 'error',
        title: 'Mise à jour impossible',
        message: extractErrorMessage(error, 'Le flag du slide n\'a pas pu être mis à jour.'),
      })
    }
  }

  const handleSlideDrop = async (targetId: string) => {
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
    try {
      await Promise.all(
        reordered.map((slide) => homepageApi.updateCarouselSlide(slide.id, { displayOrder: slide.displayOrder }))
      )
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Réorganisation impossible',
        message: extractErrorMessage(error, 'L\'ordre des slides n\'a pas pu être sauvegardé.'),
      })
    } finally {
      setIsSavingSlide(false)
    }
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
              <p className="mt-1 text-sm text-gray-500">
                Protocole TOTP (RFC 6238). Scannez le QR code avec Google Authenticator, Authy, 1Password, etc.
              </p>
            </div>
            {twoFactorEnabled ? (
              <button
                type="button"
                onClick={handleOpenTwoFaDisable}
                disabled={isUpdating2fa}
                className="rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-status-error/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Désactiver 2FA
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleStartTwoFaSetup()}
                disabled={isUpdating2fa}
                className="rounded-lg bg-status-success px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-status-success/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUpdating2fa && !twoFaSetup ? 'Chargement...' : 'Activer 2FA'}
              </button>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
            <p>État : <strong>{twoFactorEnabled ? 'Activée' : 'Inactive'}</strong></p>
            <p className="mt-1 text-gray-600">
              {twoFactorEnabled
                ? 'Un code TOTP vous sera demandé à chaque connexion.'
                : 'Activez le 2FA pour renforcer la sécurité de votre compte admin.'}
            </p>
          </div>
        </section>

        <section className="app-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-heading font-semibold text-dark">Carrousel accueil</h2>
              <p className="mt-1 text-sm text-gray-500">
                Lecture publique via <code>/homepage/carousel</code>, édition via <code>/homepage/admin/carousel</code>.
                Uploade une image pour créer un nouveau slide.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => newSlideFileInputRef.current?.click()}
                disabled={isSavingSlide || isLoadingCarousel}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSlide ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Ajouter un slide
              </button>
              <input
                ref={newSlideFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleAddSlideFromFile(file)
                  event.target.value = ''
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {isLoadingCarousel ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Chargement des slides...</p>
              ) : slides.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  Aucun slide configuré. Clique sur « Ajouter un slide » pour uploader une image et créer le premier.
                </p>
              ) : (
                slides.map((slide, index) => (
                  <div
                    key={slide.id}
                    draggable
                    onDragStart={() => setDraggingSlideId(slide.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => void handleSlideDrop(slide.id)}
                    onDragEnd={() => setDraggingSlideId(null)}
                    className={`flex gap-3 rounded-lg border p-3 transition-all ${
                      editingSlideId === slide.id ? 'border-primary bg-primary-light/20' : 'border-gray-200 bg-white'
                    } ${draggingSlideId === slide.id ? 'opacity-50' : ''}`}
                  >
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded bg-gray-100">
                      {slide.imageUrl ? (
                        <Image src={slide.imageUrl} alt={slide.title || `Slide ${index + 1}`} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">Aucune image</div>
                      )}
                    </div>

                    <button type="button" onClick={() => setEditingSlideId(slide.id)} className="flex-1 text-left">
                      <p className="text-sm font-medium text-dark">{slide.title || `Slide ${index + 1}`}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{slide.redirectUrl || 'Aucun lien'}</p>
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        <span className={`rounded px-1.5 py-0.5 ${slide.isActive ? 'bg-status-success/10 text-status-success' : 'bg-gray-100 text-gray-500'}`}>
                          {slide.isActive ? 'Actif' : 'Inactif'}
                        </span>
                        {slide.isMainImage && (
                          <span className="rounded bg-primary-light/40 px-1.5 py-0.5 text-primary">Principale</span>
                        )}
                        <span className="text-gray-400">#{slide.displayOrder + 1}</span>
                      </div>
                    </button>

                    <div className="flex flex-col items-center justify-between">
                      <GripVertical className="h-4 w-4 cursor-grab text-gray-400" />
                      <button
                        type="button"
                        onClick={() => void handleDeleteSlide(slide.id)}
                        disabled={isSavingSlide}
                        className="rounded p-1 text-gray-500 transition-colors hover:text-status-error disabled:cursor-not-allowed disabled:opacity-50"
                        title="Supprimer ce slide"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              {!activeSlide ? (
                <p className="text-sm text-gray-500">Sélectionnez un slide pour le modifier.</p>
              ) : (
                <div className="space-y-3">
                  {activeSlide.imageUrl ? (
                    <div className="relative h-40 w-full overflow-hidden rounded-lg bg-gray-100">
                      <Image src={activeSlide.imageUrl} alt={activeSlide.title || 'Slide'} fill className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                      Aucune image — uploade-en une ci-dessous.
                    </div>
                  )}

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors hover:bg-gray-50">
                    <Upload className="h-4 w-4" />
                    Remplacer l&apos;image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void handleSlideImageUpload(activeSlide.id, file)
                        event.target.value = ''
                      }}
                    />
                  </label>

                  <FormField label="Référence media (ref)" htmlFor="slide-image-ref" hint="Valeur retournée par POST /media/upload — nécessaire au backend.">
                    <input
                      id="slide-image-ref"
                      type="text"
                      value={activeSlide.imageRef}
                      onChange={(event) =>
                        setSlides((prev) =>
                          prev.map((slide) =>
                            slide.id === activeSlide.id
                              ? { ...slide, imageRef: event.target.value, imageUrl: resolveMediaUrl(event.target.value) }
                              : slide,
                          ),
                        )
                      }
                      className="input-base font-mono text-xs"
                      placeholder="ex. 1745234567890-uuid.jpg"
                    />
                  </FormField>

                  <FormField label="Titre" htmlFor="slide-title">
                    <input
                      id="slide-title"
                      type="text"
                      value={activeSlide.title}
                      onChange={(event) =>
                        setSlides((prev) =>
                          prev.map((slide) => (slide.id === activeSlide.id ? { ...slide, title: event.target.value } : slide)),
                        )
                      }
                      className="input-base"
                    />
                  </FormField>

                  <FormField label="Lien de redirection (URL)" htmlFor="slide-link">
                    <input
                      id="slide-link"
                      type="url"
                      value={activeSlide.redirectUrl}
                      onChange={(event) =>
                        setSlides((prev) =>
                          prev.map((slide) => (slide.id === activeSlide.id ? { ...slide, redirectUrl: event.target.value } : slide)),
                        )
                      }
                      className="input-base"
                      placeholder="https://..."
                    />
                  </FormField>

                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => applyTextCommand('bold')} className="rounded border border-gray-300 px-2 py-1 text-xs">Gras</button>
                    <button type="button" onClick={() => applyTextCommand('italic')} className="rounded border border-gray-300 px-2 py-1 text-xs">Italique</button>
                    <button type="button" onClick={() => applyTextCommand('createLink')} className="rounded border border-gray-300 px-2 py-1 text-xs">Lien</button>
                    <button type="button" onClick={() => applyTextCommand('foreColor', '#00a8b5')} className="rounded border border-gray-300 px-2 py-1 text-xs">Couleur</button>
                  </div>

                  <FormField label="Texte du slide (HTML)" htmlFor="slide-text-content">
                    <div
                      id="slide-text-content"
                      className="min-h-[120px] rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      contentEditable
                      suppressContentEditableWarning
                      dangerouslySetInnerHTML={{ __html: activeSlide.textContent }}
                      onInput={(event) => {
                        const html = (event.target as HTMLDivElement).innerHTML
                        setSlides((prev) =>
                          prev.map((slide) => (slide.id === activeSlide.id ? { ...slide, textContent: html } : slide)),
                        )
                      }}
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-2.5 text-sm">
                      <span>
                        <span className="font-medium">Actif</span>
                        <span className="block text-[11px] text-gray-500">Affiché publiquement</span>
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={activeSlide.isActive}
                        onChange={(event) => void handleSlideFlagToggle(activeSlide.id, 'isActive', event.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-2.5 text-sm">
                      <span>
                        <span className="font-medium">Image principale</span>
                        <span className="block text-[11px] text-gray-500">Hero de la homepage</span>
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={activeSlide.isMainImage}
                        onChange={(event) => void handleSlideFlagToggle(activeSlide.id, 'isMainImage', event.target.checked)}
                      />
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handlePersistSlide(activeSlide.id)}
                      disabled={isSavingSlide}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingSlide && <Loader2 className="h-4 w-4 animate-spin" />}
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

      <Modal
        isOpen={Boolean(twoFaSetup)}
        onClose={handleCloseTwoFaSetup}
        title="Activer l'authentification à deux facteurs"
        size="sm"
      >
        {twoFaSetup && (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
              <li>Scannez ce QR code avec votre app d&apos;authentification.</li>
              <li>Saisissez le code à 6 chiffres affiché par l&apos;app pour confirmer.</li>
            </ol>

            <div className="flex justify-center rounded-lg border border-gray-200 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={twoFaSetup.qrCodeDataUrl}
                alt="QR code 2FA"
                className="h-48 w-48"
              />
            </div>

            <div className="rounded-lg bg-gray-50 p-3 text-xs">
              <p className="font-medium text-gray-700">Saisie manuelle :</p>
              <code className="mt-1 block break-all font-mono text-gray-800">{twoFaSetup.secret}</code>
            </div>

            <FormField label="Code de vérification" htmlFor="two-fa-setup-code" error={twoFaSetupError ?? undefined}>
              <input
                id="two-fa-setup-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={twoFaSetupCode}
                onChange={(event) => setTwoFaSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseTwoFaSetup}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmTwoFa()}
                disabled={isUpdating2fa || twoFaSetupCode.length !== 6}
                className="btn-primary"
              >
                {isUpdating2fa ? 'Vérification...' : 'Activer'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={twoFaDisableOpen}
        onClose={handleCloseTwoFaDisable}
        title="Désactiver l'authentification à deux facteurs"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Pour désactiver le 2FA, saisissez votre code TOTP actuel et votre mot de passe.
          </p>

          <FormField label="Code TOTP" htmlFor="two-fa-disable-code">
            <input
              id="two-fa-disable-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={twoFaDisableCode}
              onChange={(event) => setTwoFaDisableCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>

          <FormField label="Mot de passe" htmlFor="two-fa-disable-password">
            <input
              id="two-fa-disable-password"
              type="password"
              autoComplete="current-password"
              value={twoFaDisablePassword}
              onChange={(event) => setTwoFaDisablePassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </FormField>

          {twoFaDisableError && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{twoFaDisableError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseTwoFaDisable}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmTwoFaDisable()}
              disabled={isUpdating2fa || twoFaDisableCode.length !== 6 || !twoFaDisablePassword}
              className="rounded-lg bg-status-error px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-status-error/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating2fa ? 'Désactivation...' : 'Désactiver'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
