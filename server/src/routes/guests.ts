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
    
    // Search Primary Guests
    const where = search
      ? { OR: [{ phone: { contains: search } }, { name: { contains: search, mode: 'insensitive' as const } }] }
      : {};
      
    // Search Accompanying Guests
    const accWhere = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [primaryGuests, accompanyingGuests] = await Promise.all([
      prisma.guest.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 50 }),
      prisma.accompanyingGuest.findMany({ 
        where: accWhere, 
        take: 50,
        include: { booking: { select: { guest: { select: { phone: true } } } } } 
      })
    ]);

    // Normalize accompanying guests so they fit seamlessly into the Guest Directory table
    const mappedAccompanying = accompanyingGuests.map(ag => ({
      id: ag.id,
      name: ag.name,
      phone: ag.booking?.guest?.phone || '—',
      idProofType: ag.idProofType,
      idProofNumber: ag.idProofNumber,
      idProofUrl: ag.idProofFrontUrl,
      idProofBackUrl: ag.idProofBackUrl,
      isForeigner: ag.isForeigner,
      passportNo: ag.passportNo,
      country: ag.country,
      visitCount: 1,
      isAccompanying: true,
      bookingId: ag.bookingId,
      updatedAt: ag.updatedAt
    }));

    // Combine and sort by newest first
    const combinedGuests = [...primaryGuests, ...mappedAccompanying].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // Send to UI
    res.json(combinedGuests);
  } catch (err) {
    console.error('Failed to fetch guests:', err);
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
