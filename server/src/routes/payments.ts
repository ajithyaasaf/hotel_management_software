import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

const router = Router();
router.use(authenticate, requirePermission('payment.manage'));

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'UPI', 'CARD', 'BTC']),
  type: z.enum(['ADVANCE', 'PARTIAL', 'FULL', 'REFUND']),
  reference: z.string().optional(),
  notes: z.string().optional(),
  bookingId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
}).refine(data => data.bookingId || data.orderId, { message: 'Either bookingId or orderId must be provided' });

router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = paymentSchema.parse(req.body);
    let entityName = '';
    let entityId = '';
    let invoiceToUpdate: any = null;

    if (data.bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: data.bookingId }, include: { invoice: true } });
      if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
      entityName = 'booking'; entityId = booking.id;
      if (booking.invoice) { invoiceToUpdate = booking.invoice; }
    } else if (data.orderId) {
      const order = await prisma.order.findUnique({ where: { id: data.orderId } });
      if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
      entityName = 'order'; entityId = order.id;
    }

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: { amount: data.amount, method: data.method, type: data.type, reference: data.reference, notes: data.notes, bookingId: data.bookingId, orderId: data.orderId, createdById: req.user!.id },
      });

      if (invoiceToUpdate) {
        if (data.type === 'REFUND') {
          await tx.invoice.update({ where: { id: invoiceToUpdate.id }, data: { amountPaid: { decrement: data.amount }, pendingAmount: { increment: data.amount } } });
        } else {
          await tx.invoice.update({ where: { id: invoiceToUpdate.id }, data: { amountPaid: { increment: data.amount }, pendingAmount: { decrement: data.amount } } });
        }
      }

      if (data.bookingId && data.method === 'BTC' && invoiceToUpdate && invoiceToUpdate.companyId) {
        if (data.type === 'REFUND') {
          await tx.company.update({ where: { id: invoiceToUpdate.companyId }, data: { outstandingBalance: { decrement: data.amount } } });
        } else {
          await tx.company.update({ where: { id: invoiceToUpdate.companyId }, data: { outstandingBalance: { increment: data.amount } } });
        }
      }
      return p;
    });

    await createAuditLog({
      action: 'RECORD_PAYMENT',
      entity: entityName,
      entityId,
      details: `${data.type} payment of ₹${data.amount} via ${data.method}`,
      userId: req.user!.id,
      newValue: {
        amount: data.amount,
        method: data.method,
        type: data.type,
        reference: data.reference || null,
        bookingId: data.bookingId || null,
        orderId: data.orderId || null,
      }
    });
    res.status(201).json(payment);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

export default router;
