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
  invoice?: Invoice | null;
  payments?: Payment[];
  transfers?: RoomTransfer[];
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
  occupancyPercent: number;
  occupiedRooms: number;
  totalRooms: number;
  currentCheckins: number;
  checkoutsInPeriod: number;
  confirmedBookings: number;
}
