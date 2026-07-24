import { Router } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requirePermission } from '../middleware/auth';
import { toISTDateString, getTodayIST } from '../utils/dateTime';

const router = Router();
router.use(authenticate, requirePermission('report.view'));

router.get('/summary', async (req, res) => {
  try {
    const fromStr = req.query.from ? String(req.query.from) : getTodayIST().slice(0, 8) + '01';
    const toStr = req.query.to ? String(req.query.to) : getTodayIST();
    const from = new Date(`${fromStr}T00:00:00+05:30`);
    const to = new Date(`${toStr}T23:59:59.999+05:30`);

    const diffTime = Math.abs(to.getTime() - from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const [checkouts, walkInOrders, banquetBookings, totalRoomsCount] = await Promise.all([
      prisma.booking.findMany({ where: { status: 'CHECKED_OUT', actualCheckout: { gte: from, lte: to } }, include: { invoice: true } }),
      prisma.order.findMany({ where: { status: 'COMPLETED', type: { not: 'ROOM' }, createdAt: { gte: from, lte: to } } }),
      prisma.banquetBooking.findMany({ where: { status: 'COMPLETED', createdAt: { gte: from, lte: to } }, include: { payments: true } }),
      prisma.room.count(),
    ]);

    const roomRevenue = checkouts.reduce((s, b) => s + (b.invoice ? Number(b.invoice.roomCharges) : 0), 0);
    const roomServiceRevenue = checkouts.reduce((s, b) => s + (b.invoice ? Number(b.invoice.foodCharges) : 0), 0);
    const walkInRevenue = walkInOrders.reduce((s, o) => s + Number(o.total), 0);
    const restaurantRevenue = roomServiceRevenue + walkInRevenue;
    const banquetRevenue = banquetBookings.reduce((s, b) => s + b.payments.reduce((pSum, p) => pSum + Number(p.amount), 0), 0);

    const extraCharges = checkouts.reduce((s, b) => s + (b.invoice ? Number(b.invoice.extraCharges) : 0), 0);
    const discounts = checkouts.reduce((s, b) => s + (b.invoice ? Number(b.invoice.discountAmount) : 0), 0);

    const totalRevenue = roomRevenue + restaurantRevenue + banquetRevenue + extraCharges - discounts;

    const periodExpenses = await prisma.expense.findMany({ where: { paidDate: { gte: from, lte: to } } });
    const totalExpenses = parseFloat(periodExpenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2));

    let hotelExpenses = 0, restaurantExpenses = 0, banquetExpenses = 0;
    periodExpenses.forEach(e => {
      if (e.department === 'HOTEL') hotelExpenses += Number(e.amount);
      else if (e.department === 'RESTAURANT') restaurantExpenses += Number(e.amount);
      else if (e.department === 'BANQUET') banquetExpenses += Number(e.amount);
    });

    const netProfit = parseFloat((totalRevenue - totalExpenses).toFixed(2));

    const totalAvailableNights = totalRoomsCount * diffDays;
    const overlappingBookings = await prisma.booking.findMany({
      where: { status: { in: ['CHECKED_IN', 'CHECKED_OUT'] }, AND: [{ checkInDate: { lt: to } }, { expectedCheckout: { gt: from } }] }
    });

    let occupiedNightsInPeriod = 0;
    overlappingBookings.forEach(b => {
      const start = b.checkInDate > from ? b.checkInDate : from;
      const end = (b.actualCheckout || b.expectedCheckout) < to ? (b.actualCheckout || b.expectedCheckout) : to;
      const nights = Math.max(0, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)));
      occupiedNightsInPeriod += nights;
    });

    const occupancyPercent = totalAvailableNights > 0 ? Math.min(100, Math.round((occupiedNightsInPeriod / totalAvailableNights) * 100)) : 0;
    const currentCheckins = await prisma.booking.count({ where: { status: 'CHECKED_IN' } });
    const confirmedBookings = await prisma.booking.count({ where: { status: 'CONFIRMED' } });

    res.json({
      roomRevenue: parseFloat(roomRevenue.toFixed(2)),
      restaurantRevenue: parseFloat(restaurantRevenue.toFixed(2)),
      banquetRevenue: parseFloat(banquetRevenue.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalExpenses,
      hotelExpenses: parseFloat(hotelExpenses.toFixed(2)),
      restaurantExpenses: parseFloat(restaurantExpenses.toFixed(2)),
      banquetExpenses: parseFloat(banquetExpenses.toFixed(2)),
      netProfit,
      occupancyPercent,
      occupiedRooms: occupiedNightsInPeriod,
      totalRooms: totalAvailableNights,
      currentCheckins,
      checkoutsInPeriod: checkouts.length,
      confirmedBookings,
    });
  } catch (e) { res.status(500).json({ error: 'Failed to generate report' }); }
});

router.get('/revenue-daily', async (req, res) => {
  try {
    const fromStr = req.query.from ? String(req.query.from) : getTodayIST().slice(0, 8) + '01';
    const toStr = req.query.to ? String(req.query.to) : getTodayIST();
    const from = new Date(`${fromStr}T00:00:00+05:30`);
    const to = new Date(`${toStr}T23:59:59.999+05:30`);

    const [checkouts, walkInOrders] = await Promise.all([
      prisma.booking.findMany({ where: { status: 'CHECKED_OUT', actualCheckout: { gte: from, lte: to } }, include: { invoice: true } }),
      prisma.order.findMany({ where: { status: 'COMPLETED', type: { not: 'ROOM' }, createdAt: { gte: from, lte: to } } }),
    ]);

    const byDay: Record<string, number> = {};
    checkouts.forEach(b => {
      // Use IST date bucketing so revenue from a late-night checkout (e.g. 11:30 PM IST)
      // is credited to the correct Indian calendar day, not the UTC-shifted one.
      const day = toISTDateString(b.actualCheckout!);
      const amount = b.invoice ? (Number(b.invoice.roomCharges) + Number(b.invoice.foodCharges) + Number(b.invoice.extraCharges) - Number(b.invoice.discountAmount)) : 0;
      byDay[day] = (byDay[day] || 0) + amount;
    });

    const expenses = await prisma.expense.findMany({ where: { paidDate: { gte: from, lte: to } } });

    const dailyData = [];
    let currentDate = new Date(from);
    while (currentDate <= to) {
      // Use IST date string so the loop iterates by Indian calendar days
      const dateStr = toISTDateString(currentDate);
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const revenue = byDay[dateStr] || 0;
      const dayExpenses = expenses.filter(e => { const eDate = new Date(e.paidDate); return eDate >= currentDate && eDate < nextDate; });
      const expense = dayExpenses.reduce((s, e) => s + Number(e.amount), 0);

      dailyData.push({ date: dateStr, revenue: parseFloat(revenue.toFixed(2)), expense: parseFloat(expense.toFixed(2)), profit: parseFloat((revenue - expense).toFixed(2)) });
      currentDate = nextDate;
    }
    res.json(dailyData);
  } catch { res.status(500).json({ error: 'Failed to generate daily revenue' }); }
});

router.get('/occupancy', async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({ include: { roomType: true }, orderBy: { roomNumber: 'asc' } });
    const summary = rooms.map(r => ({ roomNumber: r.roomNumber, roomType: r.roomType.name, status: r.status, floor: r.floor }));
    res.json(summary);
  } catch { res.status(500).json({ error: 'Failed to fetch occupancy' }); }
});

router.get('/police-checkins', async (req, res) => {
  try {
    const fromStr = req.query.from ? String(req.query.from) : getTodayIST();
    const toStr = req.query.to ? String(req.query.to) : getTodayIST();
    const from = new Date(`${fromStr}T00:00:00+05:30`);
    const to = new Date(`${toStr}T23:59:59.999+05:30`);

    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['CHECKED_IN', 'CHECKED_OUT'] },
        checkInDate: { lte: to },
        OR: [
          { status: 'CHECKED_IN' },
          { actualCheckout: { gte: from } }
        ]
      },
      include: {
        guest: true,
        room: true,
        accompanyingGuests: true
      },
      orderBy: { checkInDate: 'desc' }
    });

    res.json(bookings);
  } catch (e) { res.status(500).json({ error: 'Failed to generate police report' }); }
});

export default router;
