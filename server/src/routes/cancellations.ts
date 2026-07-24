import { Router } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

const router = Router();
router.use(authenticate);

// GET /api/cancellations — list pending/all cancellation requests
router.get('/', requirePermission('cancellation.notify', 'booking.cancel.approve'), async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const where: any = {};
    if (status) where.status = status;

    const requests = await prisma.cancellationRequest.findMany({
      where,
      include: {
        booking: { include: { guest: true, room: { include: { roomType: true } } } },
        requestedBy: { select: { name: true, role: true } },
        approvedBy: { select: { name: true, role: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 100,
    });
    res.json(requests);
  } catch { res.status(500).json({ error: 'Failed to fetch cancellation requests' }); }
});

// GET /api/cancellations/pending/count — badge count for notifications
router.get('/pending/count', requirePermission('cancellation.notify'), async (_req, res) => {
  try {
    const count = await prisma.cancellationRequest.count({ where: { status: 'PENDING' } });
    res.json({ count });
  } catch { res.status(500).json({ error: 'Failed to fetch count' }); }
});

// PUT /api/cancellations/:id/approve
router.put('/:id/approve', requirePermission('booking.cancel.approve'), async (req: AuthRequest, res) => {
  try {
    const { note } = req.body;
    const request = await prisma.cancellationRequest.findUnique({
      where: { id: req.params.id },
      include: { booking: { include: { room: true, guest: true } } },
    });

    if (!request) { res.status(404).json({ error: 'Request not found' }); return; }
    if (request.status !== 'PENDING') { res.status(400).json({ error: 'Request already resolved' }); return; }

    await prisma.$transaction(async (tx) => {
      await tx.cancellationRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED', approvedById: req.user!.id, approverNote: note || null, resolvedAt: new Date() },
      });
      await tx.booking.update({ where: { id: request.bookingId }, data: { status: 'CANCELLED' } });
      if (request.booking.status === 'CHECKED_IN') {
        await tx.room.update({ where: { id: request.booking.roomId }, data: { status: 'CLEANING' } });
      }
    });

    await createAuditLog({
      action: 'CANCELLATION_APPROVED',
      entity: 'booking',
      entityId: request.bookingId,
      details: `Approved by ${req.user!.name}. Guest: ${request.booking.guest?.name || 'Unknown'}. Room: ${request.booking.room?.roomNumber || 'N/A'}. Note: ${note || 'None'}`,
      userId: req.user!.id,
      oldValue: { status: 'PENDING' },
      newValue: { status: 'APPROVED', approver: req.user!.name, roomNumber: request.booking.room?.roomNumber, note: note || null }
    });

    res.json({ message: 'Cancellation approved' });
  } catch { res.status(500).json({ error: 'Failed to approve cancellation' }); }
});

// PUT /api/cancellations/:id/reject
router.put('/:id/reject', requirePermission('booking.cancel.approve'), async (req: AuthRequest, res) => {
  try {
    const { note } = req.body;
    const request = await prisma.cancellationRequest.findUnique({ where: { id: req.params.id }, include: { booking: true } });
    if (!request) { res.status(404).json({ error: 'Request not found' }); return; }
    if (request.status !== 'PENDING') { res.status(400).json({ error: 'Request already resolved' }); return; }

    await prisma.cancellationRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED', approvedById: req.user!.id, approverNote: note || null, resolvedAt: new Date() },
    });

    await createAuditLog({
      action: 'CANCELLATION_REJECTED',
      entity: 'booking',
      entityId: request.bookingId,
      details: `Rejected by ${req.user!.name}. Note: ${note || 'None'}`,
      userId: req.user!.id,
      oldValue: { status: 'PENDING' },
      newValue: { status: 'REJECTED', approver: req.user!.name, note: note || null }
    });

    res.json({ message: 'Cancellation rejected' });
  } catch { res.status(500).json({ error: 'Failed to reject cancellation' }); }
});

export default router;
