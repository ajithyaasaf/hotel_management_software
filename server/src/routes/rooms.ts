import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

const roomSchema = z.object({
  roomNumber: z.string().min(1),
  floor: z.number().int().min(1).optional(),
  roomTypeId: z.string().uuid(),
  notes: z.string().optional(),
});

const blockSchema = z.object({
  reason: z.string().min(1),
  blockStart: z.string().datetime().optional(),
  blockEnd: z.string().datetime().optional(),
});

// GET /api/rooms
router.get('/', async (_req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' },
    });

    // Auto-unblock expired blocks
    const now = new Date();
    for (const room of rooms) {
      if (room.status === 'BLOCKED' && room.blockEnd && new Date(room.blockEnd) < now) {
        await prisma.room.update({
          where: { id: room.id },
          data: { status: 'AVAILABLE', blockReason: null, blockStart: null, blockEnd: null },
        });
        room.status = 'AVAILABLE';
        room.blockReason = null;
        room.blockStart = null;
        room.blockEnd = null;
      }
    }

    res.json(rooms);
  } catch {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/rooms/available
router.get('/available', async (_req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { status: 'AVAILABLE' },
      include: { roomType: true },
      orderBy: { roomNumber: 'asc' },
    });
    res.json(rooms);
  } catch {
    res.status(500).json({ error: 'Failed to fetch available rooms' });
  }
});

// GET /api/rooms/:id
router.get('/:id', async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        roomType: true,
        bookings: {
          where: { status: 'CHECKED_IN' },
          include: { guest: true },
          take: 1,
        },
      },
    });
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json(room);
  } catch {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// POST /api/rooms
router.post('/', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = roomSchema.parse(req.body);
    const room = await prisma.room.create({
      data: {
        roomNumber: data.roomNumber,
        floor: data.floor || 1,
        roomTypeId: data.roomTypeId,
        notes: data.notes,
      },
      include: { roomType: true },
    });
    res.status(201).json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// PUT /api/rooms/:id
router.put('/:id', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = roomSchema.partial().parse(req.body);
    const room = await prisma.room.update({
      where: { id: req.params.id as string },
      data,
      include: { roomType: true },
    });
    res.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// PUT /api/rooms/:id/status
router.put('/:id/status', authorize('ADMIN', 'RECEPTION'), async (req: AuthRequest, res) => {
  try {
    const { status } = z.object({ status: z.enum(['AVAILABLE', 'CLEANING', 'BLOCKED']) }).parse(req.body);
    const room = await prisma.room.update({
      where: { id: req.params.id as string },
      data: {
        status,
        ...(status !== 'BLOCKED' && { blockReason: null, blockStart: null, blockEnd: null }),
      },
      include: { roomType: true },
    });
    res.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update room status' });
  }
});

// PUT /api/rooms/:id/block
router.put('/:id/block', authorize('ADMIN', 'RECEPTION'), async (req: AuthRequest, res) => {
  try {
    const data = blockSchema.parse(req.body);
    const room = await prisma.room.findUnique({ where: { id: req.params.id as string } });
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    if (room.status === 'OCCUPIED') {
      res.status(400).json({ error: 'Cannot block an occupied room' });
      return;
    }
    const updated = await prisma.room.update({
      where: { id: req.params.id as string },
      data: {
        status: 'BLOCKED',
        blockReason: data.reason,
        blockStart: data.blockStart ? new Date(data.blockStart) : new Date(),
        blockEnd: data.blockEnd ? new Date(data.blockEnd) : null,
      },
      include: { roomType: true },
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to block room' });
  }
});

// PUT /api/rooms/:id/unblock
router.put('/:id/unblock', authorize('ADMIN', 'RECEPTION'), async (req: AuthRequest, res) => {
  try {
    const room = await prisma.room.update({
      where: { id: req.params.id as string },
      data: {
        status: 'AVAILABLE',
        blockReason: null,
        blockStart: null,
        blockEnd: null,
      },
      include: { roomType: true },
    });
    res.json(room);
  } catch {
    res.status(500).json({ error: 'Failed to unblock room' });
  }
});

// DELETE /api/rooms/:id
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    await prisma.room.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Room deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

export default router;
