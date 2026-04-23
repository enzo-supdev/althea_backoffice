import axiosInstance from './axiosInstance'

type ChatbotSessionStatus = 'open' | 'resolved' | 'escalated'

export interface ChatbotMessage {
  id: string
  role: 'user' | 'bot'
  content: string
  createdAt: Date
}

export interface ChatbotSession {
  id: string
  userLabel: string
  startedAt: Date
  status: ChatbotSessionStatus
  messageCount: number
  assignedTo?: string | null
}

function normalizeChatbotStatus(status: unknown): ChatbotSessionStatus {
  const raw = typeof status === 'string' ? status.toLowerCase() : ''

  if (raw === 'escalated') return 'escalated'
  if (raw === 'closed' || raw === 'resolved') return 'resolved'
  return 'open'
}

function normalizeChatbotSession(input: any): ChatbotSession {
  const userCandidate = input.user ?? input.customer ?? input.visitor
  const userLabel =
    input.userLabel ??
    userCandidate?.fullName ??
    userCandidate?.email ??
    (userCandidate?.id ? `Utilisateur #${userCandidate.id}` : 'Visiteur anonyme')

  const id = String(input.sessionId ?? input.id ?? '')
  const startedAtRaw = input.createdAt ?? input.startedAt ?? new Date().toISOString()

  return {
    id,
    userLabel,
    startedAt: new Date(startedAtRaw),
    status: normalizeChatbotStatus(input.status),
    messageCount: Number(input.messageCount ?? input.totalMessages ?? 0),
    assignedTo: input.assignedTo ?? null,
  }
}

function normalizeChatbotMessage(input: any): ChatbotMessage {
  const sender = String(input.sender ?? input.role ?? 'user').toLowerCase()

  return {
    id: String(input.id ?? input.messageId ?? `${sender}-${input.timestamp ?? Date.now()}`),
    role: sender === 'bot' ? 'bot' : 'user',
    content: String(input.message ?? input.content ?? ''),
    createdAt: new Date(input.timestamp ?? input.createdAt ?? new Date().toISOString()),
  }
}

/**
 * Gestion des sessions de chatbot (admin)
 */
export const chatbotApi = {
  /**
   * GET /chatbot/admin/sessions
   */
  async listAdminSessions(params?: {
    status?: 'open' | 'closed' | 'escalated'
    userId?: string
    page?: number
    limit?: number
  }): Promise<ChatbotSession[]> {
    const { data } = await axiosInstance.get<any>('/chatbot/admin/sessions', { params })

    const sessionsSource =
      (Array.isArray(data?.sessions) && data.sessions) ||
      (Array.isArray(data?.data?.sessions) && data.data.sessions) ||
      (Array.isArray(data?.data) && data.data) ||
      []

    return sessionsSource
      .map(normalizeChatbotSession)
      .filter((session: ChatbotSession) => Boolean(session.id))
  },

  /**
   * GET /chatbot/sessions/:sessionId/messages
   */
  async getSessionMessages(sessionId: string, limit = 100): Promise<ChatbotMessage[]> {
    const { data } = await axiosInstance.get<any>(`/chatbot/sessions/${sessionId}/messages`, {
      params: { limit },
    })

    const messagesSource =
      (Array.isArray(data?.messages) && data.messages) ||
      (Array.isArray(data?.data?.messages) && data.data.messages) ||
      (Array.isArray(data?.data) && data.data) ||
      []

    return messagesSource.map(normalizeChatbotMessage)
  },

  /**
   * PUT /chatbot/admin/sessions/:sessionId/escalate
   */
  async escalateSession(sessionId: string, assignedTo?: string): Promise<ChatbotSession> {
    const { data } = await axiosInstance.put<any>(`/chatbot/admin/sessions/${sessionId}/escalate`, {
      assignedTo,
    })

    const payload = data?.data ?? data
    return normalizeChatbotSession(payload)
  },
}
