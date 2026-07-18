import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, requirePermission, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const companySchema = z.object({
  name: z.string().min(2),
  gstin: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  state: z.string().min(2),
  creditLimit: z.number().positive(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
});

router.get('/', requirePermission('corporate.view'), async (_req, res) => {
  try {
    const companies = await prisma.company.findMany({ orderBy: { name: 'asc' } });
    res.json(companies);
  } catch { res.status(500).json({ error: 'Failed to fetch companies' }); }
});

router.get('/:id', requirePermission('corporate.view'), async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id as string },
      include: {
        bookings: { include: { invoice: true, guest: true, room: { include: { roomType: true } } }, orderBy: { createdAt: 'desc' }, take: 50 },
        payments: { include: { createdBy: { select: { name: true } } }, orderBy: { paymentDate: 'desc' }, take: 50 },
      },
    });
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
    res.json(company);
  } catch { res.status(500).json({ error: 'Failed to fetch company' }); }
});

router.post('/', requirePermission('corporate.manage'), async (req: AuthRequest, res) => {
  try {
    const data = companySchema.parse(req.body);
    const existing = await prisma.company.findUnique({ where: { name: data.name } });
    if (existing) { res.status(400).json({ error: 'Company name already exists' }); return; }
    const company = await prisma.company.create({ data: {
      name: data.name,
      state: data.state,
      creditLimit: data.creditLimit,
      gstin: data.gstin || null,
      address: data.address || null,
      email: data.email || null,
      phone: data.phone || null,
    } });
    await createAuditLog({ action: 'CREATE_COMPANY', entity: 'company', entityId: company.id, details: `Created corporate account: ${company.name}`, userId: req.user!.id });
    res.status(201).json(company);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to create company' });
  }
});

router.put('/:id', requirePermission('corporate.manage'), async (req: AuthRequest, res) => {
  try {
    const data = companySchema.parse(req.body);
    const company = await prisma.company.findUnique({ where: { id: req.params.id as string } });
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
    const updated = await prisma.company.update({ where: { id: req.params.id as string }, data: {
      name: data.name,
      state: data.state,
      creditLimit: data.creditLimit,
      gstin: data.gstin || null,
      address: data.address || null,
      email: data.email || null,
      phone: data.phone || null,
    } });
    await createAuditLog({ action: 'UPDATE_COMPANY', entity: 'company', entityId: updated.id, details: `Updated corporate account: ${updated.name}`, userId: req.user!.id, oldValue: { name: company.name, creditLimit: Number(company.creditLimit), state: company.state }, newValue: { name: updated.name, creditLimit: Number(updated.creditLimit), state: updated.state } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to update company' });
  }
});

router.post('/:id/payments', requirePermission('corporate.manage', 'payment.manage'), async (req: AuthRequest, res) => {
  try {
    const { amount, method, referenceNo, paymentDate } = z.object({ amount: z.number().positive(), method: z.enum(['CASH', 'UPI', 'CARD']), referenceNo: z.string().optional().nullable(), paymentDate: z.string().datetime() }).parse(req.body);
    const company = await prisma.company.findUnique({ where: { id: req.params.id as string } });
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
    
    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.companyPayment.create({ data: { companyId: company.id, amount, method, referenceNo, paymentDate: new Date(paymentDate), createdById: req.user!.id } });
      await tx.company.update({ where: { id: company.id }, data: { outstandingBalance: { decrement: amount } } });
      return p;
    });

    await createAuditLog({ action: 'CORPORATE_PAYMENT', entity: 'company', entityId: company.id, details: `Payment of ₹${amount} received via ${method}`, userId: req.user!.id });
    res.status(201).json(payment);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

export default router;
