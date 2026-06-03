import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const paymentSchema = z.object({
  bookingId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'UPI', 'CARD', 'BTC']),
  type: z.enum(['ADVANCE', 'PARTIAL', 'FULL', 'REFUND']),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/payments/booking/:bookingId
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { bookingId: req.params.bookingId },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch { res.status(500).json({ error: 'Failed to fetch payments' }); }
});

// POST /api/payments — record payment
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = paymentSchema.parse(req.body);
    if (!data.bookingId && !data.orderId) {
      res.status(400).json({ error: 'Must link to a booking or order' }); return;
    }

    const payment = await prisma.$transaction(async (tx) => {
      if (data.method === 'BTC') {
        if (!data.bookingId) {
          throw new Error('BTC payment method can only be used for bookings');
        }
        const b = await tx.booking.findUnique({ where: { id: data.bookingId } });
        if (!b || !b.companyId) {
          throw new Error('Cannot use BTC payment method for guests without a corporate account');
        }

        // Increment company outstanding balance
        await tx.company.update({
          where: { id: b.companyId },
          data: {
            outstandingBalance: {
              increment: data.amount,
            },
          },
        });
      }

      const p = await tx.payment.create({
        data: {
          bookingId: data.bookingId,
          orderId: data.orderId,
          amount: data.amount,
          method: data.method,
          type: data.type,
          reference: data.reference,
          notes: data.notes,
          createdById: req.user!.id,
        },
        include: { createdBy: { select: { name: true } } },
      });

      if (data.bookingId && data.type !== 'REFUND') {
        const invoice = await tx.invoice.findUnique({ where: { bookingId: data.bookingId } });
        if (invoice) {
          const newPaid = Number(invoice.amountPaid) + data.amount;
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { amountPaid: newPaid, pendingAmount: Math.max(0, Number(invoice.guestAmount) - newPaid) },
          });

          if (invoice.companyId && data.method !== 'BTC') {
            const oldCompanyPaid = Math.max(0, Number(invoice.amountPaid) - Number(invoice.guestAmount));
            const newCompanyPaid = Math.max(0, newPaid - Number(invoice.guestAmount));
            const companyPaidDiff = newCompanyPaid - oldCompanyPaid;
            if (companyPaidDiff > 0) {
              await tx.company.update({
                where: { id: invoice.companyId },
                data: { outstandingBalance: { decrement: companyPaidDiff } },
              });
            } else if (companyPaidDiff < 0) {
              await tx.company.update({
                where: { id: invoice.companyId },
                data: { outstandingBalance: { increment: Math.abs(companyPaidDiff) } },
              });
            }
          }
        }
      }

      if (data.bookingId && data.type === 'REFUND') {
        const invoice = await tx.invoice.findUnique({ where: { bookingId: data.bookingId } });
        if (invoice) {
          const newPaid = Math.max(0, Number(invoice.amountPaid) - data.amount);
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { amountPaid: newPaid, pendingAmount: Math.max(0, Number(invoice.guestAmount) - newPaid) },
          });

          if (invoice.companyId && data.method !== 'BTC') {
            const oldCompanyPaid = Math.max(0, Number(invoice.amountPaid) - Number(invoice.guestAmount));
            const newCompanyPaid = Math.max(0, newPaid - Number(invoice.guestAmount));
            const companyPaidDiff = newCompanyPaid - oldCompanyPaid;
            if (companyPaidDiff > 0) {
              await tx.company.update({
                where: { id: invoice.companyId },
                data: { outstandingBalance: { decrement: companyPaidDiff } },
              });
            } else if (companyPaidDiff < 0) {
              await tx.company.update({
                where: { id: invoice.companyId },
                data: { outstandingBalance: { increment: Math.abs(companyPaidDiff) } },
              });
            }
          }
        }
      }

      return p;
    });

    await createAuditLog({
      action: `PAYMENT_${data.type}`,
      entity: 'payment',
      entityId: payment.id,
      details: `₹${data.amount} via ${data.method}`,
      userId: req.user!.id,
    });

    res.status(201).json(payment);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Payment failed' });
  }
});

export default router;
