import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('ADMIN'));

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
      name: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(['ADMIN', 'RECEPTION', 'RESTAURANT']),
    }).parse(req.body);

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) { res.status(409).json({ error: 'Email already exists' }); return; }

    const hashed = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { ...data, password: hashed },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: err.errors }); return; }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      name: z.string().min(2).optional(),
      role: z.enum(['ADMIN', 'RECEPTION', 'RESTAURANT']).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(6).optional(),
    }).parse(req.body);

    const updateData: any = { ...data };
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json(user);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: err.errors }); return; }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  if (req.params.id === req.user!.id) { res.status(400).json({ error: 'Cannot delete yourself' }); return; }
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'User deactivated' });
  } catch { res.status(500).json({ error: 'Failed to deactivate user' }); }
});

export default router;
