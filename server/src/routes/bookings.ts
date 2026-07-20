import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, hasPermission, AuthRequest } from '../middleware/auth';
import { createAuditLog, generateBookingNumber } from '../utils/helpers';
import { uploadToCloudinary } from '../utils/cloudinary';
import { calculateTax, calculateTaxWithTx } from '../utils/tax';

const router = Router();
router.use(authenticate);

const createBookingSchema = z.object({
  guestName: z.string().min(3).refine(val => !/^\d+$/.test(val), { message: "Name cannot be just numbers" }),
  guestPhone: z.string().min(10),
  guestEmail: z.string().email().optional().nullable(),
  idProofType: z.string().optional().nullable(),
  idProofNumber: z.string().optional().nullable(),
  idProofImage: z.string().optional().nullable(),
  idProofBackImage: z.string().optional().nullable(),
  isForeigner: z.boolean().default(false),
  passportNo: z.string().optional().nullable(),
  visaNo: z.string().optional().nullable(),
  visaExpiry: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
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
  accompanyingGuests: z.array(z.object({
    name: z.string().min(1),
    idProofType: z.string().optional().nullable(),
    idProofNumber: z.string().optional().nullable(),
    idProofFrontImage: z.string().optional().nullable(),
    idProofBackImage: z.string().optional().nullable(),
    isForeigner: z.boolean().default(false),
    passportNo: z.string().optional().nullable(),
    visaNo: z.string().optional().nullable(),
    visaExpiry: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
  })).optional().default([]),
});

// Helper: compute company/guest billing split
async function computeBillingSplit(billingRule: string, grandTotal: number, roomCharges: number, extraCharges: number, discountAmount: number, tx?: any) {
  let companyAmount = 0, guestAmount = 0;
  if (billingRule === 'COMPANY_ALL') {
    companyAmount = grandTotal; guestAmount = 0;
  } else if (billingRule === 'COMPANY_ROOM_ONLY') {
    const roomSubtotal = roomCharges + extraCharges - discountAmount;
    const taxCalc = tx ? await calculateTaxWithTx(tx, roomSubtotal) : await calculateTax(roomSubtotal);
    companyAmount = parseFloat((roomSubtotal + taxCalc.totalTax).toFixed(2));
    guestAmount = Math.max(0, parseFloat((grandTotal - companyAmount).toFixed(2)));
  } else {
    companyAmount = 0; guestAmount = grandTotal;
  }
  return { companyAmount, guestAmount };
}

// GET /api/bookings
router.get('/', requirePermission('booking.view'), async (req, res) => {
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
      include: { guest: true, room: { include: { roomType: true } }, invoice: true, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(bookings);
  } catch { res.status(500).json({ error: 'Failed to fetch bookings' }); }
});

// GET /api/bookings/active
router.get('/active', requirePermission('booking.view'), async (_req, res) => {
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
router.get('/:id', requirePermission('booking.view'), async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id as any },
      include: {
        guest: true, room: { include: { roomType: true } }, company: true,
        invoice: { include: { adjustments: { include: { createdBy: { select: { name: true } } } } } },
        payments: { include: { createdBy: { select: { name: true } } } },
        transfers: { include: { fromRoom: true, toRoom: true } },
        createdBy: { select: { name: true } },
        cancellationRequests: { include: { requestedBy: { select: { name: true } }, approvedBy: { select: { name: true } } }, orderBy: { requestedAt: 'desc' } },
        accompanyingGuests: true,
      },
    });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    res.json(booking);
  } catch { res.status(500).json({ error: 'Failed to fetch booking' }); }
});

// POST /api/bookings
router.post('/', requirePermission('booking.create'), async (req: AuthRequest, res) => {
  try {
    const data = createBookingSchema.parse(req.body);
    if (data.billingRule !== 'GUEST' && !data.companyId) {
      res.status(400).json({ error: 'Company must be specified for corporate billing rules' }); return;
    }
    if (data.companyId) {
      const companyExists = await prisma.company.findUnique({ where: { id: data.companyId } });
      if (!companyExists) { res.status(404).json({ error: 'Selected corporate company does not exist' }); return; }
    }
    const room = await prisma.room.findUnique({ where: { id: data.roomId } });
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
    if (room.status === 'BLOCKED') { res.status(400).json({ error: 'Room is blocked' }); return; }
    if (room.status === 'OCCUPIED') { res.status(400).json({ error: 'Room is already occupied' }); return; }
    if (room.status === 'CLEANING') { res.status(400).json({ error: 'Room is being cleaned' }); return; }

    const checkIn = new Date(data.checkInDate);
    const checkOut = new Date(data.expectedCheckout);
    const activeBookings = await prisma.booking.findMany({
      where: { roomId: data.roomId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
    });
    const hasConflict = activeBookings.some(b => {
      const bIn = b.checkInDate.getTime();
      const bOut = b.expectedCheckout.getTime() === bIn ? bIn + 1000 : b.expectedCheckout.getTime();
      const newIn = checkIn.getTime();
      const newOut = checkOut.getTime() === newIn ? newIn + 1000 : checkOut.getTime();
      return Math.max(bIn, newIn) < Math.min(bOut, newOut);
    });
    if (hasConflict) { res.status(400).json({ error: 'Room is already booked during the selected dates.' }); return; }

    const config = await prisma.systemConfig.findUnique({ where: { key: 'BUSINESS_DATE' } });
    const businessDateStr = config?.value || new Date().toISOString().split('T')[0];
    const today = new Date(businessDateStr); today.setHours(0,0,0,0);
    const inDate = new Date(data.checkInDate); inDate.setHours(0,0,0,0);
    const isAdvance = inDate > today;
    const initialStatus = isAdvance ? 'CONFIRMED' : 'CHECKED_IN';

    let idProofUrl: string | undefined;
    let idProofBackUrl: string | undefined;
    if (data.idProofImage) { idProofUrl = await uploadToCloudinary(data.idProofImage); }
    if (data.idProofBackImage) { idProofBackUrl = await uploadToCloudinary(data.idProofBackImage); }

    // Upload accompanying guest images concurrently
    const guestsWithImages = await Promise.all(data.accompanyingGuests.map(async (ag) => {
      let frontUrl: string | undefined;
      let backUrl: string | undefined;
      if (ag.idProofFrontImage) frontUrl = await uploadToCloudinary(ag.idProofFrontImage);
      if (ag.idProofBackImage) backUrl = await uploadToCloudinary(ag.idProofBackImage);
      return { ...ag, frontUrl, backUrl };
    }));

    const result = await prisma.$transaction(async (tx) => {
      let guest = await tx.guest.findFirst({ where: { phone: data.guestPhone } });
      const guestDataToUpdate = {
        name: data.guestName,
        email: data.guestEmail,
        ...(data.idProofType && { idProofType: data.idProofType }),
        ...(data.idProofNumber && { idProofNumber: data.idProofNumber }),
        ...(idProofUrl && { idProofUrl }),
        ...(idProofBackUrl && { idProofBackUrl }),
        isForeigner: data.isForeigner,
        ...(data.passportNo && { passportNo: data.passportNo }),
        ...(data.visaNo && { visaNo: data.visaNo }),
        ...(data.visaExpiry && { visaExpiry: new Date(data.visaExpiry) }),
        ...(data.country && { country: data.country })
      };

      if (!guest) {
        guest = await tx.guest.create({ data: { ...guestDataToUpdate, phone: data.guestPhone, visitCount: 1 } });
      } else {
        guest = await tx.guest.update({ where: { id: guest.id }, data: { ...guestDataToUpdate, visitCount: { increment: 1 } } });
      }

      const booking = await tx.booking.create({
        data: { bookingNumber: generateBookingNumber(), guestId: guest.id, roomId: data.roomId, status: initialStatus, checkInDate: new Date(data.checkInDate), expectedCheckout: new Date(data.expectedCheckout), roomPrice: data.roomPrice, numberOfGuests: data.numberOfGuests, specialRequests: data.specialRequests, createdById: req.user!.id, companyId: data.companyId || null, billingRule: data.billingRule || 'GUEST' },
        include: { guest: true, room: { include: { roomType: true } }, company: true },
      });

      if (guestsWithImages.length > 0) {
        await tx.accompanyingGuest.createMany({
          data: guestsWithImages.map(ag => ({
            bookingId: booking.id,
            name: ag.name,
            idProofType: ag.idProofType,
            idProofNumber: ag.idProofNumber,
            idProofFrontUrl: ag.frontUrl,
            idProofBackUrl: ag.backUrl,
            isForeigner: ag.isForeigner,
            passportNo: ag.passportNo,
            visaNo: ag.visaNo,
            visaExpiry: ag.visaExpiry ? new Date(ag.visaExpiry) : null,
            country: ag.country
          }))
        });
      }

      if (!isAdvance) { await tx.room.update({ where: { id: data.roomId }, data: { status: 'OCCUPIED' } }); }

      const nights = Math.max(1, Math.ceil((new Date(data.expectedCheckout).getTime() - new Date(data.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
      const roomCharges = data.roomPrice * nights;
      const tax = await calculateTaxWithTx(tx, roomCharges);
      const grandTotal = parseFloat((roomCharges + tax.totalTax).toFixed(2));
      const split = await computeBillingSplit(data.billingRule, grandTotal, roomCharges, 0, 0, tx);

      await tx.invoice.create({
        data: { invoiceNumber: `INV${Date.now()}`, bookingId: booking.id, roomCharges, subtotal: roomCharges, cgst: tax.cgst, sgst: tax.sgst, totalTax: tax.totalTax, grandTotal, companyId: data.companyId || null, companyAmount: split.companyAmount, guestAmount: split.guestAmount, pendingAmount: split.guestAmount, isBtc: data.billingRule !== 'GUEST' },
      });

      if (data.advanceAmount && data.advanceAmount > 0) {
        if (data.advanceMethod === 'BTC') {
          if (!data.companyId) throw new Error('Cannot use BTC without a corporate account');
          await tx.company.update({ where: { id: data.companyId }, data: { outstandingBalance: { increment: data.advanceAmount } } });
        }
        await tx.payment.create({ data: { bookingId: booking.id, amount: data.advanceAmount, method: data.advanceMethod || 'CASH', type: 'ADVANCE', createdById: req.user!.id } });
        await tx.invoice.update({ where: { bookingId: booking.id }, data: { amountPaid: data.advanceAmount, pendingAmount: { decrement: data.advanceAmount } } });
      }
      return booking;
    });

    await createAuditLog({ action: isAdvance ? 'ADVANCE_BOOKING' : 'CHECKIN', entity: 'booking', entityId: result.id, details: `Guest ${data.guestName} ${isAdvance ? 'advance booked' : 'checked into'} room ${room.roomNumber}`, userId: req.user!.id, newValue: { status: isAdvance ? 'CONFIRMED' : 'CHECKED_IN' } });
    res.status(201).json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: err.errors }); return; }
    console.error('Booking creation error:', err);
    
    // Explicitly handle image upload timeouts and failures
    if (err.message && err.message.includes('Cloudinary')) {
      res.status(400).json({ error: 'Image upload failed. The file is either too large or your internet connection timed out. Please try a smaller image.' });
      return;
    }

    res.status(500).json({ error: err.message || 'Failed to create booking', stack: err.stack });
  }
});

// PUT /api/bookings/:id/checkin
router.put('/:id/checkin', requirePermission('booking.checkin'), async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as any }, include: { room: true, guest: true } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'CONFIRMED') { res.status(400).json({ error: 'Booking is not in CONFIRMED state' }); return; }
    if (booking.room.status !== 'AVAILABLE') { res.status(400).json({ error: 'Room is not currently available' }); return; }

    const config = await prisma.systemConfig.findUnique({ where: { key: 'BUSINESS_DATE' } });
    const businessDateStr = config?.value || new Date().toISOString().split('T')[0];
    const checkInDate = new Date();
    const [year, month, day] = businessDateStr.split('-').map(Number);
    checkInDate.setFullYear(year); checkInDate.setMonth(month - 1); checkInDate.setDate(day);

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_IN', checkInDate } });
      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'OCCUPIED' } });
    });

    await createAuditLog({ action: 'CHECKIN', entity: 'booking', entityId: booking.id, details: `${booking.guest.name} checked in to room ${booking.room.roomNumber}`, userId: req.user!.id, oldValue: { status: booking.status }, newValue: { status: 'CHECKED_IN' } });
    res.json({ message: 'Checked in successfully' });
  } catch { res.status(500).json({ error: 'Check-in failed' }); }
});

// PUT /api/bookings/:id/extend
router.put('/:id/extend', requirePermission('booking.extend'), async (req: AuthRequest, res) => {
  try {
    const { newCheckout, newPrice } = z.object({ newCheckout: z.string().datetime(), newPrice: z.number().positive().optional() }).parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as string }, include: { invoice: true } }) as any;
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'CHECKED_IN') { res.status(400).json({ error: 'Booking is not active' }); return; }
    if (new Date(newCheckout) < new Date(booking.checkInDate)) { res.status(400).json({ error: 'New checkout cannot be before check-in' }); return; }

    const activeBookings = await prisma.booking.findMany({
      where: { roomId: booking.roomId, id: { not: booking.id }, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
    });
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(newCheckout);
    const hasConflict = activeBookings.some(b => {
      const bIn = b.checkInDate.getTime();
      const bOut = b.expectedCheckout.getTime() === bIn ? bIn + 1000 : b.expectedCheckout.getTime();
      const newIn = checkIn.getTime();
      const newOut = checkOut.getTime() === newIn ? newIn + 1000 : checkOut.getTime();
      return Math.max(bIn, newIn) < Math.min(bOut, newOut);
    });
    if (hasConflict) { res.status(400).json({ error: 'Cannot extend stay: Room is already booked during the extended period.' }); return; }

    const price = newPrice ?? Number(booking.roomPrice);
    const nights = Math.max(1, Math.ceil((new Date(newCheckout).getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
    const newRoomCharges = price * nights;

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: req.params.id as any }, data: { expectedCheckout: new Date(newCheckout), ...(newPrice && { roomPrice: newPrice }) } });
      if (booking.invoice) {
        const paid = Number(booking.invoice.amountPaid);
        const foodCharges = Number(booking.invoice.foodCharges);
        const extraCharges = Number(booking.invoice.extraCharges);
        const discountAmount = Number(booking.invoice.discountAmount);
        const newSubtotal = newRoomCharges + foodCharges + extraCharges - discountAmount;
        const taxableStayAmount = newRoomCharges + extraCharges - discountAmount;
        const tax = await calculateTaxWithTx(tx, taxableStayAmount);
        const newGrand = parseFloat((newSubtotal + tax.totalTax).toFixed(2));
        const split = await computeBillingSplit(booking.billingRule, newGrand, newRoomCharges, extraCharges, discountAmount, tx);
        await tx.invoice.update({ where: { id: booking.invoice.id }, data: { roomCharges: newRoomCharges, subtotal: newSubtotal, cgst: tax.cgst, sgst: tax.sgst, totalTax: tax.totalTax, grandTotal: newGrand, companyAmount: split.companyAmount, guestAmount: split.guestAmount, pendingAmount: split.guestAmount - paid } });
      }
    });

    await createAuditLog({ action: 'EXTEND_STAY', entity: 'booking', entityId: req.params.id as string, details: `Extended to ${newCheckout}`, userId: req.user!.id, oldValue: { expectedCheckout: booking.expectedCheckout, roomPrice: Number(booking.roomPrice) }, newValue: { expectedCheckout: new Date(newCheckout), roomPrice: price } });
    const updated = await prisma.booking.findUnique({ where: { id: req.params.id as any }, include: { guest: true, room: { include: { roomType: true } }, invoice: true } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to extend stay' });
  }
});

// PUT /api/bookings/:id/transfer
router.put('/:id/transfer', requirePermission('booking.transfer'), async (req: AuthRequest, res) => {
  try {
    const { toRoomId, reason, newRoomPrice } = z.object({ toRoomId: z.string().uuid(), reason: z.string().optional(), newRoomPrice: z.number().positive().optional() }).parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as any }, include: { room: true } });
    if (!booking || booking.status !== 'CHECKED_IN') { res.status(400).json({ error: 'Invalid booking' }); return; }
    const toRoom = await prisma.room.findUnique({ where: { id: toRoomId } });
    if (!toRoom || toRoom.status !== 'AVAILABLE') { res.status(400).json({ error: 'Target room not available' }); return; }

    await prisma.$transaction(async (tx) => {
      await tx.roomTransfer.create({ data: { bookingId: booking.id, fromRoomId: booking.roomId, toRoomId, reason, newRoomPrice } });
      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } });
      await tx.room.update({ where: { id: toRoomId }, data: { status: 'OCCUPIED' } });
      await tx.booking.update({ where: { id: booking.id as any }, data: { roomId: toRoomId, ...(newRoomPrice && { roomPrice: newRoomPrice }) } });
      await tx.order.updateMany({ where: { roomId: booking.roomId, status: 'ACTIVE' }, data: { roomId: toRoomId } });
    });

    await createAuditLog({ action: 'ROOM_TRANSFER', entity: 'booking', entityId: booking.id, details: `Transferred from ${booking.room.roomNumber} to ${toRoom.roomNumber}. Reason: ${reason || 'N/A'}`, userId: req.user!.id, oldValue: { roomId: booking.roomId, roomPrice: Number(booking.roomPrice) }, newValue: { roomId: toRoomId, roomPrice: newRoomPrice ?? Number(booking.roomPrice) } });
    const updated = await prisma.booking.findUnique({ where: { id: req.params.id as any }, include: { guest: true, room: { include: { roomType: true } } } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Room transfer failed' });
  }
});

// PUT /api/bookings/:id/checkout
router.put('/:id/checkout', requirePermission('booking.checkout'), async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as string }, include: { invoice: true, room: true, guest: true } }) as any;
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'CHECKED_IN') { res.status(400).json({ error: 'Booking not active' }); return; }

    const activeOrders = await prisma.order.findMany({ where: { roomId: booking.roomId, status: 'ACTIVE' } });
    if (activeOrders.length > 0) { res.status(400).json({ error: `Cannot check out. Room ${booking.room.roomNumber} has active restaurant orders.` }); return; }

    const config = await prisma.systemConfig.findUnique({ where: { key: 'BUSINESS_DATE' } });
    const businessDateStr = config?.value || new Date().toISOString().split('T')[0];
    const checkoutDate = new Date();
    const [year, month, day] = businessDateStr.split('-').map(Number);
    checkoutDate.setFullYear(year); checkoutDate.setMonth(month - 1); checkoutDate.setDate(day);

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CHECKED_OUT', actualCheckout: checkoutDate } });
      await tx.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } });

      if (booking.invoice) {
        const nights = Math.max(1, Math.ceil((checkoutDate.getTime() - new Date(booking.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
        const roomCharges = Number(booking.roomPrice) * nights;
        const roomOrders = await tx.order.findMany({ where: { roomId: booking.roomId, status: { not: 'CANCELLED' }, createdAt: { gte: booking.checkInDate } }, include: { items: { where: { isCancelled: false } } } });
        const foodCharges = roomOrders.reduce((sum: number, o: any) => sum + Number(o.total), 0);
        const newSubtotal = roomCharges + foodCharges + Number(booking.invoice.extraCharges) - Number(booking.invoice.discountAmount);
        const taxableStayAmount = roomCharges + Number(booking.invoice.extraCharges) - Number(booking.invoice.discountAmount);
        const tax = await calculateTaxWithTx(tx, taxableStayAmount);
        const newGrand = parseFloat((newSubtotal + tax.totalTax).toFixed(2));
        const split = await computeBillingSplit(booking.billingRule, newGrand, roomCharges, Number(booking.invoice.extraCharges), Number(booking.invoice.discountAmount), tx);
        const paid = Number(booking.invoice.amountPaid);

        await tx.invoice.update({ where: { id: booking.invoice.id }, data: { roomCharges, foodCharges, subtotal: newSubtotal, cgst: tax.cgst, sgst: tax.sgst, totalTax: tax.totalTax, grandTotal: newGrand, companyAmount: split.companyAmount, guestAmount: split.guestAmount, pendingAmount: split.guestAmount - paid, isFinalized: true, isBtc: booking.billingRule !== 'GUEST' } });

        if (booking.companyId && split.companyAmount > 0) {
          const btcPayments = await tx.payment.findMany({ where: { bookingId: booking.id, method: 'BTC' } });
          const totalBtcPaid = btcPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
          const finalIncrement = Math.max(0, split.companyAmount - totalBtcPaid);
          if (finalIncrement > 0) { await tx.company.update({ where: { id: booking.companyId }, data: { outstandingBalance: { increment: finalIncrement } } }); }
        }
      }
    });

    await createAuditLog({ action: 'CHECKOUT', entity: 'booking', entityId: booking.id, details: `${booking.guest.name} checked out from room ${booking.room.roomNumber}`, userId: req.user!.id, oldValue: { status: booking.status }, newValue: { status: 'CHECKED_OUT' } });
    const updated = await prisma.booking.findUnique({ where: { id: booking.id }, include: { guest: true, room: { include: { roomType: true } }, invoice: true, payments: true } });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Checkout failed' }); }
});

// PUT /api/bookings/:id/cancel — direct cancel (MD/OpsManager) or request approval
router.put('/:id/cancel', requirePermission('booking.cancel', 'booking.cancel.request'), async (req: AuthRequest, res) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1, 'Cancellation reason is required') }).parse(req.body);
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as string }, include: { room: true, guest: true } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status === 'CHECKED_OUT' || booking.status === 'CANCELLED') { res.status(400).json({ error: 'Cannot cancel this booking' }); return; }

    // Check if user can cancel directly
    const canCancelDirectly = hasPermission(req, 'booking.cancel');

    if (canCancelDirectly) {
      // Direct cancellation
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
        if (booking.status === 'CHECKED_IN') { await tx.room.update({ where: { id: booking.roomId }, data: { status: 'CLEANING' } }); }
        
        await tx.cancellationRequest.create({
          data: {
            bookingId: booking.id,
            reason,
            requestedById: req.user!.id,
            status: 'APPROVED',
            approvedById: req.user!.id,
            approverNote: 'Directly cancelled by authorized user',
            resolvedAt: new Date()
          }
        });
      });
      await createAuditLog({ action: 'CANCEL_BOOKING', entity: 'booking', entityId: booking.id, details: `Cancelled by ${req.user!.name}. Reason: ${reason}`, userId: req.user!.id, oldValue: { status: booking.status }, newValue: { status: 'CANCELLED' } });
      res.json({ message: 'Booking cancelled', requiresApproval: false });
    } else {
      // Create cancellation request for approval
      const existing = await prisma.cancellationRequest.findFirst({ where: { bookingId: booking.id, status: 'PENDING' } });
      if (existing) { res.status(400).json({ error: 'A cancellation request is already pending for this booking' }); return; }

      await prisma.cancellationRequest.create({ data: { bookingId: booking.id, reason, requestedById: req.user!.id } });
      await createAuditLog({ action: 'CANCELLATION_REQUESTED', entity: 'booking', entityId: booking.id, details: `Cancellation requested by ${req.user!.name}. Reason: ${reason}`, userId: req.user!.id });
      res.json({ message: 'Cancellation request submitted for approval', requiresApproval: true });
    }
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0].message }); return; }
    res.status(500).json({ error: 'Cancellation failed' });
  }
});

// PUT /api/bookings/:id/noshow
router.put('/:id/noshow', requirePermission('booking.cancel'), async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id as string } });
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
    if (booking.status !== 'CONFIRMED') { res.status(400).json({ error: 'Only confirmed advance bookings can be marked as No Show' }); return; }
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'NO_SHOW' } });
    await createAuditLog({ action: 'NO_SHOW', entity: 'booking', entityId: booking.id, details: 'Guest did not arrive', userId: req.user!.id, oldValue: { status: booking.status }, newValue: { status: 'NO_SHOW' } });
    res.json({ message: 'Marked as No Show' });
  } catch { res.status(500).json({ error: 'Failed to update' }); }
});

export default router;
export { computeBillingSplit };
