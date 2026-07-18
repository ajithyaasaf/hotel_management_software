import prisma from '../utils/prisma';
import { createAuditLog } from '../utils/helpers';
import { Booking, Room, Order, Payment } from '@prisma/client';

export interface PreCheckResult {
  businessDate: string;
  openOrdersCount: number;
  expectedNoShowsCount: number;
  overstaysCount: number;
  activeCheckinsCount: number;
  openOrders: Array<{ id: string; orderNumber: string; roomNumber: string | null; total: number }>;
  expectedNoShows: Array<{ id: string; bookingNumber: string; guestName: string; roomNumber: string }>;
  overstays: Array<{ id: string; bookingNumber: string; guestName: string; roomNumber: string; expectedCheckout: string }>;
}

export interface AuditRunResult {
  auditId: string;
  businessDate: string;
  noShowsProcessed: number;
  roomsCharged: number;
  totalRoomRevenue: number;
  totalFoodRevenue: number;
  totalRevenue: number;
  cashCollected: number;
  cardCollected: number;
  upiCollected: number;
  newBusinessDate: string;
}

export const nightAuditService = {
  /**
   * Get current business date from SystemConfig
   */
  async getBusinessDate(): Promise<string> {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'BUSINESS_DATE' },
    });
    if (!config) {
      // Fallback if not seeded
      const today = new Date().toISOString().split('T')[0];
      await prisma.systemConfig.create({
        data: { key: 'BUSINESS_DATE', value: today },
      });
      return today;
    }
    return config.value;
  },

  /**
   * Set the business date in SystemConfig
   */
  async setBusinessDate(dateStr: string): Promise<void> {
    await prisma.systemConfig.upsert({
      where: { key: 'BUSINESS_DATE' },
      update: { value: dateStr },
      create: { key: 'BUSINESS_DATE', value: dateStr },
    });
  },

  /**
   * Pre-check validation: gathers warnings and details without performing DB updates
   */
  async runPreCheck(): Promise<PreCheckResult> {
    const businessDateStr = await this.getBusinessDate();
    const businessDate = new Date(businessDateStr);

    // 1. Get Open POS Orders (Active status)
    const openOrders = await prisma.order.findMany({
      where: { status: 'ACTIVE' },
      include: { room: true },
    });

    // 2. Get Expected No-Shows (Confirmed bookings whose check-in date is <= today's business date)
    // We compare dates by string format YYYY-MM-DD to avoid timezone shifts
    const bookings = await prisma.booking.findMany({
      where: { status: 'CONFIRMED' },
      include: { guest: true, room: true },
    });
    
    const expectedNoShows = bookings.filter(b => {
      const bDateStr = b.checkInDate.toISOString().split('T')[0];
      return bDateStr <= businessDateStr;
    });

    // 3. Get Overstays (Checked-in bookings whose expected checkout is before today's business date)
    const activeBookings = await prisma.booking.findMany({
      where: { status: 'CHECKED_IN' },
      include: { guest: true, room: true },
    });

    const overstays = activeBookings.filter(b => {
      const bCheckoutStr = b.expectedCheckout.toISOString().split('T')[0];
      return bCheckoutStr < businessDateStr;
    });

    return {
      businessDate: businessDateStr,
      openOrdersCount: openOrders.length,
      expectedNoShowsCount: expectedNoShows.length,
      overstaysCount: overstays.length,
      activeCheckinsCount: activeBookings.length,
      openOrders: openOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        roomNumber: o.room?.roomNumber || null,
        total: Number(o.total),
      })),
      expectedNoShows: expectedNoShows.map(b => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        guestName: b.guest.name,
        roomNumber: b.room.roomNumber,
      })),
      overstays: overstays.map(b => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        guestName: b.guest.name,
        roomNumber: b.room.roomNumber,
        expectedCheckout: b.expectedCheckout.toISOString().split('T')[0],
      })),
    };
  },

  /**
   * Run the actual Night Audit within a single transaction
   */
  async runAudit(userId: string, notes?: string): Promise<AuditRunResult> {
    const businessDateStr = await this.getBusinessDate();
    const businessDate = new Date(businessDateStr);

    const userObj = await prisma.user.findUnique({ where: { id: userId } });
    if (!userObj) {
      throw new Error('User authorization failed. Account not found.');
    }

    // Guard: Time-Lock Guard. Block receptionists from executing before 10 PM.
    // This lock only applies if we are closing today's date or a future date.
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const isPastDate = businessDateStr < todayStr;

    if (!isPastDate) {
      const currentHour = now.getHours();
      if (currentHour < 22 && userObj.role !== 'MD') {
        throw new Error('Early Day-End Lock: Receptionists can only run the Night Audit after 10:00 PM (22:00) local time. An Administrator must run this transaction to execute early.');
      }
    }

    // Guard: Strict Calendar Lock. Do not allow rolling the business date into the future.
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const targetBusinessDate = new Date(businessDateStr);
    if (todayLocal <= targetBusinessDate) {
      const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
      if (!isDev || userObj.role !== 'MD') {
        throw new Error(`Calendar Lock: You cannot close the business date of ${businessDateStr} until the real-world calendar date has progressed to the next day (after midnight).`);
      }
    }

    // Guard: Check if there's already a completed audit for this business date
    const existingAudit = await prisma.nightAudit.findFirst({
      where: {
        businessDate: {
          gte: new Date(businessDateStr + 'T00:00:00.000Z'),
          lte: new Date(businessDateStr + 'T23:59:59.999Z'),
        },
        status: 'COMPLETED',
      },
    });

    if (existingAudit) {
      throw new Error(`Night Audit has already been completed for the business date: ${businessDateStr}`);
    }

    // Run the entire audit inside a transaction
    return await prisma.$transaction(async (tx) => {
      // 1. Create a NightAudit session record (IN_PROGRESS)
      const audit = await tx.nightAudit.create({
        data: {
          businessDate: businessDate,
          status: 'IN_PROGRESS',
          runById: userId,
          notes: notes || '',
        },
      });

      // 2. Process No-Shows (Mark CONFIRMED bookings as NO_SHOW if checkInDate <= businessDate)
      const bookings = await tx.booking.findMany({
        where: { status: 'CONFIRMED' },
        include: { room: true },
      });

      const noShowBookings = bookings.filter(b => {
        const bDateStr = b.checkInDate.toISOString().split('T')[0];
        return bDateStr <= businessDateStr;
      });

      for (const b of noShowBookings) {
        await tx.booking.update({
          where: { id: b.id },
          data: { status: 'NO_SHOW' },
        });

        // Release room if it was reserved
        if (b.room.status === 'AVAILABLE' || b.room.status === 'OCCUPIED') {
          // If room type was blocked or set, change back to available
          await tx.room.update({
            where: { id: b.roomId },
            data: { status: 'AVAILABLE' },
          });
        }

        // Log this action
        await tx.auditLog.create({
          data: {
            action: 'CANCEL_BOOKING',
            entity: 'booking',
            entityId: b.id,
            details: `Auto-marked as NO_SHOW by Night Audit`,
            userId,
          },
        });
      }

      // 3. Process Daily Room Charges for all CHECKED_IN bookings
      const activeBookings = await tx.booking.findMany({
        where: { status: 'CHECKED_IN' },
        include: { room: true, invoice: true },
      });

      let roomsCharged = 0;
      let totalRoomRevenue = 0;

      // Tax setup (Default 5% total, split 2.5% CGST, 2.5% SGST)
      const taxConfigs = await tx.taxConfig.findMany({ where: { isActive: true } });
      const cgstConfig = taxConfigs.find(t => t.name === 'CGST');
      const sgstConfig = taxConfigs.find(t => t.name === 'SGST');
      const cgstRate = cgstConfig ? Number(cgstConfig.rate) / 100 : 0.025;
      const sgstRate = sgstConfig ? Number(sgstConfig.rate) / 100 : 0.025;

      for (const b of activeBookings) {
        const rate = Number(b.roomPrice);
        const cgst = parseFloat((rate * cgstRate).toFixed(2));
        const sgst = parseFloat((rate * sgstRate).toFixed(2));
        const totalCharge = rate + cgst + sgst;

        // Save daily charge record
        await tx.nightAuditCharge.create({
          data: {
            nightAuditId: audit.id,
            bookingId: b.id,
            roomId: b.roomId,
            businessDate: businessDate,
            roomRate: rate,
            cgst,
            sgst,
            totalCharge,
          },
        });

        roomsCharged++;
        totalRoomRevenue += rate;
      }

      // 4. Calculate Food/F&B revenue closed today
      // F&B orders completed on this business date
      // We look at orders created today or completed today. To be precise, orders marked COMPLETED on this calendar date
      const closedOrders = await tx.order.findMany({
        where: {
          status: 'COMPLETED',
          updatedAt: {
            gte: new Date(businessDateStr + 'T00:00:00.000Z'),
            lte: new Date(businessDateStr + 'T23:59:59.999Z'),
          },
        },
        include: {
          room: true,
        },
      });
      const totalFoodRevenue = closedOrders.reduce((sum, o) => sum + Number(o.total), 0);

      // Save detailed daily closed orders logs for audit tracking
      for (const order of closedOrders) {
        let roomNumber: string | null = null;
        let guestName: string | null = null;
        let billingStatus = 'PAID_DIRECT';

        if (order.type === 'ROOM' && order.roomId) {
          roomNumber = order.room?.roomNumber || null;
          billingStatus = 'CHARGED_TO_ROOM';

          // Look up active/checked-in booking for guest's name
          const booking = await tx.booking.findFirst({
            where: {
              roomId: order.roomId,
              status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
            },
            include: {
              guest: true,
            },
          });
          if (booking) {
            guestName = booking.guest.name;
          } else {
            guestName = order.customerName || 'Resident Guest';
          }
        } else {
          guestName = order.customerName || 'Walk-in Guest';
        }

        await tx.nightAuditOrder.create({
          data: {
            nightAuditId: audit.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderType: order.type,
            totalAmount: order.total,
            billingStatus,
            roomNumber,
            guestName,
          },
        });
      }

      // 5. Reconcile Shift Payments created today
      const todayPayments = await tx.payment.findMany({
        where: {
          createdAt: {
            gte: new Date(businessDateStr + 'T00:00:00.000Z'),
            lte: new Date(businessDateStr + 'T23:59:59.999Z'),
          },
        },
      });

      let cashCollected = 0;
      let cardCollected = 0;
      let upiCollected = 0;

      for (const p of todayPayments) {
        const amt = Number(p.amount);
        if (p.method === 'CASH') cashCollected += amt;
        else if (p.method === 'CARD') cardCollected += amt;
        else if (p.method === 'UPI') upiCollected += amt;
      }

      // 6. Get Rooms statistics
      const totalRoomsCount = await tx.room.count();
      const occupiedRoomsCount = activeBookings.length;
      const newCheckinsCount = activeBookings.filter(b => {
        return b.checkInDate.toISOString().split('T')[0] === businessDateStr;
      }).length;
      const checkoutsTodayCount = await tx.booking.count({
        where: {
          status: 'CHECKED_OUT',
          actualCheckout: {
            gte: new Date(businessDateStr + 'T00:00:00.000Z'),
            lte: new Date(businessDateStr + 'T23:59:59.999Z'),
          },
        },
      });

      // 7. Update NightAudit record as COMPLETED with reconciled sums
      const totalRevenue = totalRoomRevenue + totalFoodRevenue;

      await tx.nightAudit.update({
        where: { id: audit.id },
        data: {
          status: 'COMPLETED',
          roomRevenue: totalRoomRevenue,
          foodRevenue: totalFoodRevenue,
          totalRevenue,
          cashCollected,
          cardCollected,
          upiCollected,
          roomsOccupied: occupiedRoomsCount,
          totalRooms: totalRoomsCount,
          newCheckins: newCheckinsCount,
          checkoutsToday: checkoutsTodayCount,
          noShowsMarked: noShowBookings.length,
          completedAt: new Date(),
        },
      });

      // 8. Roll Forward the Business Date in SystemConfig
      const nextDate = new Date(businessDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      await tx.systemConfig.update({
        where: { key: 'BUSINESS_DATE' },
        data: { value: nextDateStr },
      });

      // 9. Create System Audit Log
      await tx.auditLog.create({
        data: {
          action: 'NIGHT_AUDIT_COMPLETED',
          entity: 'night_audit',
          entityId: audit.id,
          details: `Closed business date ${businessDateStr}. Next date: ${nextDateStr}. Revenue: ₹${totalRevenue}.`,
          userId,
        },
      });

      return {
        auditId: audit.id,
        businessDate: businessDateStr,
        noShowsProcessed: noShowBookings.length,
        roomsCharged,
        totalRoomRevenue,
        totalFoodRevenue,
        totalRevenue,
        cashCollected,
        cardCollected,
        upiCollected,
        newBusinessDate: nextDateStr,
      };
    });
  },
};
