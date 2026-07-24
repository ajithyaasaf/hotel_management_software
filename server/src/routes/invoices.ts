import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';
import { calculateTaxWithTx } from '../utils/tax';
import { computeBillingSplit } from './bookings';
import { computeCalendarNightsIST } from '../utils/dateTime';

const router = Router();
router.use(authenticate);

router.get('/:id', requirePermission('booking.view'), async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id as string },
      include: {
        booking: { include: { guest: true, room: { include: { roomType: true } }, payments: { include: { createdBy: { select: { name: true } } } } } },
        adjustments: { include: { createdBy: { select: { name: true } } } },
      },
    });
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
    res.json(invoice);
  } catch { res.status(500).json({ error: 'Failed to fetch invoice' }); }
});

router.get('/booking/:bookingId', requirePermission('booking.view'), async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { bookingId: req.params.bookingId },
      include: {
        booking: { include: { guest: true, room: { include: { roomType: true } }, payments: { include: { createdBy: { select: { name: true } } } } } },
        adjustments: { include: { createdBy: { select: { name: true } } } },
      },
    });
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    const roomOrders = await prisma.order.findMany({
      where: { roomId: invoice.booking.roomId, status: 'COMPLETED', createdAt: { gte: invoice.booking.checkInDate } },
      include: { items: { where: { isCancelled: false }, include: { menuItem: true } } },
    });
    res.json({ ...invoice, roomOrders });
  } catch { res.status(500).json({ error: 'Failed to fetch invoice' }); }
});

router.post('/:id/adjustments', requirePermission('booking.manage', 'payment.manage', 'MD'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ type: z.enum(['DISCOUNT_FLAT', 'DISCOUNT_PERCENT', 'EXTRA_CHARGE']), amount: z.number().positive(), reason: z.string().min(1) }).parse(req.body);
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id as string }, include: { booking: true } }) as any;
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
    if (invoice.isFinalized && req.user?.role !== 'MD') { res.status(400).json({ error: 'Invoice is finalized. Only the MD can make post-checkout adjustments.' }); return; }

    let adjustedAmount = data.amount;
    if (data.type === 'DISCOUNT_PERCENT') { adjustedAmount = parseFloat(((data.amount / 100) * Number(invoice.subtotal)).toFixed(2)); }

    let newDiscount = Number(invoice.discountAmount);
    let newExtra = Number(invoice.extraCharges);
    if (data.type === 'EXTRA_CHARGE') { newExtra += adjustedAmount; } else { newDiscount += adjustedAmount; }

    let finalGrand = 0;
    await prisma.$transaction(async (tx) => {
      await tx.invoiceAdjustment.create({ data: { invoiceId: invoice.id, type: data.type, amount: adjustedAmount, reason: data.reason, createdById: req.user!.id } });
      const newSubtotal = Number(invoice.roomCharges) + Number(invoice.foodCharges) + newExtra - newDiscount;
      const taxableStayAmount = Number(invoice.roomCharges) + newExtra - newDiscount;
      const tax = await calculateTaxWithTx(tx, taxableStayAmount);
      const newGrand = parseFloat((newSubtotal + tax.totalTax).toFixed(2));
      finalGrand = newGrand;
      const split = await computeBillingSplit(invoice.booking.billingRule, newGrand, Number(invoice.roomCharges), newExtra, newDiscount, tx);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { discountAmount: newDiscount, extraCharges: newExtra, subtotal: newSubtotal, cgst: tax.cgst, sgst: tax.sgst, totalTax: tax.totalTax, grandTotal: newGrand, companyAmount: split.companyAmount, guestAmount: split.guestAmount, pendingAmount: split.guestAmount - Number(invoice.amountPaid) },
      });

      // Update company outstanding balance if corporate billing is active and invoice was already finalized
      if (invoice.isFinalized && invoice.booking.companyId && invoice.booking.billingRule !== 'GUEST') {
        const companyDiff = split.companyAmount - Number(invoice.companyAmount);
        if (companyDiff > 0) {
          await tx.company.update({ where: { id: invoice.booking.companyId }, data: { outstandingBalance: { increment: companyDiff } } });
        } else if (companyDiff < 0) {
          await tx.company.update({ where: { id: invoice.booking.companyId }, data: { outstandingBalance: { decrement: Math.abs(companyDiff) } } });
        }
      }
    });

    await createAuditLog({ action: 'INVOICE_ADJUSTMENT', entity: 'invoice', entityId: invoice.id, details: `${data.type}: ₹${adjustedAmount} — ${data.reason}${invoice.isFinalized ? ' (Post-checkout correction by MD)' : ''}`, userId: req.user!.id, oldValue: { extraCharges: Number(invoice.extraCharges), discountAmount: Number(invoice.discountAmount), grandTotal: Number(invoice.grandTotal) }, newValue: { extraCharges: newExtra, discountAmount: newDiscount, grandTotal: finalGrand } });
    const updated = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { adjustments: { include: { createdBy: { select: { name: true } } } } } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to add adjustment' });
  }
});

router.post('/:id/recalculate', requirePermission('payment.manage', 'MD'), async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id as string }, include: { booking: true } }) as any;
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    const booking = invoice.booking;
    const checkoutDate = booking.actualCheckout || booking.expectedCheckout;
    const nights = computeCalendarNightsIST(new Date(booking.checkInDate), new Date(checkoutDate));
    const roomCharges = Number(booking.roomPrice) * nights;

    const roomOrders = await prisma.order.findMany({ where: { roomId: booking.roomId, status: 'COMPLETED', createdAt: { gte: booking.checkInDate } }, include: { items: { where: { isCancelled: false } } } });
    const foodCharges = roomOrders.reduce((sum, o) => sum + Number(o.total), 0);

    let updated;
    await prisma.$transaction(async (tx) => {
      const newSubtotal = roomCharges + foodCharges + Number(invoice.extraCharges) - Number(invoice.discountAmount);
      const taxableStayAmount = roomCharges + Number(invoice.extraCharges) - Number(invoice.discountAmount);
      const tax = await calculateTaxWithTx(tx, taxableStayAmount);
      const newGrand = parseFloat((newSubtotal + tax.totalTax).toFixed(2));
      const split = await computeBillingSplit(booking.billingRule, newGrand, roomCharges, Number(invoice.extraCharges), Number(invoice.discountAmount), tx);

      updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: { roomCharges, foodCharges, subtotal: newSubtotal, cgst: tax.cgst, sgst: tax.sgst, totalTax: tax.totalTax, grandTotal: newGrand, companyAmount: split.companyAmount, guestAmount: split.guestAmount, pendingAmount: split.guestAmount - Number(invoice.amountPaid) },
      });

      if (invoice.companyId && (booking.status === 'CHECKED_OUT' || booking.status === 'COMPLETED')) {
        const diff = split.companyAmount - Number(invoice.companyAmount);
        if (diff > 0) { await tx.company.update({ where: { id: invoice.companyId }, data: { outstandingBalance: { increment: diff } } }); }
        else if (diff < 0) { await tx.company.update({ where: { id: invoice.companyId }, data: { outstandingBalance: { decrement: Math.abs(diff) } } }); }
      }
    });


    await (createAuditLog as any)({ action: 'RECALCULATE_INVOICE', entity: 'invoice', entityId: invoice.id, details: 'Recalculated invoice amounts', userId: (req as any).user!.id, oldValue: { subtotal: Number(invoice.subtotal), grandTotal: Number(invoice.grandTotal) }, newValue: { subtotal: Number((updated as any).subtotal), grandTotal: Number((updated as any).grandTotal) } });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: 'Recalculation failed' }); }
});

export default router;
