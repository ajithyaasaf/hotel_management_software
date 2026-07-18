import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';
import { invalidateTaxCache } from '../utils/tax';

const router = Router();
router.use(authenticate);

// ─── MENU CATEGORIES ───────────────────────────────────────

router.get('/categories', async (_req, res) => {
  try {
    const cats = await prisma.menuCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { items: { where: { isAvailable: true }, orderBy: { name: 'asc' } } } });
    res.json(cats);
  } catch { res.status(500).json({ error: 'Failed to fetch categories' }); }
});

router.post('/categories', requirePermission('menu.manage'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1), sortOrder: z.number().int().optional() }).parse(req.body);
    const cat = await prisma.menuCategory.create({ data: { name: data.name, sortOrder: data.sortOrder || 0 } });
    res.status(201).json(cat);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', requirePermission('menu.manage'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1).optional(), sortOrder: z.number().int().optional(), isActive: z.boolean().optional() }).parse(req.body);
    const cat = await prisma.menuCategory.update({ where: { id: req.params.id as string }, data });
    res.json(cat);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', requirePermission('menu.manage'), async (_req, res) => {
  try {
    await prisma.menuCategory.delete({ where: { id: _req.params.id as string } });
    res.json({ message: 'Category deleted' });
  } catch { res.status(500).json({ error: 'Failed to delete category' }); }
});

// ─── MENU ITEMS ────────────────────────────────────────────

router.get('/items', async (req, res) => {
  try {
    const categoryId = req.query.categoryId as string | undefined;
    const available = req.query.available as string | undefined;
    const search = req.query.search as string | undefined;
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (available === 'true') where.isAvailable = true;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    const items = await prisma.menuItem.findMany({ where, include: { category: true }, orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }] });
    res.json(items);
  } catch { res.status(500).json({ error: 'Failed to fetch items' }); }
});

router.post('/items', requirePermission('menu.manage'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1), price: z.number().positive(), categoryId: z.string().uuid(), description: z.string().optional().nullable(), isVeg: z.boolean().optional() }).parse(req.body);
    const item = await prisma.menuItem.create({ data: { name: data.name, price: data.price, categoryId: data.categoryId, description: data.description, isVeg: data.isVeg || false }, include: { category: true } });
    res.status(201).json(item);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to create item' });
  }
});

router.put('/items/:id', requirePermission('menu.manage'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1).optional(), price: z.number().positive().optional(), categoryId: z.string().uuid().optional(), description: z.string().optional().nullable(), isVeg: z.boolean().optional(), isAvailable: z.boolean().optional() }).parse(req.body);
    const item = await prisma.menuItem.update({ where: { id: req.params.id as string }, data, include: { category: true } });
    res.json(item);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to update item' });
  }
});

router.delete('/items/:id', requirePermission('menu.manage'), async (_req, res) => {
  try {
    await prisma.menuItem.delete({ where: { id: _req.params.id as string } });
    res.json({ message: 'Item deleted' });
  } catch { res.status(500).json({ error: 'Failed to delete item' }); }
});

// ─── ROOM TYPES (Tariff) ──────────────────────────────────

router.get('/room-types', async (_req, res) => {
  try {
    const types = await prisma.roomType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch { res.status(500).json({ error: 'Failed to fetch room types' }); }
});

router.post('/room-types', requirePermission('tariff.edit'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1), basePrice: z.number().positive(), description: z.string().optional() }).parse(req.body);
    const rt = await prisma.roomType.create({ data: { name: data.name, basePrice: data.basePrice, description: data.description || '' } });
    await createAuditLog({ action: 'CREATE_ROOM_TYPE', entity: 'roomType', entityId: rt.id, details: `Created "${data.name}" at ₹${data.basePrice}`, userId: req.user!.id, newValue: { name: data.name, basePrice: data.basePrice } });
    res.status(201).json(rt);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to create room type' });
  }
});

router.put('/room-types/:id', requirePermission('tariff.edit'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({ name: z.string().min(1).optional(), basePrice: z.number().positive().optional(), description: z.string().optional() }).parse(req.body);
    const existing = await prisma.roomType.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: 'Room type not found' }); return; }
    const rt = await prisma.roomType.update({ where: { id: req.params.id as string }, data });

    await createAuditLog({
      action: 'UPDATE_TARIFF', entity: 'roomType', entityId: rt.id,
      details: `Updated "${rt.name}": ₹${Number(existing.basePrice)} → ₹${Number(rt.basePrice)}`,
      userId: req.user!.id,
      oldValue: { name: existing.name, basePrice: Number(existing.basePrice) },
      newValue: { name: rt.name, basePrice: Number(rt.basePrice) },
    });
    res.json(rt);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to update room type' });
  }
});

router.delete('/room-types/:id', requirePermission('tariff.edit'), async (req: AuthRequest, res) => {
  try {
    await prisma.roomType.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Room type deleted' });
  } catch { res.status(500).json({ error: 'Failed to delete room type' }); }
});

// ─── TAX CONFIG ────────────────────────────────────────────

router.get('/tax-config', async (_req, res) => {
  try {
    const config = await prisma.taxConfig.findMany();
    res.json(config);
  } catch { res.status(500).json({ error: 'Failed to fetch tax config' }); }
});

router.put('/tax-config/:id', requirePermission('settings.manage'), async (req: AuthRequest, res) => {
  try {
    const { rate } = z.object({ rate: z.number().min(0).max(100) }).parse(req.body);
    const existing = await prisma.taxConfig.findUnique({ where: { id: req.params.id as string } });
    if (!existing) { res.status(404).json({ error: 'Tax config not found' }); return; }
    const updated = await prisma.taxConfig.update({ where: { id: req.params.id as string }, data: { rate } });
    invalidateTaxCache();
    await createAuditLog({ action: 'UPDATE_TAX_CONFIG', entity: 'taxConfig', entityId: updated.id, details: `${existing.name}: ${Number(existing.rate)}% → ${rate}%`, userId: req.user!.id, oldValue: { name: existing.name, rate: Number(existing.rate) }, newValue: { name: updated.name, rate: Number(updated.rate) } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to update tax config' });
  }
});

export default router;
