import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

const router = Router();
router.use(authenticate);

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
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

// GET /api/invoices/booking/:bookingId
router.get('/booking/:bookingId', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { bookingId: req.params.bookingId },
      include: {
        booking: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            payments: { include: { createdBy: { select: { name: true } } } },
          },
        },
        adjustments: { include: { createdBy: { select: { name: true } } } },
      },
    });
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    // Also get all room orders linked to this stay
    const roomOrders = await prisma.order.findMany({
      where: {
        roomId: invoice.booking.roomId,
        status: 'COMPLETED',
        createdAt: { gte: invoice.booking.checkInDate }
      },
      include: { items: { where: { isCancelled: false }, include: { menuItem: true } } },
    });
    res.json({ ...invoice, roomOrders });
  } catch { res.status(500).json({ error: 'Failed to fetch invoice' }); }
});

// POST /api/invoices/:id/adjustments — add discount or extra charge
router.post('/:id/adjustments', authorize('ADMIN', 'RECEPTION'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      type: z.enum(['DISCOUNT_FLAT', 'DISCOUNT_PERCENT', 'EXTRA_CHARGE']),
      amount: z.number().positive(),
      reason: z.string().min(1),
    }).parse(req.body);

    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id as string },
      include: { booking: true },
    }) as any;
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
    if (invoice.isFinalized) { res.status(400).json({ error: 'Invoice is finalized' }); return; }

    let adjustedAmount = data.amount;
    if (data.type === 'DISCOUNT_PERCENT') {
      adjustedAmount = parseFloat(((data.amount / 100) * Number(invoice.subtotal)).toFixed(2));
    }

    let newDiscount = Number(invoice.discountAmount);
    let newExtra = Number(invoice.extraCharges);
    if (data.type === 'EXTRA_CHARGE') {
      newExtra += adjustedAmount;
    } else {
      newDiscount += adjustedAmount;
    }

    const newSubtotal = Number(invoice.roomCharges) + Number(invoice.foodCharges) + newExtra - newDiscount;
    const taxableStayAmount = Number(invoice.roomCharges) + newExtra - newDiscount;

    const newCgst = parseFloat((taxableStayAmount * 0.06).toFixed(2));
    const newSgst = parseFloat((taxableStayAmount * 0.06).toFixed(2));
    const newTax = newCgst + newSgst;
    const newGrand = parseFloat((newSubtotal + newTax).toFixed(2));
    const paid = Number(invoice.amountPaid);

    let companyAmount = 0;
    let guestAmount = 0;

    if (invoice.booking.billingRule === 'COMPANY_ALL') {
      companyAmount = newGrand;
      guestAmount = 0;
    } else if (invoice.booking.billingRule === 'COMPANY_ROOM_ONLY') {
      const roomCharges = Number(invoice.roomCharges);
      const roomSubtotal = roomCharges + newExtra - newDiscount;
      const roomCgst = parseFloat((roomSubtotal * 0.06).toFixed(2));
      const roomSgst = parseFloat((roomSubtotal * 0.06).toFixed(2));
      const roomTax = roomCgst + roomSgst;
      companyAmount = parseFloat((roomSubtotal + roomTax).toFixed(2));
      guestAmount = Math.max(0, parseFloat((newGrand - companyAmount).toFixed(2)));
    } else {
      companyAmount = 0;
      guestAmount = newGrand;
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceAdjustment.create({
        data: { invoiceId: invoice.id, type: data.type, amount: adjustedAmount, reason: data.reason, createdById: req.user!.id },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          discountAmount: newDiscount,
          extraCharges: newExtra,
          subtotal: newSubtotal,
          cgst: newCgst,
          sgst: newSgst,
          totalTax: newTax,
          grandTotal: newGrand,
          companyAmount,
          guestAmount,
          pendingAmount: guestAmount - paid
        },
      });
    });

    await createAuditLog({ action: 'INVOICE_ADJUSTMENT', entity: 'invoice', entityId: invoice.id, details: `${data.type}: ₹${adjustedAmount} — ${data.reason}`, userId: req.user!.id });
    const updated = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { adjustments: { include: { createdBy: { select: { name: true } } } } } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to add adjustment' });
  }
});

// POST /api/invoices/:id/recalculate — force recalculate totals
router.post('/:id/recalculate', authorize('ADMIN', 'RECEPTION'), async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id as string }, include: { booking: true } }) as any;
    if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

    // Recalculate room charges based on actual nights
    const booking = invoice.booking;
    const checkoutDate = booking.actualCheckout || booking.expectedCheckout;
    const nights = Math.max(1, Math.ceil((new Date(checkoutDate).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
    const roomCharges = Number(booking.roomPrice) * nights;

    const roomOrders = await prisma.order.findMany({
      where: { roomId: booking.roomId, status: 'COMPLETED', createdAt: { gte: booking.checkInDate } },
      include: { items: { where: { isCancelled: false } } },
    });
    const foodCharges = roomOrders.reduce((sum, o) => sum + Number(o.total), 0);

    const newSubtotal = roomCharges + foodCharges + Number(invoice.extraCharges) - Number(invoice.discountAmount);
    const taxableStayAmount = roomCharges + Number(invoice.extraCharges) - Number(invoice.discountAmount);
    const newCgst = parseFloat((taxableStayAmount * 0.06).toFixed(2));
    const newSgst = parseFloat((taxableStayAmount * 0.06).toFixed(2));
    const newTax = newCgst + newSgst;
    const newGrand = parseFloat((newSubtotal + newTax).toFixed(2));
    const paid = Number(invoice.amountPaid);

    let companyAmount = 0;
    let guestAmount = 0;

    if (booking.billingRule === 'COMPANY_ALL') {
      companyAmount = newGrand;
      guestAmount = 0;
    } else if (booking.billingRule === 'COMPANY_ROOM_ONLY') {
      const roomSubtotal = roomCharges + Number(invoice.extraCharges) - Number(invoice.discountAmount);
      const roomCgst = parseFloat((roomSubtotal * 0.06).toFixed(2));
      const roomSgst = parseFloat((roomSubtotal * 0.06).toFixed(2));
      const roomTax = roomCgst + roomSgst;
      companyAmount = parseFloat((roomSubtotal + roomTax).toFixed(2));
      guestAmount = Math.max(0, parseFloat((newGrand - companyAmount).toFixed(2)));
    } else {
      companyAmount = 0;
      guestAmount = newGrand;
    }

    let updated;
    await prisma.$transaction(async (tx) => {
      updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          roomCharges,
          foodCharges,
          subtotal: newSubtotal,
          cgst: newCgst,
          sgst: newSgst,
          totalTax: newTax,
          grandTotal: newGrand,
          companyAmount,
          guestAmount,
          pendingAmount: guestAmount - paid
        },
      });


      if (invoice.companyId && (booking.status === 'CHECKED_OUT' || booking.status === 'COMPLETED')) {
        const diff = companyAmount - Number(invoice.companyAmount);
        if (diff > 0) {
          await tx.company.update({
            where: { id: invoice.companyId },
            data: { outstandingBalance: { increment: diff } },
          });
        } else if (diff < 0) {
          await tx.company.update({
            where: { id: invoice.companyId },
            data: { outstandingBalance: { decrement: Math.abs(diff) } },
          });
        }
      }
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Recalculation failed' });
  }
});

export default router;
