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

    const [checkouts, orders, rooms, totalRooms] = await Promise.all([
      prisma.booking.findMany({
        where: { status: 'CHECKED_OUT', actualCheckout: { gte: from, lte: to } },
        include: { invoice: true },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', type: { not: 'ROOM' }, createdAt: { gte: from, lte: to } },
      }),
      prisma.room.findMany(),
      prisma.room.count(),
    ]);

    const roomRevenue = checkouts.reduce((s, b) => s + (b.invoice ? Number(b.invoice.grandTotal) : 0), 0);
    const restaurantRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const totalRevenue = roomRevenue + restaurantRevenue;

    const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;
    const occupancyPercent = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    const checkins = await prisma.booking.count({ where: { status: 'CHECKED_IN' } });
    const totalCheckouts = checkouts.length;
    const confirmedBookings = await prisma.booking.count({ where: { status: 'CONFIRMED' } });

    res.json({
      roomRevenue: parseFloat(roomRevenue.toFixed(2)),
      restaurantRevenue: parseFloat(restaurantRevenue.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      occupancyPercent,
      occupiedRooms,
      totalRooms,
      currentCheckins: checkins,
      checkoutsInPeriod: totalCheckouts,
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

    const payments = await prisma.payment.findMany({
      where: { createdAt: { gte: from, lte: to }, type: { not: 'REFUND' } },
      orderBy: { createdAt: 'asc' },
    });

    const byDay: Record<string, number> = {};
    payments.forEach(p => {
      const day = p.createdAt.toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + Number(p.amount);
    });

    const result = Object.entries(byDay).map(([date, amount]) => ({ date, amount: parseFloat(amount.toFixed(2)) }));
    res.json(result);
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
