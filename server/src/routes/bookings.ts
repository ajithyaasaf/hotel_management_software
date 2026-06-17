import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog, generateBookingNumber } from '../utils/helpers';
import { uploadToCloudinary } from '../utils/cloudinary';

const router = Router();
router.use(authenticate);

const createBookingSchema = z.object({
  guestName: z.string().min(3).refine(val => !/^\d+$/.test(val), { message: "Name cannot be just numbers" }),
  guestPhone: z.string().min(10),
  guestEmail: z.string().email().optional().nullable(),
  idProofType: z.string().optional().nullable(),
  idProofNumber: z.string().optional().nullable(),
  idProofImage: z.string().optional().nullable(),
  roomId: z.string().uuid(),
  checkInDate: z.string().datetime(),
  expectedCheckout: z.string().datetime(),
  roomPrice: z.number().positive(),
  numberOfGuests: z.number().int().min(1).default(1),
  specialRequests: z.string().optional().nullable(),
  advanceAmount: z.number().min(0).optional(),
  advanceMethod: z.enum(['CASH', 'UPI', 'CARD', 'BTC']).optional(),
  companyId: z.string().uuid().optional().nullable(),
  billingRule: z.enum(['GUEST', 'COMPANY_ROOM_ONLY', 'COMPANY_ALL']).default('GUEST'),
});

// GET /api/bookings
router.get('/', async (req, res) => {
  try {
    const status = req.query.status as any;
    const date = req.query.date as any;
    const where: any = {};
    if (status) where.status = status;
    if (date) {
      const d = new Date(String(date));
      const next = new Date(d); next.setDate(d.getDate() + 1);
      where.checkInDate = { gte: d, lt: next };
    }
    const bookings = await prisma.booking.findMany({
      where,
      include: { guest: true, room: { include: { roomType: true } }, invoice: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(bookings);
  } catch { res.status(500).json({ error: 'Failed to fetch bookings' }); }
});

// GET /api/bookings/active
router.get('/active', async (_req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      include: { guest: true, room: { include: { roomType: true } } },
      orderBy: { checkInDate: 'asc' },
    });
    res.json(bookings);
  } catch { res.status(500).json({ error: 'Failed to fetch active bookings' }); }
});

// GET /api/bookings/:id
router.get('/:id', async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as any },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        company: true,
        invoice: { include: { adjustments: { include: { createdBy: { select: { name: true } } } } } },
        payments: { include: { createdBy: { select: { name: true } } } },
        transfers: { include: { fromRoom: true, toRoom: true } },
      },
    });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    res.json(booking);
  } catch { res.status(500).json({ error: 'Failed to fetch booking' }); }
});

// POST /api/bookings — create booking + check-in
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createBookingSchema.parse(req.body);

    if (data.billingRule !== 'GUEST' && !data.companyId) {
      res.status(400).json({ error: 'Company must be specified for corporate billing rules' });
      return;
    }

    if (data.companyId) {
      const companyExists = await prisma.company.findUnique({ where: { id: data.companyId } });
      if (!companyExists) {
        res.status(404).json({ error: 'Selected corporate company does not exist' });
        return;
      }
    }

    // Validate room availability
    const room = await prisma.room.findUnique({ where: { id: data.roomId } });
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
    if (room.status === 'BLOCKED') { res.status(400).json({ error: 'Room is blocked' }); return; }
    if (room.status === 'OCCUPIED') { res.status(400).json({ error: 'Room is already occupied' }); return; }
    if (room.status === 'CLEANING') { res.status(400).json({ error: 'Room is being cleaned' }); return; }

    // Check for overlapping active bookings
    const checkIn = new Date(data.checkInDate);
    const checkOut = new Date(data.expectedCheckout);
    const conflict = await prisma.booking.findFirst({
      where: {
        roomId: data.roomId,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        // Simple date overlap check
        AND: [
          { checkInDate: { lt: checkOut } },
          { expectedCheckout: { gt: checkIn } }
        ]
      },
    });
    if (conflict) { res.status(400).json({ error: 'This room is already booked/occupied during the selected dates. Please choose another room or change the dates.' }); return; }

    const config = await prisma.systemConfig.findUnique({
      where: { key: 'BUSINESS_DATE' },
    });
    const businessDateStr = config?.value || new Date().toISOString().split('T')[0];

    const today = new Date(businessDateStr);
    today.setHours(0,0,0,0);
    const inDate = new Date(data.checkInDate);
    inDate.setHours(0,0,0,0);
    const isAdvance = inDate > today;
    const initialStatus = isAdvance ? 'CONFIRMED' : 'CHECKED_IN';

    let idProofUrl: string | undefined = undefined;
    if (data.idProofImage) {
      idProofUrl = await uploadToCloudinary(data.idProofImage);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Upsert guest
      let guest = await tx.guest.findFirst({ where: { phone: data.guestPhone } });
      if (!guest) {
        guest = await tx.guest.create({
          data: {
            name: data.guestName,
            phone: data.guestPhone,
            email: data.guestEmail,
            idProofType: data.idProofType,
            idProofNumber: data.idProofNumber,
            idProofUrl: idProofUrl || null,
            visitCount: 1,
          },
        });
      } else {
        guest = await tx.guest.update({
          where: { id: guest.id },
          data: {
            name: data.guestName,
            visitCount: { increment: 1 },
            ...(data.idProofType && { idProofType: data.idProofType }),
            ...(data.idProofNumber && { idProofNumber: data.idProofNumber }),
            ...(idProofUrl && { idProofUrl }),
          },
        });
      }

      // Create booking
      const booking = await tx.booking.create({
        data: {
          bookingNumber: generateBookingNumber(),
          guestId: guest.id,
          roomId: data.roomId,
          status: initialStatus,
          checkInDate: new Date(data.checkInDate),
          expectedCheckout: new Date(data.expectedCheckout),
          roomPrice: data.roomPrice,
          numberOfGuests: data.numberOfGuests,
          specialRequests: data.specialRequests,
          createdById: req.user!.id,
          companyId: data.companyId || null,
          billingRule: data.billingRule || 'GUEST',
        },
        include: { guest: true, room: { include: { roomType: true } }, company: true },
      });

      // Mark room occupied only if it's checking in today
      if (!isAdvance) {
        await tx.room.update({ where: { id: data.roomId }, data: { status: 'OCCUPIED' } });
      }

      // Create invoice skeleton
      const nights = Math.max(
        1,
        Math.ceil(
          (new Date(data.expectedCheckout).getTime() - new Date(data.checkInDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
      const roomCharges = data.roomPrice * nights;
      const invoiceNum = `INV${Date.now()}`;

      const cgst = parseFloat((roomCharges * 0.06).toFixed(2));
      const sgst = parseFloat((roomCharges * 0.06).toFixed(2));
      const totalTax = cgst + sgst;
      const grandTotal = parseFloat((roomCharges + totalTax).toFixed(2));

      let companyAmount = 0;
      let guestAmount = 0;

      if (data.billingRule === 'COMPANY_ALL') {
        companyAmount = grandTotal;
        guestAmount = 0;
      } else if (data.billingRule === 'COMPANY_ROOM_ONLY') {
        companyAmount = parseFloat((roomCharges + totalTax).toFixed(2));
        guestAmount = 0;
      } else {
        companyAmount = 0;
        guestAmount = grandTotal;
      }

      await tx.invoice.create({
        data: {
          invoiceNumber: invoiceNum,
          bookingId: booking.id,
          roomCharges,
          subtotal: roomCharges,
          cgst,
          sgst,
          totalTax,
          grandTotal,
          companyId: data.companyId || null,
          companyAmount,
          guestAmount,
          pendingAmount: guestAmount,
          isBtc: data.billingRule !== 'GUEST',
        },
      });

      // Advance payment
      if (data.advanceAmount && data.advanceAmount > 0) {
        if (data.advanceMethod === 'BTC') {
          if (!data.companyId) {
            throw new Error('Cannot use BTC advance payment without a corporate account');
          }
          await tx.company.update({
            where: { id: data.companyId },
            data: {
              outstandingBalance: {
                increment: data.advanceAmount,
              },
            },
          });
        }

        await tx.payment.create({
          data: {
            bookingId: booking.id,
            amount: data.advanceAmount,
            method: data.advanceMethod || 'CASH',
            type: 'ADVANCE',
            createdById: req.user!.id,
          },
        });
        await tx.invoice.update({
          where: { bookingId: booking.id },
          data: {
            amountPaid: data.advanceAmount,
            pendingAmount: { decrement: data.advanceAmount },
          },
        });
      }

      return booking;
    });

    await createAuditLog({
      action: 'CHECKIN',
      entity: 'booking',
      entityId: result.id,
      details: `Guest ${data.guestName} checked into room ${room.roomNumber}`,
      userId: req.user!.id,
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PUT /api/bookings/:id/checkin
router.put('/:id/checkin', async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as any }, include: { room: true } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'CONFIRMED') { res.status(400).json({ error: 'Booking is not in CONFIRMED state' }); return; }
    if (booking.room.status !== 'AVAILABLE') { res.status(400).json({ error: 'Room is not currently available for check-in' }); return; }

    const config = await prisma.systemConfig.findUnique({
      where: { key: 'BUSINESS_DATE' },
    });
    const businessDateStr = config?.value || new Date().toISOString().split('T')[0];
    const checkInDate = new Date();
    const [year, month, day] = businessDateStr.split('-').map(Number);
    checkInDate.setFullYear(year);
    checkInDate.setMonth(month - 1);
    checkInDate.setDate(day);

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_IN', checkInDate } });
      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'OCCUPIED' } });
    });

    await createAuditLog({ action: 'CHECKIN', entity: 'booking', entityId: booking.id, details: `Guest checked in from advance booking`, userId: req.user!.id });
    res.json({ message: 'Checked in successfully' });
  } catch { res.status(500).json({ error: 'Check-in failed' }); }
});

// PUT /api/bookings/:id/extend — extend stay
router.put('/:id/extend', async (req: AuthRequest, res) => {
  try {
    const { newCheckout, newPrice } = z.object({
      newCheckout: z.string().datetime(),
      newPrice: z.number().positive().optional(),
    }).parse(req.body);

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as string },
      include: { invoice: true },
    }) as any;
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'CHECKED_IN') { res.status(400).json({ error: 'Booking is not active' }); return; }

    if (new Date(newCheckout) <= new Date(booking.checkInDate)) {
      res.status(400).json({ error: 'New checkout date must be after check-in date' }); return;
    }
    const price = newPrice ?? Number(booking.roomPrice);
    const nights = Math.max(1, Math.ceil(
      (new Date(newCheckout).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    ));
    const newRoomCharges = price * nights;

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: req.params.id as any },
        data: { expectedCheckout: new Date(newCheckout), ...(newPrice && { roomPrice: newPrice }) },
      });
      if (booking.invoice) {
        const paid = Number(booking.invoice.amountPaid);
        const foodCharges = Number(booking.invoice.foodCharges);
        const extraCharges = Number(booking.invoice.extraCharges);
        const discountAmount = Number(booking.invoice.discountAmount);
        
        const newSubtotal = newRoomCharges + foodCharges + extraCharges - discountAmount;
        const taxableStayAmount = newRoomCharges + extraCharges - discountAmount;
        const newCgst = parseFloat((taxableStayAmount * 0.06).toFixed(2));
        const newSgst = parseFloat((taxableStayAmount * 0.06).toFixed(2));
        const newTax = newCgst + newSgst;
        const newGrand = parseFloat((newSubtotal + newTax).toFixed(2));

        let companyAmount = 0;
        let guestAmount = 0;

        if (booking.billingRule === 'COMPANY_ALL') {
          companyAmount = newGrand;
          guestAmount = 0;
        } else if (booking.billingRule === 'COMPANY_ROOM_ONLY') {
          const roomSubtotal = newRoomCharges;
          const roomCgst = parseFloat((roomSubtotal * 0.06).toFixed(2));
          const roomSgst = parseFloat((roomSubtotal * 0.06).toFixed(2));
          const roomTax = roomCgst + roomSgst;
          companyAmount = parseFloat((roomSubtotal + roomTax).toFixed(2));
          guestAmount = Math.max(0, parseFloat((newGrand - companyAmount).toFixed(2)));
        } else {
          companyAmount = 0;
          guestAmount = newGrand;
        }

        await tx.invoice.update({
          where: { id: booking.invoice.id },
          data: {
            roomCharges: newRoomCharges,
            subtotal: newSubtotal,
            cgst: newCgst,
            sgst: newSgst,
            totalTax: newTax,
            grandTotal: newGrand,
            companyAmount,
            guestAmount,
            pendingAmount: guestAmount - paid,
          },
        });
      }
    });

    await createAuditLog({ action: 'EXTEND_STAY', entity: 'booking', entityId: req.params.id as string, details: `Extended to ${newCheckout}`, userId: req.user!.id });
    const updated = await prisma.booking.findUnique({ where: { id: req.params.id as any }, include: { guest: true, room: { include: { roomType: true } }, invoice: true } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to extend stay' });
  }
});

// PUT /api/bookings/:id/transfer — room transfer
router.put('/:id/transfer', async (req: AuthRequest, res) => {
  try {
    const { toRoomId, reason, newRoomPrice } = z.object({
      toRoomId: z.string().uuid(),
      reason: z.string().optional(),
      newRoomPrice: z.number().positive().optional(),
    }).parse(req.body);

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as any } });
    if (!booking || booking.status !== 'CHECKED_IN') { res.status(400).json({ error: 'Invalid booking' }); return; }

    const toRoom = await prisma.room.findUnique({ where: { id: toRoomId } });
    if (!toRoom || toRoom.status !== 'AVAILABLE') { res.status(400).json({ error: 'Target room not available' }); return; }

    await prisma.$transaction(async (tx) => {
      await tx.roomTransfer.create({
        data: {
          bookingId: booking.id,
          fromRoomId: booking.roomId,
          toRoomId,
          reason,
          newRoomPrice,
        },
      });
      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } });
      await tx.room.update({ where: { id: toRoomId }, data: { status: 'OCCUPIED' } });
      await tx.booking.update({
        where: { id: booking.id as any },
        data: { roomId: toRoomId, ...(newRoomPrice && { roomPrice: newRoomPrice }) },
      });
    });

    await createAuditLog({ action: 'ROOM_TRANSFER', entity: 'booking', entityId: booking.id, details: `Transferred from room ${booking.roomId} to ${toRoomId}`, userId: req.user!.id });
    const updated = await prisma.booking.findUnique({ where: { id: req.params.id as any }, include: { guest: true, room: { include: { roomType: true } } } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Room transfer failed' });
  }
});

// PUT /api/bookings/:id/checkout
router.put('/:id/checkout', async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as string },
      include: { invoice: true, room: true },
    }) as any;
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'CHECKED_IN') { res.status(400).json({ error: 'Booking not active' }); return; }

    const config = await prisma.systemConfig.findUnique({
      where: { key: 'BUSINESS_DATE' },
    });
    const businessDateStr = config?.value || new Date().toISOString().split('T')[0];
    const checkoutDate = new Date();
    const [year, month, day] = businessDateStr.split('-').map(Number);
    checkoutDate.setFullYear(year);
    checkoutDate.setMonth(month - 1);
    checkoutDate.setDate(day);

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_OUT', actualCheckout: checkoutDate } });
      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } });
      
      if (booking.invoice) {
        // Calculate nights based on checkInDate and actual checkout date
        const nights = Math.max(
          1,
          Math.ceil(
            (checkoutDate.getTime() - new Date(booking.checkInDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
        const roomCharges = Number(booking.roomPrice) * nights;

        // Sum F&B charges
        const roomOrders = await tx.order.findMany({
          where: { roomId: booking.roomId, status: { not: 'CANCELLED' }, createdAt: { gte: booking.checkInDate } },
          include: { items: { where: { isCancelled: false } } },
        });
        const foodCharges = roomOrders.reduce((sum, o) => sum + Number(o.total), 0);

        const newSubtotal = roomCharges + foodCharges + Number(booking.invoice.extraCharges) - Number(booking.invoice.discountAmount);
        const taxableStayAmount = roomCharges + Number(booking.invoice.extraCharges) - Number(booking.invoice.discountAmount);
        const newCgst = parseFloat((taxableStayAmount * 0.06).toFixed(2));
        const newSgst = parseFloat((taxableStayAmount * 0.06).toFixed(2));
        const newTax = newCgst + newSgst;
        const newGrand = parseFloat((newSubtotal + newTax).toFixed(2));

        let companyAmount = 0;
        let guestAmount = 0;

        if (booking.billingRule === 'COMPANY_ALL') {
          companyAmount = newGrand;
          guestAmount = 0;
        } else if (booking.billingRule === 'COMPANY_ROOM_ONLY') {
          const roomSubtotal = roomCharges;
          const roomCgst = parseFloat((roomSubtotal * 0.06).toFixed(2));
          const roomSgst = parseFloat((roomSubtotal * 0.06).toFixed(2));
          const roomTax = roomCgst + roomSgst;
          companyAmount = parseFloat((roomSubtotal + roomTax).toFixed(2));
          guestAmount = Math.max(0, parseFloat((newGrand - companyAmount).toFixed(2)));
        } else {
          companyAmount = 0;
          guestAmount = newGrand;
        }

        const paid = Number(booking.invoice.amountPaid);

        await tx.invoice.update({
          where: { id: booking.invoice.id },
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
            pendingAmount: guestAmount - paid,
            isFinalized: true,
            isBtc: booking.billingRule !== 'GUEST',
          },
        });

        if (booking.companyId && companyAmount > 0) {
          const btcPayments = await tx.payment.findMany({
            where: { bookingId: booking.id, method: 'BTC' },
          });
          const totalBtcPaid = btcPayments.reduce((sum, p) => sum + Number(p.amount), 0);
          const finalIncrement = Math.max(0, companyAmount - totalBtcPaid);

          if (finalIncrement > 0) {
            await tx.company.update({
              where: { id: booking.companyId },
              data: {
                outstandingBalance: {
                  increment: finalIncrement,
                },
              },
            });
          }
        }
      }
    });

    await createAuditLog({ action: 'CHECKOUT', entity: 'booking', entityId: booking.id, details: `Guest checked out from room ${booking.room.roomNumber}`, userId: req.user!.id });
    const updated = await prisma.booking.findUnique({ where: { id: booking.id }, include: { guest: true, room: { include: { roomType: true } }, invoice: true, payments: true } });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Checkout failed' }); }
});

// PUT /api/bookings/:id/cancel
router.put('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as string }, include: { room: true } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status === 'CHECKED_OUT') { res.status(400).json({ error: 'Cannot cancel a checked-out booking' }); return; }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
      if (booking.status === 'CHECKED_IN') {
        await tx.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } });
      }
    });

    await createAuditLog({ action: 'CANCEL_BOOKING', entity: 'booking', entityId: booking.id, details: reason || 'Cancelled', userId: req.user!.id });
    res.json({ message: 'Booking cancelled' });
  } catch { res.status(500).json({ error: 'Cancellation failed' }); }
});

// PUT /api/bookings/:id/noshow
router.put('/:id/noshow', async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as string } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'CONFIRMED') { res.status(400).json({ error: 'Only confirmed advance bookings can be marked as No Show' }); return; }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'NO_SHOW' } });
    });

    await createAuditLog({ action: 'NO_SHOW', entity: 'booking', entityId: booking.id, details: 'Guest did not arrive', userId: req.user!.id });
    res.json({ message: 'Marked as No Show' });
  } catch { res.status(500).json({ error: 'Failed to update' }); }
});

export default router;
