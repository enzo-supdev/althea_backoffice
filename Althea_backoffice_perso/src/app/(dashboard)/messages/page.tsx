'use client'

import { useEffect, useMemo, useState } from 'react'
import { Mail, MailOpen, Reply } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Badge from '@/components/ui/Badge'
import SearchBar from '@/components/ui/SearchBar'
import { useToast } from '@/components/ui/ToastProvider'
import FormField from '@/components/ui/form/FormField'
import { Message } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { ApiError, messagesApi } from '@/lib/api'
import PageHeader from '@/components/layout/PageHeader'

const replySchema = z.object({
  reply: z.string().trim().min(1, 'La reponse est obligatoire.').max(2000, 'La reponse depasse 2000 caracteres.'),
})

type ReplyFormValues = z.infer<typeof replySchema>

type ChatbotConversation = {
  id: string
  userLabel: string
  startedAt: Date
  status: 'open' | 'resolved'
  messages: Array<{ role: 'user' | 'bot'; content: string; createdAt: Date }>
}

const CHATBOT_HISTORY_STORAGE_KEY = 'althea.chatbot.history'

const fallbackChatbotConversations: ChatbotConversation[] = [
  {
    id: 'cb-1',
    userLabel: 'Visiteur #1042',
    startedAt: new Date(),
    status: 'resolved',
    messages: [
      { role: 'user', content: 'Quel est le delai de livraison ?', createdAt: new Date() },
      { role: 'bot', content: 'Le delai moyen est de 48 a 72h selon la zone.', createdAt: new Date() },
    ],
  },
]

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [chatbotConversations, setChatbotConversations] = useState<ChatbotConversation[]>([])
  const [selectedChatbotId, setSelectedChatbotId] = useState<string | null>(null)
  const { pushToast } = useToast()

  const replyForm = useForm<ReplyFormValues>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      reply: '',
    },
  })

  const replyDraft = replyForm.watch('reply')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const raw = window.localStorage.getItem(CHATBOT_HISTORY_STORAGE_KEY)
    if (!raw) {
      setChatbotConversations(fallbackChatbotConversations)
      setSelectedChatbotId(fallbackChatbotConversations[0]?.id ?? null)
      return
    }

    try {
      const parsed = JSON.parse(raw) as Array<{
        id: string
        userLabel: string
        startedAt: string
        status: 'open' | 'resolved'
        messages: Array<{ role: 'user' | 'bot'; content: string; createdAt: string }>
      }>

      const normalized = parsed.map((conversation) => ({
        ...conversation,
        startedAt: new Date(conversation.startedAt),
        messages: conversation.messages.map((item) => ({ ...item, createdAt: new Date(item.createdAt) })),
      }))

      setChatbotConversations(normalized)
      setSelectedChatbotId(normalized[0]?.id ?? null)
    } catch {
      setChatbotConversations(fallbackChatbotConversations)
      setSelectedChatbotId(fallbackChatbotConversations[0]?.id ?? null)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadMessages = async () => {
      setLoadError('')
      setIsLoading(true)

      try {
        const loadedMessages = await messagesApi.list()
        if (!isMounted) return
        setMessages(loadedMessages)
      } catch (error) {
        if (!isMounted) return
        setLoadError('La messagerie est indisponible.')
        pushToast({
          type: 'error',
          title: 'Chargement messages impossible',
          message: error instanceof ApiError ? error.message : 'Les donnees locales ont ete ignorees.',
        })
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadMessages()

    return () => {
      isMounted = false
    }
  }, [pushToast])

  const persistMessages = async (nextMessages: Message[]) => {
    setMessages(nextMessages)

    try {
      await messagesApi.save(nextMessages)
    } catch (error) {
      pushToast({
        type: 'error',
        title: 'Sauvegarde impossible',
        message: error instanceof ApiError ? error.message : 'La synchronisation locale a echoue.',
      })
    }
  }

  const retryLoadMessages = () => {
    setLoadError('')
    setIsLoading(true)

    void messagesApi.list()
      .then((loadedMessages) => {
        setMessages(loadedMessages)
      })
      .catch((error) => {
        setLoadError('La messagerie est indisponible.')
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

  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageId) ?? null,
    [messages, selectedMessageId]
  )

  const selectedChatbotConversation = useMemo(
    () => chatbotConversations.find((conversation) => conversation.id === selectedChatbotId) ?? null,
    [chatbotConversations, selectedChatbotId],
  )

  const filteredMessages = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return messages.filter((msg) => {
      const matchesSearch =
        !query ||
        msg.subject.toLowerCase().includes(query) ||
        msg.email.toLowerCase().includes(query) ||
        msg.message.toLowerCase().includes(query)

      const matchesStatus = filterStatus === 'all' || msg.status === filterStatus

      return matchesSearch && matchesStatus
    })
  }, [messages, searchQuery, filterStatus])

  const unreadCount = messages.filter((message) => message.status === 'unread').length
  const repliedCount = messages.filter((message) => message.status === 'replied').length
  const closedCount = messages.filter((message) => message.status === 'closed').length

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unread':
        return { variant: 'error' as const, label: 'Non lu' }
      case 'read':
        return { variant: 'warning' as const, label: 'Lu' }
      case 'replied':
        return { variant: 'success' as const, label: 'Répondu' }
      case 'closed':
        return { variant: 'default' as const, label: 'Clos' }
      default:
        return { variant: 'default' as const, label: status }
    }
  }

  const handleSelectMessage = (message: Message) => {
    setSelectedMessageId(message.id)
    replyForm.reset({ reply: '' })

    if (message.status === 'unread') {
      const nextMessages: Message[] = messages.map((item) =>
        item.id === message.id
          ? { ...item, status: 'read' }
          : item
      )

      void persistMessages(nextMessages)
    }
  }

  const markSelectedAsRead = async () => {
    if (!selectedMessageId) return
    const nextMessages: Message[] = messages.map((item) =>
      item.id === selectedMessageId
        ? { ...item, status: 'read' }
        : item
    )

    await persistMessages(nextMessages)

    pushToast({
      type: 'info',
      title: 'Message marque comme lu',
    })
  }

  const replyToSelected = replyForm.handleSubmit(async (values) => {
    if (!selectedMessageId || !selectedMessage || selectedMessage.status === 'closed') return

    const replyMessage = values.reply.trim()

    const nextMessages: Message[] = messages.map((item) =>
      item.id === selectedMessageId
        ? {
            ...item,
            status: 'replied',
            replies: [
              ...item.replies,
              {
                id: `reply-${Date.now()}`,
                author: 'Support Althea',
                message: replyMessage,
                createdAt: new Date(),
              },
            ],
          }
        : item
    )

    await persistMessages(nextMessages)
    replyForm.reset({ reply: '' })

    pushToast({
      type: 'success',
      title: 'Reponse envoyee',
      message: 'Le message a ete passe en repondu.',
    })
  })

  const closeSelected = async () => {
    if (!selectedMessageId) return

    const nextMessages: Message[] = messages.map((item) =>
      item.id === selectedMessageId
        ? { ...item, status: 'closed' }
        : item
    )

    await persistMessages(nextMessages)

    pushToast({
      type: 'success',
      title: 'Conversation close',
      message: 'Le ticket support a ete archive localement.',
    })
  }

  const reopenSelected = async () => {
    if (!selectedMessageId) return

    const nextMessages: Message[] = messages.map((item) =>
      item.id === selectedMessageId
        ? { ...item, status: item.replies.length > 0 ? 'replied' : 'read' }
        : item
    )

    await persistMessages(nextMessages)

    pushToast({
      type: 'info',
      title: 'Conversation rouverte',
    })
  }

  const getTimeline = (message: Message) => {
    const timeline = [
      { label: 'Message recu', date: message.createdAt, active: true },
    ]

    if (message.status !== 'unread') {
      timeline.push({ label: 'Ouvert par le support', date: message.createdAt, active: true })
    }

    message.replies.forEach((reply) => {
      timeline.push({ label: `Reponse: ${reply.author}`, date: reply.createdAt, active: true })
    })

    if (message.status === 'closed') {
      timeline.push({ label: 'Conversation close', date: message.createdAt, active: true })
    }

    return timeline
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Messages & support"
        description={`${filteredMessages.length} message${filteredMessages.length > 1 ? 's' : ''} à traiter.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="app-panel p-4">
          <p className="text-sm text-gray-500">Messages non lus</p>
          <p className="mt-1 text-2xl font-heading font-semibold text-status-error">{unreadCount}</p>
        </div>
        <div className="app-panel p-4">
          <p className="text-sm text-gray-500">Messages repondus</p>
          <p className="mt-1 text-2xl font-heading font-semibold text-status-success">{repliedCount}</p>
        </div>
        <div className="app-panel p-4">
          <p className="text-sm text-gray-500">Conversations closes</p>
          <p className="mt-1 text-2xl font-heading font-semibold text-dark">{closedCount}</p>
        </div>
        <div className="app-panel p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-sm text-gray-500">Total messages</p>
          <p className="mt-1 text-2xl font-heading font-semibold text-dark">{messages.length}</p>
        </div>
      </div>

      <div className="app-panel space-y-4 p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SearchBar
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value)
              setSelectedMessageId(null)
              replyForm.reset({ reply: '' })
            }}
            placeholder="Rechercher un message..."
            ariaLabel="Rechercher un message"
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setSelectedMessageId(null)
              replyForm.reset({ reply: '' })
            }}
            className="input-base bg-shell-surface"
          >
            <option value="all">Tous les statuts</option>
            <option value="unread">Non lus</option>
            <option value="read">Lus</option>
            <option value="replied">Répondus</option>
            <option value="closed">Clos</option>
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
            <button type="button" onClick={retryLoadMessages} className="btn-primary">
              Reessayer
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card p-0">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="border-b border-gray-200 p-4 last:border-b-0">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
          <div className="card lg:col-span-2">
            <div className="space-y-4">
              <div className="h-6 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
              <div className="h-32 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="card p-0 lg:col-span-1">
              <div className="divide-y divide-gray-200">
                {filteredMessages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => handleSelectMessage(message)}
                    className={`w-full text-left p-4 transition-colors hover:bg-gray-50 ${
                      selectedMessageId === message.id ? 'bg-primary-light' : ''
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {message.status === 'unread' ? (
                          <Mail className="h-4 w-4 text-status-error" />
                        ) : (
                          <MailOpen className="h-4 w-4 text-gray-400" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            message.status === 'unread' ? 'text-gray-900' : 'text-gray-600'
                          }`}
                        >
                          {message.email}
                        </span>
                      </div>
                      {getStatusBadge(message.status).variant && (
                        <Badge variant={getStatusBadge(message.status).variant} size="sm">
                          {getStatusBadge(message.status).label}
                        </Badge>
                      )}
                    </div>
                    <div
                      className={`mb-1 text-sm ${
                        message.status === 'unread' ? 'font-medium text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {message.subject}
                    </div>
                    <div className="text-xs text-gray-500">{formatDateTime(message.createdAt)}</div>
                  </button>
                ))}
                {filteredMessages.length === 0 && (
                  <div className="p-6 text-center text-sm text-gray-500">Aucun message trouve</div>
                )}
              </div>
            </div>

            <div className="card lg:col-span-2">
              {selectedMessage ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-heading font-semibold text-dark">{selectedMessage.subject}</h2>
                      <p className="mt-1 text-sm text-gray-600">De : {selectedMessage.email}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDateTime(selectedMessage.createdAt)}</p>
                    </div>
                    <Badge variant={getStatusBadge(selectedMessage.status).variant}>
                      {getStatusBadge(selectedMessage.status).label}
                    </Badge>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <p className="whitespace-pre-wrap text-gray-700">{selectedMessage.message}</p>
                  </div>

                  {selectedMessage.replies.length > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="text-sm font-semibold text-dark">Historique des réponses</h3>
                      <div className="mt-3 space-y-3">
                        {selectedMessage.replies.map((reply) => (
                          <div key={reply.id} className="rounded-lg bg-gray-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium text-dark">{reply.author}</p>
                              <p className="text-xs text-gray-500">{formatDateTime(reply.createdAt)}</p>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-gray-700">{reply.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-dark">Timeline</h3>
                    <div className="mt-3 space-y-3">
                      {getTimeline(selectedMessage).map((step) => (
                        <div key={`${step.label}-${step.date.toISOString()}`} className="flex items-start gap-3">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                          <div>
                            <p className="font-medium text-dark">{step.label}</p>
                            <p className="text-xs text-gray-500">{formatDateTime(step.date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedMessage.status !== 'closed' ? (
                    <div className="border-t border-gray-200 pt-4">
                      <form onSubmit={replyToSelected} className="space-y-3">
                        <FormField
                          label="Votre reponse"
                          error={replyForm.formState.errors.reply?.message}
                          htmlFor="replyMessage"
                        >
                          <textarea
                            id="replyMessage"
                            rows={5}
                            placeholder="Ecrire une reponse..."
                            {...replyForm.register('reply')}
                            className="input-base"
                          />
                        </FormField>
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={markSelectedAsRead}
                            className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
                          >
                            Marquer comme lu
                          </button>
                          <button
                            type="button"
                            onClick={closeSelected}
                            className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100"
                          >
                            Clore
                          </button>
                          <button
                            type="submit"
                            disabled={replyForm.formState.isSubmitting || !replyDraft.trim()}
                            className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Reply className="h-4 w-4" />
                            {replyForm.formState.isSubmitting ? 'Envoi...' : 'Repondre'}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="border-t border-gray-200 pt-4">
                      <button type="button" onClick={reopenSelected} className="btn-primary">
                        Rouvrir la conversation
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500">Sélectionnez un message pour le consulter</div>
              )}
            </div>
          </div>

          <div className="app-panel p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-heading font-semibold text-dark">Historique conversations chatbot</h3>
              <span className="text-xs text-gray-500">
                {chatbotConversations.length} conversation{chatbotConversations.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white">
                {chatbotConversations.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500">Aucun historique chatbot.</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {chatbotConversations.map((conversation) => (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedChatbotId(conversation.id)}
                          className={`w-full px-4 py-3 text-left transition-colors ${selectedChatbotId === conversation.id ? 'bg-primary-light/50' : 'hover:bg-gray-50'}`}
                        >
                          <p className="text-sm font-medium text-dark">{conversation.userLabel}</p>
                          <p className="text-xs text-gray-500">{formatDateTime(conversation.startedAt)}</p>
                          <Badge variant={conversation.status === 'resolved' ? 'success' : 'warning'}>
                            {conversation.status === 'resolved' ? 'Resolue' : 'Ouverte'}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 lg:col-span-2">
                {!selectedChatbotConversation ? (
                  <p className="text-sm text-gray-500">Selectionnez une conversation chatbot.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedChatbotConversation.messages.map((item, index) => (
                      <div
                        key={`${selectedChatbotConversation.id}-${index}`}
                        className={`rounded-lg p-3 text-sm ${item.role === 'bot' ? 'bg-primary-light/30 text-dark' : 'bg-gray-100 text-gray-800'}`}
                      >
                        <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                          {item.role === 'bot' ? 'Chatbot' : 'Utilisateur'}
                        </p>
                        <p>{item.content}</p>
                        <p className="mt-2 text-[11px] text-gray-500">{formatDateTime(item.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
