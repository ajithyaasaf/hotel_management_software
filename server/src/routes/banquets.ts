import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { createAuditLog, generateBanquetNumber } from '../utils/helpers';
import { calculateTaxWithTx } from '../utils/tax';

const router = Router();
router.use(authenticate);

const banquetHallSchema = z.object({
  name: z.string().min(3),
  maxCapacity: z.number().int().positive(),
  baseRental: z.number().positive(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const banquetBookingSchema = z.object({
  guestName: z.string().min(3).refine(val => !/^\d+$/.test(val), { message: "Name cannot be just numbers" }),
  guestPhone: z.string().min(10),
  hallId: z.string().uuid(),
  eventDate: z.string().datetime(),
  slot: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM']),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  eventType: z.string().min(2),
  estimatedPax: z.number().int().positive(),
  hallRentalPrice: z.number().nonnegative(),
  perHeadFoodPrice: z.number().nonnegative().default(0),
  extraCharges: z.number().nonnegative().default(0),
  foodPreference: z.enum(['VEG', 'NON_VEG', 'BOTH', 'NONE']).default('NONE'),
  notes: z.string().optional().nullable(),
  advanceAmount: z.number().min(0).optional(),
  advanceMethod: z.enum(['CASH', 'UPI', 'CARD']).optional(),
});

// ─── HALLS ──────────────────────────────────────────────────

router.get('/halls', requirePermission('banquet.view', 'banquet.manage'), async (_req, res) => {
  try {
    const halls = await prisma.banquetHall.findMany({ orderBy: { name: 'asc' } });
    res.json(halls);
  } catch { res.status(500).json({ error: 'Failed to fetch banquet halls' }); }
});

router.post('/halls', requirePermission('banquet.manage'), async (req: AuthRequest, res) => {
  try {
    const data = banquetHallSchema.parse(req.body);
    const hall = await prisma.banquetHall.create({ data: {
      name: data.name,
      maxCapacity: data.maxCapacity,
      baseRental: data.baseRental,
      description: data.description || null,
      isActive: data.isActive ?? true,
    } });
    await createAuditLog({ action: 'CREATE_HALL', entity: 'banquetHall', entityId: hall.id, details: `Created hall ${hall.name}`, userId: req.user!.id });
    res.status(201).json(hall);
  } catch (err) { res.status(500).json({ error: 'Failed to create hall' }); }
});

router.put('/halls/:id', requirePermission('banquet.manage'), async (req: AuthRequest, res) => {
  try {
    const data = banquetHallSchema.partial().parse(req.body);
    const existing = await prisma.banquetHall.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: 'Hall not found' }); return; }
    const hall = await prisma.banquetHall.update({ where: { id: req.params.id as string }, data });
    await createAuditLog({ action: 'UPDATE_HALL', entity: 'banquetHall', entityId: hall.id, details: `Updated hall ${hall.name}`, userId: req.user!.id, oldValue: { name: existing.name, basePrice: Number(existing.basePrice), maxCapacity: existing.maxCapacity }, newValue: { name: hall.name, basePrice: Number(hall.basePrice), maxCapacity: hall.maxCapacity } });
    res.json(hall);
  } catch (err) { res.status(500).json({ error: 'Failed to update hall' }); }
});

// ─── BOOKINGS ───────────────────────────────────────────────

router.get('/', requirePermission('banquet.view', 'banquet.manage'), async (req, res) => {
  try {
    const { status, date } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (date) {
      const d = new Date(String(date));
      const next = new Date(d); next.setDate(d.getDate() + 1);
      where.eventDate = { gte: d, lt: next };
    }
    const bookings = await prisma.banquetBooking.findMany({ where, include: { guest: true, hall: true, createdBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(bookings);
  } catch { res.status(500).json({ error: 'Failed to fetch banquet bookings' }); }
});

router.get('/:id', requirePermission('banquet.view', 'banquet.manage'), async (req, res) => {
  try {
    const booking = await prisma.banquetBooking.findUnique({ where: { id: req.params.id as string }, include: { guest: true, hall: true, payments: { include: { createdBy: { select: { name: true } } } }, createdBy: { select: { name: true } } } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    res.json(booking);
  } catch { res.status(500).json({ error: 'Failed to fetch booking' }); }
});

router.post('/', requirePermission('banquet.manage'), async (req: AuthRequest, res) => {
  try {
    const data = banquetBookingSchema.parse(req.body);
    const hall = await prisma.banquetHall.findUnique({ where: { id: data.hallId } });
    if (!hall || !hall.isActive) { res.status(400).json({ error: 'Hall is not available' }); return; }
    if (data.estimatedPax > hall.maxCapacity) { res.status(400).json({ error: `Capacity exceeded (Max: ${hall.maxCapacity})` }); return; }

    const conflict = await prisma.banquetBooking.findFirst({
      where: { hallId: data.hallId, eventDate: new Date(data.eventDate), slot: data.slot, status: { in: ['PROVISIONAL', 'CONFIRMED'] } }
    });
    if (conflict) { res.status(400).json({ error: 'Hall is already booked for this slot' }); return; }

    const foodSubtotal = data.perHeadFoodPrice * data.estimatedPax;
    const subtotal = data.hallRentalPrice + foodSubtotal + data.extraCharges;

    const result = await prisma.$transaction(async (tx) => {
      let guest = await tx.guest.findFirst({ where: { phone: data.guestPhone } });
      if (!guest) { guest = await tx.guest.create({ data: { name: data.guestName, phone: data.guestPhone } }); }
      
      const tax = await calculateTaxWithTx(tx, subtotal);
      const totalAmount = parseFloat((subtotal + tax.totalTax).toFixed(2));

      const booking = await tx.banquetBooking.create({
        data: {
          bookingNumber: generateBanquetNumber(),
          guestId: guest.id, hallId: data.hallId, createdById: req.user!.id,
          eventDate: new Date(data.eventDate), slot: data.slot,
          startTime: data.startTime ? new Date(data.startTime) : null,
          endTime: data.endTime ? new Date(data.endTime) : null,
          status: 'PROVISIONAL', eventType: data.eventType, estimatedPax: data.estimatedPax,
          hallRentalPrice: data.hallRentalPrice, perHeadFoodPrice: data.perHeadFoodPrice,
          extraCharges: data.extraCharges, subtotal, cgst: tax.cgst, sgst: tax.sgst, totalAmount,
          advancePaid: 0, pendingAmount: totalAmount,
          notes: data.notes, foodPreference: data.foodPreference
        },
        include: { guest: true, hall: true }
      });

      if (data.advanceAmount && data.advanceAmount > 0) {
        await tx.banquetPayment.create({ data: { bookingId: booking.id, amount: data.advanceAmount, method: data.advanceMethod || 'CASH', type: 'ADVANCE', createdById: req.user!.id } });
        await tx.banquetBooking.update({ where: { id: booking.id }, data: { advancePaid: data.advanceAmount, pendingAmount: { decrement: data.advanceAmount } } });
      }
      return booking;
    });

    await createAuditLog({ action: 'CREATE_BANQUET', entity: 'banquetBooking', entityId: result.id, details: `${result.eventType} for ${data.guestName}`, userId: req.user!.id });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

router.put('/:id/confirm', requirePermission('banquet.manage'), async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.banquetBooking.findUnique({ where: { id: req.params.id as string } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'PROVISIONAL') { res.status(400).json({ error: 'Can only confirm provisional bookings' }); return; }
    
    // Check for mandatory advance payment
    if (Number(booking.advancePaid) <= 0) { res.status(400).json({ error: 'Cannot confirm booking without an advance payment' }); return; }

    const updated = await prisma.banquetBooking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } });
    await createAuditLog({ action: 'CONFIRM_BANQUET', entity: 'banquetBooking', entityId: booking.id, details: 'Booking confirmed', userId: req.user!.id, oldValue: { status: booking.status }, newValue: { status: 'CONFIRMED' } });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Failed to confirm booking' }); }
});

router.put('/:id/cancel', requirePermission('banquet.manage'), async (req: AuthRequest, res) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1, "Cancellation reason is required") }).parse(req.body);
    const booking = await prisma.banquetBooking.findUnique({ where: { id: req.params.id as string } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') { res.status(400).json({ error: 'Cannot cancel this booking' }); return; }

    const updated = await prisma.banquetBooking.update({ where: { id: booking.id }, data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: new Date() } });
    await createAuditLog({ action: 'CANCEL_BANQUET', entity: 'banquetBooking', entityId: booking.id, details: `Cancelled. Reason: ${reason}`, userId: req.user!.id, oldValue: { status: booking.status }, newValue: { status: 'CANCELLED' } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

router.put('/:id/complete', requirePermission('banquet.manage'), async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.banquetBooking.findUnique({ where: { id: req.params.id as string } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'CONFIRMED') { res.status(400).json({ error: 'Only confirmed bookings can be completed' }); return; }
    const updated = await prisma.banquetBooking.update({ where: { id: booking.id }, data: { status: 'COMPLETED' } });
    await createAuditLog({ action: 'COMPLETE_BANQUET', entity: 'banquetBooking', entityId: booking.id, details: 'Event completed', userId: req.user!.id, oldValue: { status: booking.status }, newValue: { status: 'COMPLETED' } });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Failed to complete booking' }); }
});

router.post('/:id/payments', requirePermission('banquet.manage', 'payment.manage'), async (req: AuthRequest, res) => {
  try {
    const { amount, method, reference, notes } = z.object({ amount: z.number().positive(), method: z.enum(['CASH', 'UPI', 'CARD']), reference: z.string().optional(), notes: z.string().optional() }).parse(req.body);
    const booking = await prisma.banquetBooking.findUnique({ where: { id: req.params.id as string } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }

    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.banquetPayment.create({ data: { bookingId: booking.id, amount, method, type: 'SETTLEMENT', reference, notes, createdById: req.user!.id } });
      await tx.banquetBooking.update({ where: { id: booking.id }, data: { pendingAmount: { decrement: amount } } });
      return p;
    });

    await createAuditLog({ action: 'BANQUET_PAYMENT', entity: 'banquetBooking', entityId: booking.id, details: `Settlement of ₹${amount} via ${method}`, userId: req.user!.id });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

export default router;