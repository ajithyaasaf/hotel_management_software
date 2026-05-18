import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

const router = Router();
router.use(authenticate);
router.use(authorize('ADMIN')); // all expense routes are admin-only

const expenseSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  category: z.enum([
    'ELECTRICITY', 'WATER', 'STAFF_SALARY', 'KITCHEN_SUPPLIES',
    'LAUNDRY', 'MAINTENANCE', 'HOUSEKEEPING', 'MARKETING', 'MISCELLANEOUS',
  ]),
  amount: z.number().positive('Amount must be a positive number'),
  paidDate: z.string().datetime(),
  method: z.enum(['CASH', 'UPI', 'CARD']),
  notes: z.string().optional().nullable(),
});

// GET /api/expenses?from=&to=&category=
router.get('/', async (req, res) => {
  try {
    const { from, to, category } = req.query;
    const where: any = {};

    if (category) where.category = String(category);
    if (from || to) {
      where.paidDate = {};
      if (from) where.paidDate.gte = new Date(String(from));
      if (to) {
        const toDate = new Date(String(to));
        toDate.setHours(23, 59, 59, 999);
        where.paidDate.lte = toDate;
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: { createdBy: { select: { name: true } } },
      orderBy: { paidDate: 'desc' },
    });

    res.json(expenses);
  } catch { res.status(500).json({ error: 'Failed to fetch expenses' }); }
});

// GET /api/expenses/summary?from=&to= — returns totals by category
router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where: any = {};
    if (from || to) {
      where.paidDate = {};
      if (from) where.paidDate.gte = new Date(String(from));
      if (to) {
        const toDate = new Date(String(to));
        toDate.setHours(23, 59, 59, 999);
        where.paidDate.lte = toDate;
      }
    }

    const expenses = await prisma.expense.findMany({ where });
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

    // Group by category
    const byCategory: Record<string, number> = {};
    expenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    });

    res.json({
      total: parseFloat(total.toFixed(2)),
      byCategory,
      count: expenses.length,
    });
  } catch { res.status(500).json({ error: 'Failed to fetch expense summary' }); }
});

// POST /api/expenses
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = expenseSchema.parse(req.body);

    // Guard: paidDate cannot be in the future
    const paidDate = new Date(data.paidDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (paidDate >= tomorrow) {
      res.status(400).json({ error: 'Expense date cannot be in the future' });
      return;
    }

    const expense = await prisma.expense.create({
      data: {
        title: data.title,
        category: data.category,
        amount: data.amount,
        paidDate,
        method: data.method,
        notes: data.notes ?? null,
        createdById: req.user!.id,
      },
      include: { createdBy: { select: { name: true } } },
    });

    await createAuditLog({
      action: 'CREATE_EXPENSE',
      entity: 'expense',
      entityId: expense.id,
      details: `${data.category}: ${data.title} — ₹${data.amount}`,
      userId: req.user!.id,
    });

    res.status(201).json(expense);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.issues });
      return;
    }
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const data = expenseSchema.parse(req.body);
    const { id } = req.params;
    const existing = await prisma.expense.findUnique({ where: { id: id as string } });
    if (!existing) { res.status(404).json({ error: 'Expense not found' }); return; }

    const paidDate = new Date(data.paidDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    if (paidDate >= tomorrow) {
      res.status(400).json({ error: 'Expense date cannot be in the future' });
      return;
    }

    const updated = await prisma.expense.update({
      where: { id: id as string },
      data: { title: data.title, category: data.category, amount: data.amount, paidDate, method: data.method, notes: data.notes ?? null },
      include: { createdBy: { select: { name: true } } },
    });

    await createAuditLog({
      action: 'UPDATE_EXPENSE',
      entity: 'expense',
      entityId: updated.id,
      details: `Updated: ${data.title} — ₹${data.amount}`,
      userId: req.user!.id,
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: err.issues });
      return;
    }
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.expense.findUnique({ where: { id: id as string } });
    if (!existing) { res.status(404).json({ error: 'Expense not found' }); return; }

    await prisma.expense.delete({ where: { id: id as string } });

    await createAuditLog({
      action: 'DELETE_EXPENSE',
      entity: 'expense',
      entityId: id as string,
      details: `Deleted: ${existing.title} — ₹${Number(existing.amount)}`,
      userId: req.user!.id,
    });

    res.json({ message: 'Expense deleted' });
  } catch { res.status(500).json({ error: 'Failed to delete expense' }); }
});

export default router;
