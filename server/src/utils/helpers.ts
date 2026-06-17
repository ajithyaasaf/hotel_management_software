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
let groupCounter = 0;
let banquetCounter = 0;

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

export function generateGroupNumber(): string {
  groupCounter++;
  const date = new Date();
  const prefix = `GRP${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}${String(groupCounter).padStart(4, '0')}`;
}

export function generateBanquetNumber(): string {
  banquetCounter++;
  const date = new Date();
  const prefix = `BQ${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}${String(banquetCounter).padStart(4, '0')}`;
}

// Initialize counters from DB on server start
export async function initializeCounters() {
  const [lastBooking, lastOrder, lastInvoice, lastGroup, lastBanquet] = await Promise.all([
    prisma.booking.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.order.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.groupBooking.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.banquetBooking.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);

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
  if (lastGroup) {
    const num = parseInt(lastGroup.groupNumber.slice(-4));
    if (!isNaN(num)) groupCounter = num;
  }
  if (lastBanquet) {
    const num = parseInt(lastBanquet.bookingNumber.slice(-4));
    if (!isNaN(num)) banquetCounter = num;
  }
}

