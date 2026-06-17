import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate } from '../middleware/auth';
import { uploadToCloudinary } from '../utils/cloudinary';

const router = Router();
router.use(authenticate);

// GET /api/guests?search=
router.get('/', async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const where = search
      ? {
          OR: [
            { phone: { contains: search } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const guests = await prisma.guest.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 50 });
    res.json(guests);
  } catch {
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
});

// GET /api/guests/search?phone=
router.get('/search', async (req, res) => {
  try {
    const phone = String(req.query.phone || '');
    if (!phone) { res.status(400).json({ error: 'Phone required' }); return; }
    const guest = await prisma.guest.findFirst({
      where: { phone: { contains: phone } },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { room: { include: { roomType: true } } },
        },
      },
    });
    res.json(guest);
  } catch {
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/guests/:id
router.get('/:id', async (req, res) => {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: req.params.id as string },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          include: { room: { include: { roomType: true } }, invoice: true },
        },
      },
    });
    if (!guest) { res.status(404).json({ error: 'Guest not found' }); return; }
    res.json(guest);
  } catch {
    res.status(500).json({ error: 'Failed to fetch guest' });
  }
});

// PUT /api/guests/:id
router.put('/:id', async (req, res) => {
  try {
    const data = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional().nullable(),
      idProofType: z.string().optional().nullable(),
      idProofNumber: z.string().optional().nullable(),
      idProofImage: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(req.body);

    let idProofUrl: string | undefined = undefined;
    if (data.idProofImage) {
      idProofUrl = await uploadToCloudinary(data.idProofImage);
    }

    const guest = await prisma.guest.update({
      where: { id: req.params.id as string },
      data: {
        name: data.name,
        email: data.email,
        idProofType: data.idProofType,
        idProofNumber: data.idProofNumber,
        address: data.address,
        notes: data.notes,
        ...(idProofUrl && { idProofUrl }),
      },
    });
    res.json(guest);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to update guest' });
  }
});

export default router;
