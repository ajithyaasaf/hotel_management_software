import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog, generateBookingNumber, generateGroupNumber } from '../utils/helpers';
import { uploadToCloudinary } from '../utils/cloudinary';
import { calculateTaxWithTx } from '../utils/tax';
import { computeBillingSplit } from './bookings';
import { getTodayIST, toISTDateString, computeCalendarNightsIST, formatIST } from '../utils/dateTime';

const router = Router();
router.use(authenticate);

// ─── Validation Schemas ──────────────────────────────────

const roomEntrySchema = z.object({
  roomId: z.string().uuid(),
  checkInDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid check-in date" }),
  expectedCheckout: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid checkout date" }),
  roomPrice: z.number().positive(),
  numberOfGuests: z.number().int().min(1).default(1),
  specialRequests: z.string().optional().nullable(),
  advanceAmount: z.number().min(0).optional().default(0),
  advanceMethod: z.enum(['CASH', 'UPI', 'CARD']).optional().default('CASH'),
  guestName: z.string().optional().nullable(),
  guestPhone: z.string().optional().nullable(),
  guestEmail: z.string().optional().nullable(),
  idProofType: z.string().optional().nullable(),
  idProofNumber: z.string().optional().nullable(),
  idProofImage: z.string().optional().nullable(),
}).refine(data => {
  const checkIn = new Date(data.checkInDate).getTime();
  const checkOut = new Date(data.expectedCheckout).getTime();
  return checkOut > checkIn;
}, {
  message: "Expected checkout date and time must be strictly after check-in date and time",
  path: ["expectedCheckout"],
});

const createGroupSchema = z.object({
  leadGuestPhone: z.string().min(10),
  leadGuestName: z.string().min(3).optional(), // required only for new guests
  notes: z.string().optional().nullable(),
  rooms: z.array(roomEntrySchema).min(2, 'A group booking requires at least 2 rooms'),
});

// ─── Helpers ────────────────────────────────────────────

// IST-aware calendar night computation for group bookings billing.
// Uses IST date boundaries so a 25-hour stay = 1 night, not 2 (Section 4 fix).
function computeNights(checkIn: Date, checkOut: Date): number {
  return computeCalendarNightsIST(checkIn, checkOut);
}

// ─── Routes ─────────────────────────────────────────────

// GET /api/group-bookings
router.get('/', async (_req, res) => {
  try {
    const groups = await prisma.groupBooking.findMany({
      include: {
        leadGuest: true,
        bookings: {
          include: {
            room: { include: { roomType: true } },
            invoice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(groups);
  } catch { res.status(500).json({ error: 'Failed to fetch group bookings' }); }
});

// GET /api/group-bookings/:id
router.get('/:id', async (req, res) => {
  try {
    const group = await prisma.groupBooking.findUnique({
      where: { id: req.params.id as string },
      include: {
        leadGuest: true,
        createdBy: { select: { name: true } },
        bookings: {
          include: {
            guest: true,
            room: { include: { roomType: true } },
            invoice: { include: { adjustments: true } },
            payments: true,
            transfers: { include: { fromRoom: true, toRoom: true } },
          },
        },
      },
    });
    if (!group) { res.status(404).json({ error: 'Group booking not found' }); return; }
    res.json(group);
  } catch { res.status(500).json({ error: 'Failed to fetch group booking' }); }
});

// GET /api/group-bookings/:id/master-invoice — computed, not stored
router.get('/:id/master-invoice', async (req, res) => {
  try {
    const group = await prisma.groupBooking.findUnique({
      where: { id: req.params.id as string },
      include: {
        leadGuest: true,
        bookings: {
          include: {
            room: { include: { roomType: true } },
            invoice: { include: { adjustments: true } },
            payments: true,
          },
        },
      },
    });
    if (!group) { res.status(404).json({ error: 'Group booking not found' }); return; }

    const rooms = group.bookings.map(b => ({
      bookingId: b.id,
      bookingNumber: b.bookingNumber,
      roomNumber: b.room.roomNumber,
      roomType: b.room.roomType.name,
      checkInDate: b.checkInDate,
      expectedCheckout: b.expectedCheckout,
      status: b.status,
      roomCharges: Number(b.invoice?.roomCharges ?? 0),
      foodCharges: Number(b.invoice?.foodCharges ?? 0),
      extraCharges: Number(b.invoice?.extraCharges ?? 0),
      discountAmount: Number(b.invoice?.discountAmount ?? 0),
      grandTotal: Number(b.invoice?.grandTotal ?? 0),
      amountPaid: Number(b.invoice?.amountPaid ?? 0),
      pendingAmount: Number(b.invoice?.pendingAmount ?? 0),
    }));

    const totals = rooms.reduce(
      (acc, r) => ({
        totalRoomCharges: acc.totalRoomCharges + r.roomCharges,
        totalFoodCharges: acc.totalFoodCharges + r.foodCharges,
        totalExtraCharges: acc.totalExtraCharges + r.extraCharges,
        totalDiscounts: acc.totalDiscounts + r.discountAmount,
        totalGrandTotal: acc.totalGrandTotal + r.grandTotal,
        totalAmountPaid: acc.totalAmountPaid + r.amountPaid,
        totalPending: acc.totalPending + r.pendingAmount,
      }),
      { totalRoomCharges: 0, totalFoodCharges: 0, totalExtraCharges: 0, totalDiscounts: 0, totalGrandTotal: 0, totalAmountPaid: 0, totalPending: 0 }
    );

    res.json({
      groupNumber: group.groupNumber,
      status: group.status,
      leadGuest: { name: group.leadGuest.name, phone: group.leadGuest.phone },
      rooms,
      ...totals,
    });
  } catch { res.status(500).json({ error: 'Failed to generate master invoice' }); }
});

// POST /api/group-bookings — create group with all rooms atomically
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createGroupSchema.parse(req.body);

    // Guard: no duplicate rooms in the same group request
    const roomIds = data.rooms.map(r => r.roomId);
    if (new Set(roomIds).size !== roomIds.length) {
      res.status(400).json({ error: 'Duplicate rooms detected in group booking. Each room must be unique.' });
      return;
    }

    // Validate all rooms and check for conflicts BEFORE the transaction
    for (const entry of data.rooms) {
      const checkIn = new Date(entry.checkInDate);
      const checkOut = new Date(entry.expectedCheckout);

      if (checkOut < checkIn) {
        res.status(400).json({ error: `Room checkout date cannot be before check-in date` });
        return;
      }

      const room = await prisma.room.findUnique({ where: { id: entry.roomId } });
      if (!room) {
        res.status(404).json({ error: `Room not found: ${entry.roomId}` });
        return;
      }
      if (room.status === 'BLOCKED') {
        res.status(400).json({ error: `Room ${room.roomNumber} is blocked` });
        return;
      }
      if (room.status === 'OCCUPIED') {
        res.status(400).json({ error: `Room ${room.roomNumber} is already occupied` });
        return;
      }

      // Check for overlapping bookings
      const activeBookings = await prisma.booking.findMany({
        where: { roomId: entry.roomId, status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      });
      const hasConflict = activeBookings.some(b => {
        const bIn = b.checkInDate.getTime();
        const bOut = b.expectedCheckout.getTime() === bIn ? bIn + 1000 : b.expectedCheckout.getTime();
        const newIn = checkIn.getTime();
        const newOut = checkOut.getTime() === newIn ? newIn + 1000 : checkOut.getTime();
        return Math.max(bIn, newIn) < Math.min(bOut, newOut);
      });
      if (hasConflict) {
        res.status(400).json({ error: `Room ${room.roomNumber} is already booked/occupied during the selected dates. Please choose another room or change the dates.` });
        return;
      }
    }

    // All validations passed — upload any custom guest ID images to Cloudinary first
    const roomsWithUrls = await Promise.all(data.rooms.map(async (room) => {
      let idProofUrl: string | undefined = undefined;
      if (room.idProofImage) {
        idProofUrl = await uploadToCloudinary(room.idProofImage);
      }
      return { ...room, idProofUrl };
    }));

    // Run atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find or create lead guest
      let leadGuest = await tx.guest.findFirst({ where: { phone: data.leadGuestPhone } });
      if (!leadGuest) {
        if (!data.leadGuestName) throw new Error('Guest name is required for new guests');
        leadGuest = await tx.guest.create({
          data: {
            name: data.leadGuestName,
            phone: data.leadGuestPhone,
            visitCount: 1,
          },
        });
      } else {
        leadGuest = await tx.guest.update({
          where: { id: leadGuest.id },
          data: { visitCount: { increment: 1 } },
        });
      }

      // Create the group container
      const group = await tx.groupBooking.create({
        data: {
          groupNumber: generateGroupNumber(),
          leadGuestId: leadGuest.id,
          notes: data.notes ?? null,
          createdById: req.user!.id,
        },
      });

      const todayIST = getTodayIST();

      // Create each booking + invoice
      for (const entry of roomsWithUrls) {
        const checkIn = new Date(entry.checkInDate);
        const checkOut = new Date(entry.expectedCheckout);
        // Compare IST calendar dates to determine advance vs walk-in
        const isAdvance = toISTDateString(checkIn) > todayIST;
        const status = isAdvance ? 'CONFIRMED' : 'CHECKED_IN';

        // Resolve guest for this specific room
        let guestId = leadGuest.id;
        if (entry.guestPhone) {
          let roomGuest = await tx.guest.findFirst({ where: { phone: entry.guestPhone } });
          if (!roomGuest) {
            if (!entry.guestName) throw new Error(`Guest name is required for new guest phone: ${entry.guestPhone}`);
            roomGuest = await tx.guest.create({
              data: {
                name: entry.guestName,
                phone: entry.guestPhone,
                email: entry.guestEmail,
                idProofType: entry.idProofType,
                idProofNumber: entry.idProofNumber,
                idProofUrl: entry.idProofUrl || null,
                visitCount: 1,
              },
            });
          } else {
            roomGuest = await tx.guest.update({
              where: { id: roomGuest.id },
              data: {
                name: entry.guestName || roomGuest.name,
                visitCount: { increment: 1 },
                ...(entry.idProofType && { idProofType: entry.idProofType }),
                ...(entry.idProofNumber && { idProofNumber: entry.idProofNumber }),
                ...(entry.idProofUrl && { idProofUrl: entry.idProofUrl }),
              },
            });
          }
          guestId = roomGuest.id;
        }

        // Resolve final timestamps for this room
        let actualCheckIn: Date;
        let actualCheckout: Date;
        if (isAdvance) {
          // Advance: keep scheduled midnight IST dates
          actualCheckIn = checkIn;
          actualCheckout = checkOut;
        } else {
          // Walk-in: stamp live server clock; checkout = check-in + nights * 24h
          actualCheckIn = new Date();
          const bookedNights = computeNights(checkIn, checkOut);
          actualCheckout = new Date(actualCheckIn.getTime() + bookedNights * 24 * 60 * 60 * 1000);
        }

        const booking = await tx.booking.create({
          data: {
            bookingNumber: generateBookingNumber(),
            guestId,
            roomId: entry.roomId,
            groupBookingId: group.id,
            status,
            checkInDate: actualCheckIn,
            expectedCheckout: actualCheckout,
            roomPrice: entry.roomPrice,
            numberOfGuests: entry.numberOfGuests,
            specialRequests: entry.specialRequests,
            createdById: req.user!.id,
          },
        });

        if (!isAdvance) {
          await tx.room.update({ where: { id: entry.roomId }, data: { status: 'OCCUPIED' } });
        }

        const nights = isAdvance ? computeNights(checkIn, checkOut) : computeNights(actualCheckIn, actualCheckout);
        const roomCharges = entry.roomPrice * nights;

        const tax = await calculateTaxWithTx(tx, roomCharges);
        const cgst = tax.cgst;
        const sgst = tax.sgst;
        const totalTax = tax.totalTax;
        const grandTotal = parseFloat((roomCharges + totalTax).toFixed(2));

        await tx.invoice.create({
          data: {
            invoiceNumber: `INV${Date.now()}${Math.floor(Math.random() * 100)}`,
            bookingId: booking.id,
            roomCharges,
            subtotal: roomCharges,
            cgst,
            sgst,
            totalTax,
            grandTotal,
            pendingAmount: grandTotal,
          },
        });

        if (entry.advanceAmount && entry.advanceAmount > 0) {
          await tx.payment.create({
            data: {
              bookingId: booking.id,
              amount: entry.advanceAmount,
              method: entry.advanceMethod ?? 'CASH',
              type: 'ADVANCE',
              createdById: req.user!.id,
            },
          });
          await tx.invoice.update({
            where: { bookingId: booking.id },
            data: {
              amountPaid: entry.advanceAmount,
              pendingAmount: { decrement: entry.advanceAmount },
            },
          });
        }
      }

      return { group, leadGuest };
    });

    const created = await prisma.groupBooking.findUnique({
      where: { id: result.group.id },
      include: {
        leadGuest: true,
        bookings: { include: { room: { include: { roomType: true } }, invoice: true } },
      },
    });

    await createAuditLog({
      action: 'CREATE_GROUP_BOOKING',
      entity: 'group_booking',
      entityId: result.group.id,
      details: `Group ${result.group.groupNumber} created with ${data.rooms.length} room(s) for ${result.leadGuest.name}`,
      userId: req.user!.id,
      newValue: {
        groupNumber: result.group.groupNumber,
        leadGuestName: result.leadGuest.name,
        roomCount: data.rooms.length,
        rooms: (created?.bookings || []).map((b) => ({
          roomNumber: b.room.roomNumber,
          checkInTime: formatIST(new Date(b.checkInDate)),
          checkInDate: b.checkInDate,
          expectedCheckout: b.expectedCheckout,
          roomPrice: b.roomPrice,
        }))
      }
    });

    res.status(201).json(created);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.issues });
      return;
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create group booking' });
  }
});

// POST /api/group-bookings/:id/checkout-all
router.post('/:id/checkout-all', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const group = await prisma.groupBooking.findUnique({
      where: { id: id as string },
      include: {
        bookings: { include: { invoice: true, room: true } },
      },
    });
    if (!group) { res.status(404).json({ error: 'Group booking not found' }); return; }
    const activeBookings = (group as any).bookings.filter((b: any) => b.status === 'CHECKED_IN');
    if (activeBookings.length === 0) {
      res.status(400).json({ error: 'No checked-in rooms to checkout' });
      return;
    }

    // Check if any room in the group has active orders
    for (const booking of activeBookings) {
      const activeOrders = await prisma.order.findMany({
        where: { roomId: booking.roomId, status: 'ACTIVE' },
      });
      if (activeOrders.length > 0) {
        res.status(400).json({ error: `Cannot checkout. Room ${booking.room.roomNumber} has active restaurant orders.` });
        return;
      }
    }

    // Warn if any room has a pending balance (informational — not blocking)
    const pendingRooms = activeBookings.filter(b => Number(b.invoice?.pendingAmount ?? 0) > 0);

    const config = await prisma.systemConfig.findUnique({
      where: { key: 'BUSINESS_DATE' },
    });
    const todayIST = getTodayIST();
    const businessDateStr = (config?.value && config.value >= todayIST) ? config.value : todayIST;
    const checkoutDate = new Date();
    const [year, month, day] = businessDateStr.split('-').map(Number);
    checkoutDate.setFullYear(year);
    checkoutDate.setMonth(month - 1);
    checkoutDate.setDate(day);

    let newStatus: any = '';
    await prisma.$transaction(async (tx) => {
      for (const booking of activeBookings) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CHECKED_OUT', actualCheckout: checkoutDate },
        });
        await tx.room.update({
          where: { id: booking.roomId },
          data: { status: 'CLEANING' },
        });

        if (booking.invoice) {
          const nights = computeCalendarNightsIST(new Date(booking.checkInDate), checkoutDate);
          const roomCharges = Number(booking.roomPrice) * nights;

          // Sum F&B charges
          const roomOrders = await tx.order.findMany({
            where: { roomId: booking.roomId, status: { not: 'CANCELLED' }, createdAt: { gte: booking.checkInDate } },
            include: { items: { where: { isCancelled: false } } },
          });
          const foodCharges = roomOrders.reduce((sum, o) => sum + Number(o.total), 0);

          const newSubtotal = roomCharges + foodCharges + Number(booking.invoice.extraCharges) - Number(booking.invoice.discountAmount);
          const taxableStayAmount = roomCharges + Number(booking.invoice.extraCharges) - Number(booking.invoice.discountAmount);
          const tax = await calculateTaxWithTx(tx, taxableStayAmount);
          const newCgst = tax.cgst;
          const newSgst = tax.sgst;
          const newTax = tax.totalTax;
          const newGrand = parseFloat((newSubtotal + newTax).toFixed(2));

          const split = await computeBillingSplit(booking.billingRule, newGrand, roomCharges, Number(booking.invoice.extraCharges), Number(booking.invoice.discountAmount), tx);
          const companyAmount = split.companyAmount;
          const guestAmount = split.guestAmount;

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
      }

      // Update group status
      const remaining = (group as any).bookings.filter((b: any) => b.status === 'CHECKED_IN' && !activeBookings.find((a: any) => a.id === b.id));
      newStatus = remaining.length > 0 ? 'PARTIALLY_CHECKED_OUT' : 'COMPLETED';
      await tx.groupBooking.update({ where: { id: group.id }, data: { status: newStatus } });
    });

    const actualCheckoutTime = formatIST(new Date());
    const checkedOutRoomNumbers = activeBookings.map((b: any) => b.room.roomNumber).join(', ');

    await createAuditLog({
      action: 'GROUP_CHECKOUT',
      entity: 'group_booking',
      entityId: group.id,
      details: `Checked out ${activeBookings.length} room(s) [${checkedOutRoomNumbers}] from group ${group.groupNumber} (Checkout Time: ${actualCheckoutTime})`,
      userId: req.user!.id,
      oldValue: { status: group.status },
      newValue: { status: newStatus, actualCheckoutTime, roomCount: activeBookings.length, roomNumbers: checkedOutRoomNumbers },
    });

    const updated = await prisma.groupBooking.findUnique({
      where: { id: group.id },
      include: {
        leadGuest: true,
        bookings: { include: { room: { include: { roomType: true } }, invoice: true } },
      },
    });

    res.json({
      group: updated,
      warnings: pendingRooms.length > 0
        ? pendingRooms.map(b => `Room ${b.room.roomNumber} has pending balance of ₹${Number(b.invoice?.pendingAmount ?? 0).toLocaleString()}`)
        : [],
    });
  } catch { res.status(500).json({ error: 'Group checkout failed' }); }
});

// DELETE /api/group-bookings/:id/unlink/:bookingId — remove one booking from a group
router.delete('/:id/unlink/:bookingId', async (req: AuthRequest, res) => {
  try {
    const { id, bookingId } = req.params;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId as string } });
    if (!booking || booking.groupBookingId !== id) {
      res.status(404).json({ error: 'Booking not found in this group' });
      return;
    }
    if (booking.status === 'CHECKED_IN') {
      res.status(400).json({ error: 'Cannot unlink an active checked-in booking. Checkout first.' });
      return;
    }

    await prisma.booking.update({
      where: { id: bookingId as string },
      data: { groupBookingId: null },
    });

    // Check remaining bookings — if group now has <2, mark it completed
    const remaining = await prisma.booking.count({
      where: { groupBookingId: id, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    });

    if (remaining < 2) {
      await prisma.groupBooking.update({
        where: { id: id as string },
        data: { status: 'COMPLETED' },
      });
    }

    await createAuditLog({
      action: 'UNLINK_FROM_GROUP',
      entity: 'booking',
      entityId: bookingId as string,
      details: `Unlinked from group ${id}`,
      userId: req.user!.id,
      oldValue: { groupBookingId: id },
      newValue: { groupBookingId: null },
    });

    res.json({ message: 'Booking unlinked from group' });
  } catch { res.status(500).json({ error: 'Failed to unlink booking' }); }
});

export default router;