import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog, generateBanquetNumber } from '../utils/helpers';

const router = Router();
router.use(authenticate);

// ─── TAX RATES (shared with room bookings) ────────────────
const CGST_RATE = 0.06;
const SGST_RATE = 0.06;

// ─── VALIDATION SCHEMAS ───────────────────────────────────

const createHallSchema = z.object({
  name: z.string().min(2),
  maxCapacity: z.number().int().positive(),
  baseRental: z.number().nonnegative(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createBookingSchema = z.object({
  // Guest
  guestPhone: z.string().min(10),
  guestName: z.string().min(2),
  // Hall & Scheduling
  hallId: z.string().uuid(),
  eventDate: z.string().date(),          // "YYYY-MM-DD"
  slot: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM']),
  startTime: z.string().optional().nullable(),   // ISO datetime — required when CUSTOM
  endTime: z.string().optional().nullable(),     // ISO datetime — required when CUSTOM
  // Event Details
  eventType: z.string().min(2),
  estimatedPax: z.number().int().positive(),
  foodPreference: z.enum(['VEG', 'NON_VEG', 'BOTH', 'NONE']).optional().default('NONE'),
  // Pricing
  hallRentalPrice: z.number().nonnegative(),
  perHeadFoodPrice: z.number().nonnegative().default(0),
  extraCharges: z.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  // Advance deposit
  advanceAmount: z.number().nonnegative().default(0),
  advanceMethod: z.enum(['CASH', 'UPI', 'CARD']).optional().default('CASH'),
  advanceReference: z.string().optional().nullable(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'UPI', 'CARD']),
  type: z.enum(['ADVANCE', 'SETTLEMENT', 'REFUND']),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ─── HELPER: Slot conflict check ─────────────────────────

/**
 * Returns true if the given slot is available for the given hall on the given date.
 * Rules:
 *  - FULL / CUSTOM (custom-hour) blocks: treated per-time overlap
 *  - MORNING, AFTERNOON, EVENING are mutually exclusive per slot per day
 *  - A CUSTOM booking using hours must be checked for time overlap against all active bookings on that day
 */
async function checkSlotAvailability(
  hallId: string,
  eventDate: string,
  slot: string,
  startTime?: string | null,
  endTime?: string | null,
  excludeBookingId?: string,
) {
  const dayStart = new Date(`${eventDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${eventDate}T23:59:59.999Z`);

  const existing = await prisma.banquetBooking.findMany({
    where: {
      hallId,
      eventDate: { gte: dayStart, lte: dayEnd },
      status: { in: ['PROVISIONAL', 'CONFIRMED'] },
      ...(excludeBookingId ? { NOT: { id: excludeBookingId } } : {}),
    },
  });

  if (slot !== 'CUSTOM') {
    // Named slots are exclusive — if any booking has the same slot, conflict
    return !existing.some(b => b.slot === slot);
  }

  // CUSTOM slot: check for exact time overlap with any booking on that day
  if (!startTime || !endTime) return false; // guard
  const newStart = new Date(startTime).getTime();
  const newEnd = new Date(endTime).getTime();

  return !existing.some(b => {
    if (b.slot !== 'CUSTOM' || !b.startTime || !b.endTime) return false; // named slots don't overlap CUSTOM in time checks
    const s = new Date(b.startTime).getTime();
    const e = new Date(b.endTime).getTime();
    return newStart < e && newEnd > s; // standard overlap formula
  });
}

// ─── BANQUET HALLS ────────────────────────────────────────

// GET /api/banquets/halls
router.get('/halls', async (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    const halls = await prisma.banquetHall.findMany({
      where: showAll ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json(halls);
  } catch {
    res.status(500).json({ error: 'Failed to fetch banquet halls' });
  }
});

// GET /api/banquets/halls/:id
router.get('/halls/:id', async (req, res) => {
  try {
    const hall = await prisma.banquetHall.findUnique({ where: { id: req.params.id } });
    if (!hall) return res.status(404).json({ error: 'Hall not found' });
    res.json(hall);
  } catch {
    res.status(500).json({ error: 'Failed to fetch hall' });
  }
});

// POST /api/banquets/halls  (Admin only)
router.post('/halls', async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  const parsed = createHallSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  try {
    const hall = await prisma.banquetHall.create({
      data: {
        name: parsed.data.name,
        maxCapacity: parsed.data.maxCapacity,
        baseRental: parsed.data.baseRental,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
      }
    });
    await createAuditLog({ action: 'CREATE_BANQUET_HALL', entity: 'BanquetHall', entityId: hall.id, userId: req.user!.id });
    res.status(201).json(hall);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'A hall with that name already exists' });
    res.status(500).json({ error: 'Failed to create hall' });
  }
});

// PUT /api/banquets/halls/:id  (Admin only)
router.put('/halls/:id', async (req: AuthRequest, res) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  const parsed = createHallSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  try {
    const hall = await prisma.banquetHall.update({ where: { id: req.params.id }, data: parsed.data });
    await createAuditLog({ action: 'UPDATE_BANQUET_HALL', entity: 'BanquetHall', entityId: hall.id, userId: req.user!.id });
    res.json(hall);
  } catch {
    res.status(500).json({ error: 'Failed to update hall' });
  }
});

// ─── BANQUET BOOKINGS ─────────────────────────────────────

// GET /api/banquets/bookings
router.get('/bookings', async (req, res) => {
  try {
    const { status, date, hallId } = req.query as Record<string, string>;
    const where: any = {};
    if (status) where.status = status;
    if (hallId) where.hallId = hallId;
    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      where.eventDate = { gte: dayStart, lte: dayEnd };
    }
    const bookings = await prisma.banquetBooking.findMany({
      where,
      include: {
        guest: true,
        hall: true,
        payments: { orderBy: { createdAt: 'asc' } },
        createdBy: { select: { name: true } },
      },
      orderBy: { eventDate: 'desc' },
      take: 200,
    });
    res.json(bookings);
  } catch {
    res.status(500).json({ error: 'Failed to fetch banquet bookings' });
  }
});

// GET /api/banquets/bookings/availability?hallId=&date=
router.get('/bookings/availability', async (req, res) => {
  try {
    const { hallId, date } = req.query as Record<string, string>;
    if (!hallId || !date) return res.status(400).json({ error: 'hallId and date are required' });

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const existing = await prisma.banquetBooking.findMany({
      where: {
        hallId,
        eventDate: { gte: dayStart, lte: dayEnd },
        status: { in: ['PROVISIONAL', 'CONFIRMED'] },
      },
      select: { slot: true, startTime: true, endTime: true, status: true, estimatedPax: true },
    });

    const slots = ['MORNING', 'AFTERNOON', 'EVENING'];
    const availability = slots.map(slot => ({
      slot,
      available: !existing.some(b => b.slot === slot),
    }));

    res.json({ availability, customBookings: existing.filter(b => b.slot === 'CUSTOM') });
  } catch {
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// GET /api/banquets/bookings/:id
router.get('/bookings/:id', async (req, res) => {
  try {
    const booking = await prisma.banquetBooking.findUnique({
      where: { id: req.params.id },
      include: {
        guest: true,
        hall: true,
        payments: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
        createdBy: { select: { name: true } },
      },
    });
    if (!booking) return res.status(404).json({ error: 'Banquet booking not found' });
    res.json(booking);
  } catch {
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// POST /api/banquets/bookings — Create new event reservation
router.post('/bookings', async (req: AuthRequest, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const data = parsed.data;
  if (data.foodPreference === 'NONE' && data.perHeadFoodPrice !== 0) {
    return res.status(400).json({ error: 'Per-head food price must be 0 if no catering is selected.' });
  }
  if (data.foodPreference !== 'NONE' && data.perHeadFoodPrice <= 0) {
    return res.status(400).json({ error: 'Per-head food price must be greater than 0 if catering is selected.' });
  }

  try {
    // 1. Past Date check
    const config = await prisma.systemConfig.findUnique({ where: { key: 'BUSINESS_DATE' } });
    const businessDateStr = config?.value || new Date().toISOString().split('T')[0];
    if (data.eventDate < businessDateStr) {
      return res.status(400).json({
        error: `Event date cannot be in the past. Current business date is ${businessDateStr}.`,
      });
    }

    // 2. Fetch hall
    const hall = await prisma.banquetHall.findUnique({ where: { id: data.hallId } });
    if (!hall || !hall.isActive) return res.status(404).json({ error: 'Banquet hall not found or inactive' });

    // 3. CUSTOM slot hour validation — minimum 4 hours
    if (data.slot === 'CUSTOM') {
      if (!data.startTime || !data.endTime) {
        return res.status(400).json({ error: 'Start time and end time are required for custom (hourly) bookings.' });
      }
      const durationHours = (new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / (1000 * 60 * 60);
      if (durationHours < 4) {
        return res.status(400).json({ error: 'Custom bookings must have a minimum duration of 4 hours.' });
      }
    }

    // 4. Slot conflict check
    const isAvailable = await checkSlotAvailability(
      data.hallId, data.eventDate, data.slot,
      data.startTime, data.endTime,
    );
    if (!isAvailable) {
      return res.status(409).json({
        error: `The ${data.slot.toLowerCase()} slot for this hall on ${data.eventDate} is already booked. Please choose a different slot or date.`,
      });
    }

    // 5. Resolve or upsert guest
    let guest = await prisma.guest.findUnique({ where: { phone: data.guestPhone } });
    if (!guest) {
      guest = await prisma.guest.create({
        data: { name: data.guestName, phone: data.guestPhone },
      });
    }

    // 6. Calculate billing
    const subtotal = data.hallRentalPrice + (data.perHeadFoodPrice * data.estimatedPax) + data.extraCharges;
    const cgst = parseFloat((subtotal * CGST_RATE).toFixed(2));
    const sgst = parseFloat((subtotal * SGST_RATE).toFixed(2));
    const totalAmount = parseFloat((subtotal + cgst + sgst).toFixed(2));
    const initialAdvance = data.advanceAmount || 0;
    const pendingAmount = parseFloat((totalAmount - initialAdvance).toFixed(2));

    // 7. Create booking + optional advance payment in a transaction
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.banquetBooking.create({
        data: {
          bookingNumber: generateBanquetNumber(),
          guestId: guest!.id,
          hallId: data.hallId,
          createdById: req.user!.id,
          eventDate: new Date(`${data.eventDate}T00:00:00.000Z`),
          slot: data.slot,
          startTime: data.startTime ? new Date(data.startTime) : null,
          endTime: data.endTime ? new Date(data.endTime) : null,
          eventType: data.eventType,
          estimatedPax: data.estimatedPax,
          hallRentalPrice: data.hallRentalPrice,
          perHeadFoodPrice: data.perHeadFoodPrice,
          extraCharges: data.extraCharges,
          subtotal,
          cgst,
          sgst,
          totalAmount,
          advancePaid: initialAdvance,
          pendingAmount,
          notes: data.notes,
          foodPreference: data.foodPreference,
        },
        include: { guest: true, hall: true },
      });

      if (initialAdvance > 0) {
        await tx.banquetPayment.create({
          data: {
            bookingId: newBooking.id,
            amount: initialAdvance,
            method: data.advanceMethod as any,
            type: 'ADVANCE',
            reference: data.advanceReference,
            notes: 'Booking deposit',
            createdById: req.user!.id,
          },
        });
      }

      return newBooking;
    });

    await createAuditLog({
      action: 'CREATE_BANQUET_BOOKING',
      entity: 'BanquetBooking',
      entityId: booking.id,
      details: `Hall: ${hall.name}, Event: ${data.eventType}, Date: ${data.eventDate}`,
      userId: req.user!.id,
    });

    res.status(201).json(booking);
  } catch (e: any) {
    console.error('Banquet booking error:', e);
    res.status(500).json({ error: 'Failed to create banquet booking' });
  }
});

// PUT /api/banquets/bookings/:id/confirm — Confirm provisional booking
router.put('/bookings/:id/confirm', async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.banquetBooking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'PROVISIONAL') return res.status(400).json({ error: 'Only PROVISIONAL bookings can be confirmed' });

    const updated = await prisma.banquetBooking.update({
      where: { id: req.params.id },
      data: { status: 'CONFIRMED' },
      include: { guest: true, hall: true, payments: true },
    });

    await createAuditLog({ action: 'CONFIRM_BANQUET_BOOKING', entity: 'BanquetBooking', entityId: booking.id, userId: req.user!.id });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to confirm booking' });
  }
});

// PUT /api/banquets/bookings/:id/complete — Mark event as completed
router.put('/bookings/:id/complete', async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.banquetBooking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'CONFIRMED') return res.status(400).json({ error: 'Only CONFIRMED bookings can be completed' });

    const updated = await prisma.banquetBooking.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' },
      include: { guest: true, hall: true, payments: true },
    });

    await createAuditLog({ action: 'COMPLETE_BANQUET_BOOKING', entity: 'BanquetBooking', entityId: booking.id, userId: req.user!.id });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to complete booking' });
  }
});

// PUT /api/banquets/bookings/:id/cancel — Cancel event
router.put('/bookings/:id/cancel', async (req: AuthRequest, res) => {
  const { reason } = req.body;
  try {
    const booking = await prisma.banquetBooking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      return res.status(400).json({ error: `Cannot cancel a ${booking.status} booking` });
    }

    const updated = await prisma.banquetBooking.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED', cancelReason: reason || null, cancelledAt: new Date() },
      include: { guest: true, hall: true, payments: true },
    });

    await createAuditLog({
      action: 'CANCEL_BANQUET_BOOKING',
      entity: 'BanquetBooking',
      entityId: booking.id,
      details: reason || 'No reason provided',
      userId: req.user!.id,
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// POST /api/banquets/bookings/:id/payments — Record advance / settlement / refund
router.post('/bookings/:id/payments', async (req: AuthRequest, res) => {
  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const data = parsed.data;

  try {
    const booking = await prisma.banquetBooking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot record payments on a cancelled booking' });

    // Update running balance
    const isRefund = data.type === 'REFUND';
    const newAdvancePaid = isRefund
      ? Math.max(0, Number(booking.advancePaid) - data.amount)
      : Number(booking.advancePaid) + data.amount;
    const newPending = Number(booking.totalAmount) - newAdvancePaid;

    const [payment] = await prisma.$transaction([
      prisma.banquetPayment.create({
        data: {
          bookingId: booking.id,
          amount: data.amount,
          method: data.method,
          type: data.type,
          reference: data.reference,
          notes: data.notes,
          createdById: req.user!.id,
        },
      }),
      prisma.banquetBooking.update({
        where: { id: booking.id },
        data: { advancePaid: newAdvancePaid, pendingAmount: newPending },
      }),
    ]);

    await createAuditLog({
      action: `BANQUET_${data.type}`,
      entity: 'BanquetBooking',
      entityId: booking.id,
      details: `₹${data.amount} via ${data.method}`,
      userId: req.user!.id,
    });

    res.status(201).json(payment);
  } catch {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

export default router;
