import { Router } from 'express';
import prisma from '../utils/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/reports/summary?from=&to=
router.get('/summary', async (req, res) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setDate(1));
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    to.setHours(23, 59, 59, 999);

    // Calculate days in period for occupancy
    const diffTime = Math.abs(to.getTime() - from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const [checkouts, walkInOrders, totalRoomsCount] = await Promise.all([
      prisma.booking.findMany({
        where: { status: 'CHECKED_OUT', actualCheckout: { gte: from, lte: to } },
        include: { invoice: true },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', type: { not: 'ROOM' }, createdAt: { gte: from, lte: to } },
      }),
      prisma.room.count(),
    ]);

    // 1. Calculate Revenue (Invoiced basis)
    // Room Revenue: Only the room charge portion of finalized invoices
    const roomRevenue = checkouts.reduce((s, b) => s + (b.invoice ? Number(b.invoice.roomCharges) : 0), 0);

    // Restaurant Revenue: Walk-ins + Room Service portion of finalized invoices
    const roomServiceRevenue = checkouts.reduce((s, b) => s + (b.invoice ? Number(b.invoice.foodCharges) : 0), 0);
    const walkInRevenue = walkInOrders.reduce((s, o) => s + Number(o.total), 0);
    const restaurantRevenue = roomServiceRevenue + walkInRevenue;

    // Extra Charges and Discounts
    const extraCharges = checkouts.reduce((s, b) => s + (b.invoice ? Number(b.invoice.extraCharges) : 0), 0);
    const discounts = checkouts.reduce((s, b) => s + (b.invoice ? Number(b.invoice.discountAmount) : 0), 0);

    const totalRevenue = roomRevenue + restaurantRevenue + extraCharges - discounts;

    // 3. Expenses and Net Profit for the same period
    const periodExpenses = await prisma.expense.findMany({
      where: { paidDate: { gte: from, lte: to } },
    });
    const totalExpenses = parseFloat(periodExpenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2));
    const netProfit = parseFloat((totalRevenue - totalExpenses).toFixed(2));

    // 4. Occupancy (Period-aware)
    // Total available room-nights in period
    const totalAvailableNights = totalRoomsCount * diffDays;

    // Calculate occupied nights during this specific period
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
        AND: [
          { checkInDate: { lt: to } },
          { expectedCheckout: { gt: from } }
        ]
      }
    });

    let occupiedNightsInPeriod = 0;
    overlappingBookings.forEach(b => {
      const start = b.checkInDate > from ? b.checkInDate : from;
      const end = (b.actualCheckout || b.expectedCheckout) < to ? (b.actualCheckout || b.expectedCheckout) : to;
      const nights = Math.max(0, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)));
      occupiedNightsInPeriod += nights;
    });

    const occupancyPercent = totalAvailableNights > 0
      ? Math.min(100, Math.round((occupiedNightsInPeriod / totalAvailableNights) * 100))
      : 0;

    const currentCheckins = await prisma.booking.count({ where: { status: 'CHECKED_IN' } });
    const confirmedBookings = await prisma.booking.count({ where: { status: 'CONFIRMED' } });

    res.json({
      roomRevenue: parseFloat(roomRevenue.toFixed(2)),
      restaurantRevenue: parseFloat(restaurantRevenue.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalExpenses,
      netProfit,
      occupancyPercent,
      occupiedRooms: occupiedNightsInPeriod,
      totalRooms: totalAvailableNights,
      currentCheckins,
      checkoutsInPeriod: checkouts.length,
      confirmedBookings,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to generate report' }); }
});

// GET /api/reports/revenue-daily?from=&to=
router.get('/revenue-daily', async (req, res) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setDate(1));
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    to.setHours(23, 59, 59, 999);

    const [checkouts, walkInOrders] = await Promise.all([
      prisma.booking.findMany({
        where: { status: 'CHECKED_OUT', actualCheckout: { gte: from, lte: to } },
        include: { invoice: true },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', type: { not: 'ROOM' }, createdAt: { gte: from, lte: to } },
      }),
    ]);

    const byDay: Record<string, number> = {};

    // Group Checkout Revenue by Checkout Date
    checkouts.forEach(b => {
      const day = b.actualCheckout!.toISOString().split('T')[0];
      const amount = b.invoice ? (Number(b.invoice.roomCharges) + Number(b.invoice.foodCharges) + Number(b.invoice.extraCharges) - Number(b.invoice.discountAmount)) : 0;
      byDay[day] = (byDay[day] || 0) + amount;
    });

    // 3. Get all expenses in period
    const expenses = await prisma.expense.findMany({
      where: { paidDate: { gte: from, lte: to } },
    });

    const dailyData = [];
    let currentDate = new Date(from);

    while (currentDate <= to) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      // Revenue for this day
      const revenue = byDay[dateStr] || 0;

      // Expenses for this day
      const dayExpenses = expenses.filter(e => {
        const eDate = new Date(e.paidDate);
        return eDate >= currentDate && eDate < nextDate;
      });
      const expense = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);

      dailyData.push({
        date: dateStr,
        revenue: parseFloat(revenue.toFixed(2)),
        expense: parseFloat(expense.toFixed(2)),
        profit: parseFloat((revenue - expense).toFixed(2)),
      });

      currentDate = nextDate;
    }

    res.json(dailyData);
  } catch { res.status(500).json({ error: 'Failed to generate daily revenue' }); }
});

// GET /api/reports/occupancy?from=&to=
router.get('/occupancy', async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' },
    });
    const summary = rooms.map(r => ({
      roomNumber: r.roomNumber,
      roomType: r.roomType.name,
      status: r.status,
      floor: r.floor,
    }));
    res.json(summary);
  } catch { res.status(500).json({ error: 'Failed to fetch occupancy' }); }
});

// GET /api/reports/audit?entity=&from=&to=
router.get('/audit', async (req, res) => {
  try {
    const { entity, from, to } = req.query;
    const where: any = {};
    if (entity) where.entity = entity;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(String(from));
      if (to) { const t = new Date(String(to)); t.setHours(23, 59, 59, 999); where.createdAt.lte = t; }
    }
    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(logs);
  } catch { res.status(500).json({ error: 'Failed to fetch audit log' }); }
});

export default router;
