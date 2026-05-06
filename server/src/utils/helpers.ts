import prisma from './prisma';

interface AuditParams {
  action: string;
  entity: string;
  entityId: string;
  details?: string;
  userId: string;
}

export async function createAuditLog(params: AuditParams) {
  return prisma.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      userId: params.userId,
    },
  });
}

let bookingCounter = 0;
let orderCounter = 0;
let invoiceCounter = 0;

export function generateBookingNumber(): string {
  bookingCounter++;
  const date = new Date();
  const prefix = `BK${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}${String(bookingCounter).padStart(4, '0')}`;
}

export function generateOrderNumber(): string {
  orderCounter++;
  const date = new Date();
  const prefix = `ORD${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}${String(orderCounter).padStart(4, '0')}`;
}

export function generateInvoiceNumber(): string {
  invoiceCounter++;
  const date = new Date();
  const prefix = `INV${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}${String(invoiceCounter).padStart(4, '0')}`;
}

// Initialize counters from DB
export async function initializeCounters() {
  const lastBooking = await prisma.booking.findFirst({ orderBy: { createdAt: 'desc' } });
  const lastOrder = await prisma.order.findFirst({ orderBy: { createdAt: 'desc' } });
  const lastInvoice = await prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' } });

  if (lastBooking) {
    const num = parseInt(lastBooking.bookingNumber.slice(-4));
    if (!isNaN(num)) bookingCounter = num;
  }
  if (lastOrder) {
    const num = parseInt(lastOrder.orderNumber.slice(-4));
    if (!isNaN(num)) orderCounter = num;
  }
  if (lastInvoice) {
    const num = parseInt(lastInvoice.invoiceNumber.slice(-4));
    if (!isNaN(num)) invoiceCounter = num;
  }
}
