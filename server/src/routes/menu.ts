import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ─── MENU CATEGORIES ───────────────────────────────────────

// GET /api/menu/categories
router.get('/categories', async (_req, res) => {
  try {
    const cats = await prisma.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { items: { where: { isAvailable: true }, orderBy: { name: 'asc' } } },
    });
    res.json(cats);
  } catch { res.status(500).json({ error: 'Failed to fetch categories' }); }
});

// POST /api/menu/categories
router.post('/categories', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1), sortOrder: z.number().int().optional() }).parse(req.body);
    const cat = await prisma.menuCategory.create({ data });
    res.status(201).json(cat);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as z.ZodError).errors }); return; }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/menu/categories/:id
router.put('/categories/:id', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1).optional(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() }).parse(req.body);
    const cat = await prisma.menuCategory.update({ where: { id: req.params.id }, data });
    res.json(cat);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as z.ZodError).errors }); return; }
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/menu/categories/:id
router.delete('/categories/:id', authorize('ADMIN'), async (_req, res) => {
  try {
    await prisma.menuCategory.delete({ where: { id: _req.params.id } });
    res.json({ message: 'Category deleted' });
  } catch { res.status(500).json({ error: 'Failed to delete category' }); }
});

// ─── MENU ITEMS ────────────────────────────────────────────

// GET /api/menu/items
router.get('/items', async (req, res) => {
  try {
    const categoryId = req.query.categoryId as string | undefined;
    const available = req.query.available as string | undefined;
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (available === 'true') where.isAvailable = true;
    const items = await prisma.menuItem.findMany({
      where,
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    });
    res.json(items);
  } catch { res.status(500).json({ error: 'Failed to fetch items' }); }
});

// POST /api/menu/items
router.post('/items', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      price: z.number().positive(),
      categoryId: z.string().uuid(),
      description: z.string().optional().nullable(),
      isVeg: z.boolean().optional(),
    }).parse(req.body);
    const item = await prisma.menuItem.create({ data, include: { category: true } });
    res.status(201).json(item);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as z.ZodError).errors }); return; }
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/menu/items/:id
router.put('/items/:id', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      name: z.string().min(1).optional(),
      price: z.number().positive().optional(),
      categoryId: z.string().uuid().optional(),
      description: z.string().optional().nullable(),
      isVeg: z.boolean().optional(),
      isAvailable: z.boolean().optional(),
    }).parse(req.body);
    const item = await prisma.menuItem.update({ where: { id: req.params.id }, data, include: { category: true } });
    res.json(item);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as z.ZodError).errors }); return; }
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/menu/items/:id
router.delete('/items/:id', authorize('ADMIN'), async (_req, res) => {
  try {
    await prisma.menuItem.delete({ where: { id: _req.params.id } });
    res.json({ message: 'Item deleted' });
  } catch { res.status(500).json({ error: 'Failed to delete item' }); }
});

// ─── ROOM TYPES ────────────────────────────────────────────

// GET /api/menu/room-types
router.get('/room-types', async (_req, res) => {
  try {
    const types = await prisma.roomType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch { res.status(500).json({ error: 'Failed to fetch room types' }); }
});

// POST /api/menu/room-types
router.post('/room-types', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1), basePrice: z.number().positive(), description: z.string().optional() }).parse(req.body);
    const rt = await prisma.roomType.create({ data });
    res.status(201).json(rt);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as z.ZodError).errors }); return; }
    res.status(500).json({ error: 'Failed to create room type' });
  }
});

// PUT /api/menu/room-types/:id
router.put('/room-types/:id', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1).optional(), basePrice: z.number().positive().optional(), description: z.string().optional() }).parse(req.body);
    const rt = await prisma.roomType.update({ where: { id: req.params.id }, data });
    res.json(rt);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as z.ZodError).errors }); return; }
    res.status(500).json({ error: 'Failed to update room type' });
  }
});

// DELETE /api/menu/room-types/:id
router.delete('/room-types/:id', authorize('ADMIN'), async (_req, res) => {
  try {
    await prisma.roomType.delete({ where: { id: _req.params.id } });
    res.json({ message: 'Room type deleted' });
  } catch { res.status(500).json({ error: 'Failed to delete room type' }); }
});

export default router;
