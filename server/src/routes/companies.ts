import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/helpers';

const router = Router();

router.use(authenticate);

const companySchema = z.object({
  name: z.string().min(1),
  gstin: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  state: z.string().default('Tamil Nadu'),
  creditLimit: z.number().positive().default(100000),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['CASH', 'UPI', 'CARD']),
  referenceNo: z.string().min(1),
});

// GET /api/companies
router.get('/', async (_req, res) => {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// GET /api/companies/:id
router.get('/:id', async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id as string },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          include: { guest: true, room: true, invoice: true },
          take: 50,
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          include: { createdBy: true },
        },
      },
    });

    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch company details' });
  }
});

// POST /api/companies
router.post('/', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = companySchema.parse(req.body);
    const existing = await prisma.company.findUnique({ where: { name: data.name } });
    if (existing) {
      res.status(400).json({ error: 'Company name already exists' });
      return;
    }

    const company = await prisma.company.create({
      data: {
        name: data.name,
        gstin: data.gstin || null,
        address: data.address || null,
        state: data.state,
        creditLimit: data.creditLimit,
        email: data.email || null,
        phone: data.phone || null,
      },
    });

    await createAuditLog({
      action: 'CREATE_COMPANY',
      entity: 'company',
      entityId: company.id,
      details: `Created company: ${company.name}`,
      userId: req.user!.id,
    });

    res.status(201).json(company);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: (err as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// PUT /api/companies/:id
router.put('/:id', authorize('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const data = companySchema.partial().parse(req.body);
    
    // Check if renaming to a name that already exists elsewhere
    if (data.name) {
      const existing = await prisma.company.findFirst({
        where: {
          name: data.name,
          id: { not: req.params.id as string },
        },
      });
      if (existing) {
        res.status(400).json({ error: 'Company name already exists' });
        return;
      }
    }

    const company = await prisma.company.update({
      where: { id: req.params.id as string },
      data: {
        ...data,
        gstin: data.gstin === '' ? null : data.gstin,
        address: data.address === '' ? null : data.address,
        email: data.email === '' ? null : data.email,
        phone: data.phone === '' ? null : data.phone,
      },
    });

    await createAuditLog({
      action: 'UPDATE_COMPANY',
      entity: 'company',
      entityId: company.id,
      details: `Updated company: ${company.name}`,
      userId: req.user!.id,
    });

    res.json(company);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: (err as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// POST /api/companies/:id/payments (Corporate Reconciliation / Ledger payment)
router.post('/:id/payments', authorize('ADMIN', 'RECEPTION'), async (req: AuthRequest, res) => {
  try {
    const data = paymentSchema.parse(req.body);
    const company = await prisma.company.findUnique({ where: { id: req.params.id as string } });
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the CompanyPayment
      const companyPayment = await tx.companyPayment.create({
        data: {
          companyId: company.id,
          amount: data.amount,
          method: data.method,
          referenceNo: data.referenceNo,
          createdById: req.user!.id,
        },
      });

      // 2. Decrement the company's outstandingBalance
      const updatedCompany = await tx.company.update({
        where: { id: company.id },
        data: {
          outstandingBalance: {
            decrement: data.amount,
          },
        },
      });

      return { companyPayment, updatedCompany };
    });

    await createAuditLog({
      action: 'RECORD_COMPANY_PAYMENT',
      entity: 'company_payment',
      entityId: result.companyPayment.id,
      details: `Recorded company payment of ₹${data.amount} for ${company.name}. Ref: ${data.referenceNo}`,
      userId: req.user!.id,
    });

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: (err as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to record company payment' });
  }
});

export default router;
