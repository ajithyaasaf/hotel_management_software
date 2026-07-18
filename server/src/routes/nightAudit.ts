import { Router } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { nightAuditService } from '../services/nightAuditService';

const router = Router();
router.use(authenticate, requirePermission('nightaudit.view', 'nightaudit.run'));

router.get('/status', async (_req, res) => {
  try {
    const businessDateStr = await nightAuditService.getBusinessDate();
    const latestAudit = await prisma.nightAudit.findFirst({
      orderBy: { businessDate: 'desc' },
      include: { runBy: { select: { name: true } } },
    });
    res.json({
      currentBusinessDate: businessDateStr,
      businessDate: businessDateStr,
      lastAudit: latestAudit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit status' });
  }
});

router.get('/history', async (_req, res) => {
  try {
    const audits = await prisma.nightAudit.findMany({
      include: { runBy: { select: { name: true } } },
      orderBy: { businessDate: 'desc' },
      take: 30,
    });
    res.json(audits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit history' });
  }
});

router.get('/pre-check', async (_req, res) => {
  try {
    const result = await nightAuditService.runPreCheck();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Pre-check failed' });
  }
});

router.post('/run', requirePermission('nightaudit.run'), async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const result = await nightAuditService.runAudit(req.user.id, req.body.notes);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Audit execution failed' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const audit = await prisma.nightAudit.findUnique({
      where: { id: req.params.id },
      include: {
        runBy: { select: { name: true, role: true } },
        charges: {
          include: {
            booking: {
              include: {
                guest: { select: { name: true } },
              },
            },
            room: { select: { roomNumber: true } },
          },
        },
        orders: true,
      },
    });

    if (!audit) {
      res.status(404).json({ error: 'Audit session not found' });
      return;
    }

    res.json(audit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit details' });
  }
});

export default router;