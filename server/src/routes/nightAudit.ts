import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { nightAuditService } from '../services/nightAuditService';

const router = Router();
router.use(authenticate);

// GET /api/night-audit/status
// Visible to Admin and Reception (to show what business date they are operating under)
router.get('/status', async (req: AuthRequest, res) => {
  try {
    const businessDate = await nightAuditService.getBusinessDate();

    // Get last completed audit
    const lastAudit = await prisma.nightAudit.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { businessDate: 'desc' },
    });

    res.json({
      businessDate,
      lastAudit: lastAudit ? {
        id: lastAudit.id,
        businessDate: lastAudit.businessDate.toISOString().split('T')[0],
        completedAt: lastAudit.completedAt,
        totalRevenue: Number(lastAudit.totalRevenue),
      } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// GET /api/night-audit/pre-check
// Visible to Admin and Reception
router.get('/pre-check', async (req: AuthRequest, res) => {
  try {
    const preCheck = await nightAuditService.runPreCheck();
    res.json(preCheck);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to perform pre-check' });
  }
});

// POST /api/night-audit/run
// Visible to Admin and Reception (logs the user who ran it)
router.post('/run', authorize('ADMIN', 'RECEPTION'), async (req: AuthRequest, res) => {
  try {
    const { notes, password } = z.object({
      notes: z.string().optional(),
      password: z.string().min(1, 'Verification password is required'),
    }).parse(req.body);

    // Verify Password before allowing day-end close
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      res.status(401).json({ error: 'User session invalid' });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(400).json({ error: 'Invalid verification password. Authorization failed.' });
      return;
    }

    const result = await nightAuditService.runAudit(user.id, notes);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Night Audit execution failed' });
  }
});

// GET /api/night-audit/history
// Visible to Admin and Reception
router.get('/history', authorize('ADMIN', 'RECEPTION'), async (req: AuthRequest, res) => {
  try {
    const history = await prisma.nightAudit.findMany({
      orderBy: { businessDate: 'desc' },
      include: {
        runBy: { select: { name: true, role: true } },
      },
    });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit history' });
  }
});

// GET /api/night-audit/:id
// Visible to Admin and Reception
router.get('/:id', authorize('ADMIN', 'RECEPTION'), async (req: AuthRequest, res) => {
  try {
    const audit = await prisma.nightAudit.findUnique({
      where: { id: req.params.id as string },
      include: {
        runBy: { select: { name: true, role: true } },
        charges: {
          include: {
            booking: { include: { guest: true } },
            room: true,
          },
        },
        orders: true,
      },
    });
    if (!audit) {
      res.status(404).json({ error: 'Night Audit record not found' });
      return;
    }
    res.json(audit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit details' });
  }
});

export default router;