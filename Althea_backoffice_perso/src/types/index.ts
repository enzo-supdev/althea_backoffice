// Types principaux pour le backoffice Althea Systems

export interface Product {
  id: string
  name: string
  description: string
  price: number
  priceHT: number
  tva: number
  stock: number
  status: 'published' | 'draft'
  category: Category
  images: string[]
  createdAt: Date
  updatedAt: Date
}

export interface Category {
  id: string
  name: string
  description: string
  image: string
  slug: string
  productCount: number
  order: number
  status: 'active' | 'inactive'
  createdAt: Date
}

export interface User {
  id: string
  fullName: string
  email: string
  status: 'active' | 'inactive' | 'pending'
  archived: boolean
  archivedAt: Date | null
  createdAt: Date
  lastLogin: Date
  ordersCount: number
  totalRevenue: number
  addresses: Address[]
}

export interface Address {
  id: string
  firstName: string
  lastName: string
  address1: string
  address2?: string
  city: string
  region: string
  postalCode: string
  country: string
  phone: string
}

export interface Order {
  id: string
  orderNumber: string
  customer: User
  items: OrderItem[]
  totalAmount: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  paymentMethod: string
  paymentStatus: 'validated' | 'pending' | 'failed' | 'refunded'
  shippingAddress: Address
  billingAddress: Address
  createdAt: Date
}

export interface OrderItem {
  id: string
  product: Product
  quantity: number
  price: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  order: Order
  customer: User
  amount: number
  status: 'paid' | 'pending' | 'cancelled'
  createdAt: Date
}

export interface Message {
  id: string
  email: string
  subject: string
  message: string
  status: 'unread' | 'read' | 'replied' | 'closed'
  replies: MessageReply[]
  createdAt: Date
}

export interface MessageReply {
  id: string
  author: string
  message: string
  createdAt: Date
}

export interface Stats {
  revenue: {
    day: number
    week: number
    month: number
  }
  ordersToday: number
  stockAlerts: number
  unreadMessages: number
}
