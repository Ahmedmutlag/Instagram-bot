export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "SUPPORT";

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export type UserStatus = "ACTIVE" | "BANNED" | "ALL";

export interface AppUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  balance: number;
  isBanned: boolean;
  referralCode: string | null;
  createdAt: string;
  _count?: {
    orders: number;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  user?: Pick<AppUser, "id" | "username" | "firstName" | "lastName" | "telegramId">;
  serviceId: string;
  service?: { id: string; name: string };
  providerId?: string | null;
  provider?: { id: string; name: string } | null;
  providerOrderId?: string | null;
  quantity: number;
  price: number;
  costPrice?: number | null;
  profit?: number | null;
  status: OrderStatus;
  link?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PARTIAL"
  | "CANCELED"
  | "FAILED"
  | "REFUNDED";

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  providerId: string;
  provider?: { id: string; name: string };
  providerServiceId: string;
  price: number;
  minQuantity: number;
  maxQuantity: number;
  status: "ACTIVE" | "INACTIVE";
  costPrice?: number | null;
  marginPercent?: number | null;
  createdAt?: string;
}

export interface Provider {
  id: string;
  name: string;
  apiUrl: string;
  apiKey?: string;
  adapterType?: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
}

export interface RemoteService {
  externalServiceId: string;
  name: string;
  category?: string;
  rate: number;
  min: number;
  max: number;
}

export interface ProviderService {
  id: string;
  providerId: string;
  externalServiceId: string;
  name: string;
  category?: string | null;
  costPrice: number;
  minQuantity: number;
  maxQuantity: number;
  createdAt?: string;
}

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface Payment {
  id: string;
  userId: string;
  user?: Pick<AppUser, "id" | "username" | "firstName" | "lastName">;
  amount: number;
  status: PaymentStatus;
  method?: string | null;
  createdAt: string;
}

export type CouponType = "PERCENTAGE" | "FIXED";

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  maxUses?: number | null;
  usedCount?: number;
  minOrderAmount?: number | null;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface Settings {
  botName?: string;
  botToken?: string;
  currency?: string;
  language?: string;
  supportUsername?: string;
  minDeposit?: number;
  referralPercent?: number;
  depositInstructions?: string;
  adminNotifyChatId?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
}

export interface ApiErrorShape {
  message: string;
  code: string;
  details?: unknown;
}
