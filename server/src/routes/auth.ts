import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Load permissions for this role
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role: user.role },
      include: { permission: { select: { code: true } } },
    });
    const permissions = rolePermissions.map(rp => rp.permission.code);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: (error as any).errors });
      return;
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Load permissions
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { role: user.role },
      include: { permission: { select: { code: true } } },
    });

    res.json({
      ...user,
      permissions: rolePermissions.map(rp => rp.permission.code),
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/auth/users-by-department — for department-based login selection
// Public endpoint (no auth required) — only returns names and roles, no sensitive data
router.get('/users-by-department', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    // Group by department
    const departments = {
      management: users.filter(u => ['MD', 'ACCOUNT_MANAGER', 'OPERATIONAL_MANAGER'].includes(u.role)),
      reception: users.filter(u => u.role === 'RECEPTIONIST'),
      restaurant: users.filter(u => u.role === 'RESTAURANT_MANAGER'),
    };

    res.json(departments);
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;
