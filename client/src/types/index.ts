export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'RECEPTION' | 'RESTAURANT';
  isActive?: boolean;
}

export interface RoomType {
  id: string;
  name: string;
  basePrice: number;
  description?: string;
}

export interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  roomTypeId: string;
  roomType: RoomType;
  status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'BLOCKED';
  blockReason?: string | null;
  blockStart?: string | null;
  blockEnd?: string | null;
  notes?: string | null;
  bookings?: Booking[];
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  idProofType?: string | null;
  idProofNumber?: string | null;
  address?: string | null;
  visitCount: number;
  notes?: string | null;
  idProofUrl?: string | null;
  bookings?: Booking[];
}

export interface Booking {
  id: string;
  bookingNumber: string;
  guestId: string;
  guest: Guest;
  roomId: string;
  room: Room;
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
  checkInDate: string;
  expectedCheckout: string;
  actualCheckout?: string | null;
  roomPrice: number;
  numberOfGuests: number;
  specialRequests?: string | null;
  groupBookingId?: string | null;
  groupBooking?: GroupBooking | null;
  invoice?: Invoice | null;
  payments?: Payment[];
  transfers?: RoomTransfer[];
  companyId?: string | null;
  company?: Company | null;
  billingRule?: 'GUEST' | 'COMPANY_ROOM_ONLY' | 'COMPANY_ALL';
  createdAt: string;
}

export interface RoomTransfer {
  id: string;
  bookingId: string;
  fromRoomId: string;
  fromRoom: Room;
  toRoomId: string;
  toRoom: Room;
  reason?: string;
  newRoomPrice?: number;
  transferredAt: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  category?: MenuCategory;
  description?: string | null;
  isVeg: boolean;
  isAvailable: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  type: 'ROOM' | 'WALK_IN' | 'TAKEAWAY';
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  roomId?: string | null;
  room?: Room | null;
  customerName?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
  items: OrderItem[];
  createdBy?: { name: string };
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem: MenuItem;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isCancelled: boolean;
  cancelReason?: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  booking?: Booking;
  roomCharges: number;
  foodCharges: number;
  extraCharges: number;
  discountAmount: number;
  subtotal: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
  pendingAmount: number;
  isFinalized: boolean;
  adjustments?: InvoiceAdjustment[];
  roomOrders?: Order[];
  companyId?: string | null;
  company?: Company | null;
  companyAmount?: number;
  guestAmount?: number;
  isBtc?: boolean;
}

export interface InvoiceAdjustment {
  id: string;
  invoiceId: string;
  type: 'DISCOUNT_FLAT' | 'DISCOUNT_PERCENT' | 'EXTRA_CHARGE';
  amount: number;
  reason: string;
  createdBy?: { name: string };
  createdAt: string;
}

export interface Payment {
  id: string;
  transactionId: string;
  bookingId?: string;
  orderId?: string;
  amount: number;
  method: 'CASH' | 'UPI' | 'CARD';
  type: 'ADVANCE' | 'PARTIAL' | 'FULL' | 'REFUND';
  reference?: string | null;
  notes?: string | null;
  createdBy?: { name: string };
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
  user: { name: string; role: string };
  createdAt: string;
}

export interface ReportSummary {
  roomRevenue: number;
  restaurantRevenue: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  occupancyPercent: number;
  occupiedRooms: number;
  totalRooms: number;
  currentCheckins: number;
  checkoutsInPeriod: number;
  confirmedBookings: number;
}

// ─── EXPENSE TYPES ──────────────────────────────────────

export type ExpenseCategory =
  | 'ELECTRICITY' | 'WATER' | 'STAFF_SALARY' | 'KITCHEN_SUPPLIES'
  | 'LAUNDRY' | 'MAINTENANCE' | 'HOUSEKEEPING' | 'MARKETING' | 'MISCELLANEOUS';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  paidDate: string;
  method: 'CASH' | 'UPI' | 'CARD';
  notes?: string | null;
  createdBy?: { name: string };
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  total: number;
  byCategory: Record<string, number>;
  count: number;
}

// ─── GROUP BOOKING TYPES ────────────────────────────────

export type GroupBookingStatus = 'ACTIVE' | 'PARTIALLY_CHECKED_OUT' | 'COMPLETED' | 'CANCELLED';

export interface GroupBooking {
  id: string;
  groupNumber: string;
  leadGuestId: string;
  leadGuest: Guest;
  status: GroupBookingStatus;
  notes?: string | null;
  bookings: Booking[];
  createdBy?: { name: string };
  createdAt: string;
  updatedAt: string;
}

export interface MasterInvoiceRoom {
  bookingId: string;
  bookingNumber: string;
  roomNumber: string;
  roomType: string;
  checkInDate: string;
  expectedCheckout: string;
  status: string;
  roomCharges: number;
  foodCharges: number;
  extraCharges: number;
  discountAmount: number;
  grandTotal: number;
  amountPaid: number;
  pendingAmount: number;
}

export interface MasterInvoice {
  groupNumber: string;
  status: string;
  leadGuest: { name: string; phone: string };
  rooms: MasterInvoiceRoom[];
  totalRoomCharges: number;
  totalFoodCharges: number;
  totalExtraCharges: number;
  totalDiscounts: number;
  totalGrandTotal: number;
  totalAmountPaid: number;
  totalPending: number;
}

export interface Company {
  id: string;
  name: string;
  gstin?: string | null;
  address?: string | null;
  state: string;
  creditLimit: number;
  outstandingBalance: number;
  email?: string | null;
  phone?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── BANQUET TYPES ────────────────────────────────────────

export interface BanquetHall {
  id: string;
  name: string;
  maxCapacity: number;
  baseRental: number;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export type BanquetSlot = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'CUSTOM';
export type BanquetStatus = 'PROVISIONAL' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
export type BanquetPaymentType = 'ADVANCE' | 'SETTLEMENT' | 'REFUND';

export interface BanquetPayment {
  id: string;
  bookingId: string;
  amount: number;
  method: 'CASH' | 'UPI' | 'CARD';
  type: BanquetPaymentType;
  reference?: string | null;
  notes?: string | null;
  createdBy?: { name: string };
  createdAt: string;
}

export interface BanquetBooking {
  id: string;
  bookingNumber: string;
  guestId: string;
  guest: Guest;
  hallId: string;
  hall: BanquetHall;
  eventDate: string;
  slot: BanquetSlot;
  startTime?: string | null;
  endTime?: string | null;
  status: BanquetStatus;
  eventType: string;
  estimatedPax: number;
  hallRentalPrice: number;
  perHeadFoodPrice: number;
  extraCharges: number;
  subtotal: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  advancePaid: number;
  pendingAmount: number;
  notes?: string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  payments?: BanquetPayment[];
  createdBy?: { name: string };
  createdAt: string;
}
