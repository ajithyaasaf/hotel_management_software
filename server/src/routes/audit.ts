import { Router } from 'express';
import prisma from '../utils/prisma';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();
router.use(authenticate, requirePermission('audit.view'));

// GET /api/audit?entity=&from=&to=&userId=&action=
router.get('/', async (req, res) => {
  try {
    const { entity, from, to, userId, action } = req.query;
    const where: any = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = userId;
    if (action) where.action = action;
    
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(String(from));
      if (to) { const t = new Date(String(to)); t.setHours(23, 59, 59, 999); where.createdAt.lte = t; }
    }
    
    const logs = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200, // Limit to recent 200 for performance, can add pagination later
    });
    
    // Parse JSON values for the frontend
    const parsedLogs = logs.map(log => ({
      ...log,
      oldValue: log.oldValue ? JSON.parse(log.oldValue) : null,
      newValue: log.newValue ? JSON.parse(log.newValue) : null,
    }));
    
    res.json(parsedLogs);
  } catch { res.status(500).json({ error: 'Failed to fetch audit log' }); }
});

// GET /api/audit/entities — get unique entities for filtering
router.get('/entities', async (_req, res) => {
  try {
    const entities = await prisma.auditLog.findMany({
      select: { entity: true },
      distinct: ['entity'],
      orderBy: { entity: 'asc' },
    });
    res.json(entities.map(e => e.entity));
  } catch { res.status(500).json({ error: 'Failed to fetch entities' }); }
});

// GET /api/audit/actions — get unique actions for filtering
router.get('/actions', async (req, res) => {
  try {
    const { entity } = req.query;
    const actions = await prisma.auditLog.findMany({
      where: entity ? { entity: String(entity) } : undefined,
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    res.json(actions.map(a => a.action));
  } catch { res.status(500).json({ error: 'Failed to fetch actions' }); }
});

export default router;
