import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

const router = Router();
router.use(authenticate, requirePermission('staff.manage'));

// GET /api/users
router.get('/', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch { res.status(500).json({ error: 'Failed to fetch users' }); }
});

// POST /api/users
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      name: z.string().min(3).refine(val => !/^\d+$/.test(val), { message: "Name cannot be just numbers" }),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['MD', 'ACCOUNT_MANAGER', 'OPERATIONAL_MANAGER', 'RESTAURANT_MANAGER', 'RECEPTIONIST']),
    }).parse(req.body);

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) { res.status(409).json({ error: 'Email already exists' }); return; }

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { name: data.name, email: data.email, password: hashed, role: data.role as any },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await createAuditLog({ action: 'CREATE_USER', entity: 'user', entityId: user.id, details: `Created user "${data.name}" with role ${data.role}`, userId: req.user!.id });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      name: z.string().min(2).optional(),
      role: z.enum(['MD', 'ACCOUNT_MANAGER', 'OPERATIONAL_MANAGER', 'RESTAURANT_MANAGER', 'RECEPTIONIST']).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(6).optional(),
    }).parse(req.body);

    const updateData: any = { ...data };
    if (data.password) { updateData.password = await bcrypt.hash(data.password, 10); }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id as string }, select: { name: true, role: true, isActive: true } });
    
    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await createAuditLog({ action: 'UPDATE_USER', entity: 'user', entityId: user.id, details: `Updated user "${user.name}"`, userId: req.user!.id, oldValue: existing, newValue: { name: user.name, role: user.role, isActive: user.isActive } });
    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id (soft delete)
router.delete('/:id', async (req: AuthRequest, res) => {
  if (req.params.id === req.user!.id) { res.status(400).json({ error: 'Cannot delete yourself' }); return; }
  try {
    await prisma.user.update({ where: { id: req.params.id as string }, data: { isActive: false } });
    await createAuditLog({ action: 'DEACTIVATE_USER', entity: 'user', entityId: req.params.id as string, details: 'User deactivated', userId: req.user!.id });
    res.json({ message: 'User deactivated' });
  } catch { res.status(500).json({ error: 'Failed to deactivate user' }); }
});

export default router;
