import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

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
  blockStart: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid blockStart date" }).optional(),
  blockEnd: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid blockEnd date" }).optional(),
});

// GET /api/rooms
router.get('/', requirePermission('room.view', 'booking.create', 'pos.access'), async (_req, res) => {
  try {
    const rooms = await prisma.room.findMany({ include: { roomType: true }, orderBy: { roomNumber: 'asc' } });
    const now = new Date();
    for (const room of rooms) {
      if (room.status === 'BLOCKED' && room.blockEnd && new Date(room.blockEnd) < now) {
        await prisma.room.update({ where: { id: room.id }, data: { status: 'AVAILABLE', blockReason: null, blockStart: null, blockEnd: null } });
        room.status = 'AVAILABLE'; room.blockReason = null; room.blockStart = null; room.blockEnd = null;
      }
    }
    res.json(rooms);
  } catch { res.status(500).json({ error: 'Failed to fetch rooms' }); }
});

// GET /api/rooms/available
router.get('/available', async (_req, res) => {
  try {
    const rooms = await prisma.room.findMany({ where: { status: 'AVAILABLE' }, include: { roomType: true }, orderBy: { roomNumber: 'asc' } });
    res.json(rooms);
  } catch { res.status(500).json({ error: 'Failed to fetch available rooms' }); }
});

// GET /api/rooms/:id
router.get('/:id', async (req, res) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: req.params.id }, include: { roomType: true, bookings: { where: { status: 'CHECKED_IN' }, include: { guest: true }, take: 1 } } });
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
    res.json(room);
  } catch { res.status(500).json({ error: 'Failed to fetch room' }); }
});

// POST /api/rooms
router.post('/', requirePermission('room.manage'), async (req: AuthRequest, res) => {
  try {
    const data = roomSchema.parse(req.body);
    const room = await prisma.room.create({ data: { roomNumber: data.roomNumber, floor: data.floor || 1, roomTypeId: data.roomTypeId, notes: data.notes }, include: { roomType: true } });
    await createAuditLog({ action: 'CREATE_ROOM', entity: 'room', entityId: room.id, details: `Created Room ${room.roomNumber}`, userId: req.user!.id, newValue: { roomNumber: room.roomNumber, floor: room.floor, roomTypeId: room.roomTypeId } });
    res.status(201).json(room);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (error as any).errors }); return; }
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// PUT /api/rooms/:id
router.put('/:id', requirePermission('room.manage'), async (req: AuthRequest, res) => {
  try {
    const data = roomSchema.partial().parse(req.body);
    const existing = await prisma.room.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: 'Room not found' }); return; }
    const room = await prisma.room.update({ where: { id: req.params.id as string }, data, include: { roomType: true } });
    await createAuditLog({ action: 'UPDATE_ROOM', entity: 'room', entityId: room.id, details: `Updated Room ${room.roomNumber}`, userId: req.user!.id, oldValue: { roomNumber: existing.roomNumber, floor: existing.floor, notes: existing.notes }, newValue: { roomNumber: room.roomNumber, floor: room.floor, notes: room.notes } });
    res.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (error as any).errors }); return; }
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// PUT /api/rooms/:id/status
router.put('/:id/status', requirePermission('room.view'), async (req: AuthRequest, res) => {
  try {
    const { status } = z.object({ status: z.enum(['AVAILABLE', 'CLEANING', 'BLOCKED']) }).parse(req.body);
    const existing = await prisma.room.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: 'Room not found' }); return; }
    const room = await prisma.room.update({ where: { id: req.params.id as string }, data: { status, ...(status !== 'BLOCKED' && { blockReason: null, blockStart: null, blockEnd: null }) }, include: { roomType: true } });
    await createAuditLog({ action: 'UPDATE_ROOM_STATUS', entity: 'room', entityId: room.id, details: `Changed status of Room ${room.roomNumber} from ${existing.status} to ${status}`, userId: req.user!.id, oldValue: { status: existing.status }, newValue: { status, roomNumber: room.roomNumber } });
    res.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (error as any).errors }); return; }
    res.status(500).json({ error: 'Failed to update room status' });
  }
});

// PUT /api/rooms/:id/block
router.put('/:id/block', requirePermission('room.view'), async (req: AuthRequest, res) => {
  try {
    const data = blockSchema.parse(req.body);
    const room = await prisma.room.findUnique({ where: { id: req.params.id as string } });
    if (!room) { res.status(404).json({ error: 'Room not found' }); return; }
    if (room.status === 'OCCUPIED') { res.status(400).json({ error: 'Cannot block an occupied room' }); return; }
    const updated = await prisma.room.update({ where: { id: req.params.id as string }, data: { status: 'BLOCKED', blockReason: data.reason, blockStart: data.blockStart ? new Date(data.blockStart) : new Date(), blockEnd: data.blockEnd ? new Date(data.blockEnd) : null }, include: { roomType: true } });
    await createAuditLog({ action: 'BLOCK_ROOM', entity: 'room', entityId: updated.id, details: `Blocked room ${updated.roomNumber} - ${data.reason}`, userId: req.user!.id, oldValue: { status: room.status, blockReason: room.blockReason }, newValue: { status: 'BLOCKED', blockReason: data.reason } });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (error as any).errors }); return; }
    res.status(500).json({ error: 'Failed to block room' });
  }
});

// PUT /api/rooms/:id/unblock
router.put('/:id/unblock', requirePermission('room.view'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.room.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: 'Room not found' }); return; }
    const room = await prisma.room.update({ where: { id: req.params.id as string }, data: { status: 'AVAILABLE', blockReason: null, blockStart: null, blockEnd: null }, include: { roomType: true } });
    await createAuditLog({ action: 'UNBLOCK_ROOM', entity: 'room', entityId: room.id, details: `Unblocked room ${room.roomNumber}`, userId: req.user!.id, oldValue: { status: existing.status, blockReason: existing.blockReason }, newValue: { status: 'AVAILABLE', blockReason: null } });
    res.json(room);
  } catch { res.status(500).json({ error: 'Failed to unblock room' }); }
});

// DELETE /api/rooms/:id
router.delete('/:id', requirePermission('room.manage'), async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.room.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: 'Room not found' }); return; }
    await prisma.room.delete({ where: { id: req.params.id as string } });
    await createAuditLog({ action: 'DELETE_ROOM', entity: 'room', entityId: existing.id, details: `Deleted room ${existing.roomNumber}`, userId: req.user!.id, oldValue: { roomNumber: existing.roomNumber } });
    res.json({ message: 'Room deleted' });
  } catch { res.status(500).json({ error: 'Failed to delete room' }); }
});

export default router;