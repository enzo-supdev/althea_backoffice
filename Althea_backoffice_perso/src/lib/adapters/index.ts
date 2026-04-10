import { Category, Invoice, Message, Order, Product, User } from '@/types'

export interface CategoryDto extends Omit<Category, 'createdAt'> {
  createdAt: string
}

export interface ProductDto extends Omit<Product, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
}

export interface UserDto extends Omit<User, 'createdAt' | 'lastLogin' | 'archivedAt'> {
  createdAt: string
  lastLogin: string
  archivedAt: string | null
}

export interface OrderDto extends Omit<Order, 'createdAt'> {
  createdAt: string
}

export interface InvoiceDto extends Omit<Invoice, 'createdAt'> {
  createdAt: string
}

export interface MessageReplyDto {
  id: string
  author: string
  message: string
  createdAt: string
}

export interface MessageDto extends Omit<Message, 'createdAt' | 'replies'> {
  createdAt: string
  replies: MessageReplyDto[]
}

export function serializeCategory(category: Category): CategoryDto {
  return {
    ...category,
    createdAt: category.createdAt.toISOString(),
  }
}

export function deserializeCategory(dto: CategoryDto): Category {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
  }
}

export function serializeProduct(product: Product): ProductDto {
  return {
    ...product,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }
}

export function deserializeProduct(dto: ProductDto): Product {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  }
}

export function serializeUser(user: User): UserDto {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin.toISOString(),
    archivedAt: user.archivedAt ? user.archivedAt.toISOString() : null,
  }
}

export function deserializeUser(dto: UserDto): User {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    lastLogin: new Date(dto.lastLogin),
    archivedAt: dto.archivedAt ? new Date(dto.archivedAt) : null,
  }
}

export function serializeOrder(order: Order): OrderDto {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
  }
}

export function deserializeOrder(dto: OrderDto): Order {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
  }
}

export function serializeInvoice(invoice: Invoice): InvoiceDto {
  return {
    ...invoice,
    createdAt: invoice.createdAt.toISOString(),
  }
}

export function deserializeInvoice(dto: InvoiceDto): Invoice {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
  }
}

export function serializeMessage(message: Message): MessageDto {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
    replies: message.replies.map((reply) => ({
      ...reply,
      createdAt: reply.createdAt.toISOString(),
    })),
  }
}

export function deserializeMessage(dto: MessageDto): Message {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    replies: dto.replies.map((reply) => ({
      ...reply,
      createdAt: new Date(reply.createdAt),
    })),
  }
}