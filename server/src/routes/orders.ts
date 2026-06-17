import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createAuditLog, generateOrderNumber } from '../utils/helpers';

const router = Router();
router.use(authenticate);

const createOrderSchema = z.object({
  type: z.enum(['ROOM', 'WALK_IN', 'TAKEAWAY']),
  roomId: z.string().uuid().optional().nullable(),
  customerName: z.string().min(3).refine(val => !/^\d+$/.test(val), { message: "Name cannot be just numbers" }).optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const roomId = req.query.roomId as string | undefined;
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (roomId) where.roomId = roomId;
    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { menuItem: { include: { category: true } } } },
        room: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(orders);
  } catch { res.status(500).json({ error: 'Failed to fetch orders' }); }
});

// GET /api/orders/active
router.get('/active', async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: 'ACTIVE' },
      include: {
        items: { include: { menuItem: true } },
        room: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch { res.status(500).json({ error: 'Failed to fetch active orders' }); }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id as string },
      include: {
        items: { include: { menuItem: { include: { category: true } } } },
        room: true,
        payments: true,
        createdBy: { select: { name: true } },
      },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    res.json(order);
  } catch { res.status(500).json({ error: 'Failed to fetch order' }); }
});

// POST /api/orders
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createOrderSchema.parse(req.body);
    if (data.type === 'ROOM' && !data.roomId) {
      res.status(400).json({ error: 'roomId is required for ROOM orders' }); return;
    }
    if (data.type === 'ROOM' && data.roomId) {
      const room = await prisma.room.findUnique({ where: { id: data.roomId } });
      if (!room || room.status !== 'OCCUPIED') {
        res.status(400).json({ error: 'Room must be occupied for room orders' }); return;
      }
    }

    // Fetch menu items to validate + price
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: data.items.map(i => i.menuItemId) }, isAvailable: true },
    });
    if (menuItems.length !== data.items.length) {
      res.status(400).json({ error: 'One or more items unavailable' }); return;
    }

    const priceMap = new Map(menuItems.map(m => [m.id, Number(m.price)]));
    const TAX_RATE = 0.05; // 5% each CGST+SGST = 10% total food tax

    let subtotal = 0;
    const orderItemsData = data.items.map(item => {
      const unitPrice = priceMap.get(item.menuItemId)!;
      const total = unitPrice * item.quantity;
      subtotal += total;
      return { menuItemId: item.menuItemId, quantity: item.quantity, unitPrice, totalPrice: total };
    });

    const tax = parseFloat((subtotal * TAX_RATE * 2).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        type: data.type,
        roomId: data.roomId,
        customerName: data.customerName,
        notes: data.notes,
        subtotal,
        tax,
        total,
        createdById: req.user!.id,
        items: { create: orderItemsData },
      },
      include: { items: { include: { menuItem: true } }, room: true },
    });

    // Real-time invoice sync is deferred until the order status is updated to COMPLETED.

    res.status(201).json(order);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    console.error(err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /api/orders/:id/items — add item to active order
router.post('/:id/items', async (req: AuthRequest, res) => {
  try {
    const { menuItemId, quantity } = z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().positive(),
    }).parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: req.params.id as string } });
    if (!order || order.status !== 'ACTIVE') { res.status(400).json({ error: 'Order not active' }); return; }

    const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem || !menuItem.isAvailable) { res.status(400).json({ error: 'Item unavailable' }); return; }

    const unitPrice = Number(menuItem.price);
    const totalPrice = unitPrice * quantity;
    const TAX_RATE = 0.10;

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.create({ data: { orderId: order.id, menuItemId, quantity, unitPrice, totalPrice } });
      const newSubtotal = Number(order.subtotal) + totalPrice;
      const newTax = parseFloat((newSubtotal * TAX_RATE).toFixed(2));
      const newTotal = parseFloat((newSubtotal + newTax).toFixed(2));
      await tx.order.update({ where: { id: order.id }, data: { subtotal: newSubtotal, tax: newTax, total: newTotal } });

      // Real-time invoice sync is deferred until the order status is updated to COMPLETED.
    });

    const updated = await prisma.order.findUnique({ where: { id: req.params.id as string }, include: { items: { include: { menuItem: true } } } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Invalid input', details: (err as any).errors }); return; }
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// DELETE /api/orders/:id/items/:itemId — cancel order item
router.delete('/:id/items/:itemId', async (req: AuthRequest, res) => {
  try {
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const item = await prisma.orderItem.findUnique({ where: { id: req.params.itemId as string }, include: { order: true } }) as any;
    if (!item || item.isCancelled) { res.status(400).json({ error: 'Item not found or already cancelled' }); return; }
    if (item.order.status !== 'ACTIVE') { res.status(400).json({ error: 'Order is not active' }); return; }

    const refundAmount = Number(item.totalPrice);
    const TAX_RATE = 0.10;

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.update({ where: { id: item.id }, data: { isCancelled: true, cancelReason: reason, cancelledAt: new Date() } });
      const newSubtotal = Number(item.order.subtotal) - refundAmount;
      const newTax = parseFloat((newSubtotal * TAX_RATE).toFixed(2));
      const newTotal = parseFloat((newSubtotal + newTax).toFixed(2));
      await tx.order.update({ where: { id: item.orderId }, data: { subtotal: newSubtotal, tax: newTax, total: newTotal } });

      // Real-time invoice sync is deferred until the order status is updated to COMPLETED.
    });

    await createAuditLog({ action: 'CANCEL_ITEM', entity: 'order_item', entityId: item.id, details: reason || 'Item cancelled', userId: req.user!.id });
    res.json({ message: 'Item cancelled' });
  } catch { res.status(500).json({ error: 'Failed to cancel item' }); }
});

// PUT /api/orders/:id/complete
router.put('/:id/complete', async (req: AuthRequest, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id as string } });
    if (!order || order.status !== 'ACTIVE') { res.status(400).json({ error: 'Order not active' }); return; }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } });

      // Sync invoice if room order
      if (order.type === 'ROOM' && order.roomId) {
        const activeBooking = await tx.booking.findFirst({
          where: { roomId: order.roomId, status: 'CHECKED_IN' },
          include: { invoice: true },
        });
        if (activeBooking?.invoice) {
          const newFoodCharges = Number(activeBooking.invoice.foodCharges) + Number(order.total);
          const newSubtotal = Number(activeBooking.invoice.roomCharges) + newFoodCharges + Number(activeBooking.invoice.extraCharges) - Number(activeBooking.invoice.discountAmount);
          
          const roomCharges = Number(activeBooking.invoice.roomCharges);
          const cgst = parseFloat((roomCharges * 0.06).toFixed(2));
          const sgst = parseFloat((roomCharges * 0.06).toFixed(2));
          const roomTax = cgst + sgst;
          
          const newGrand = parseFloat((newSubtotal + roomTax).toFixed(2));

          let companyAmount = 0;
          let guestAmount = 0;

          if (activeBooking.billingRule === 'COMPANY_ALL') {
            companyAmount = newGrand;
            guestAmount = 0;
          } else if (activeBooking.billingRule === 'COMPANY_ROOM_ONLY') {
            companyAmount = parseFloat((roomCharges + roomTax).toFixed(2));
            guestAmount = Math.max(0, parseFloat((newGrand - companyAmount).toFixed(2)));
          } else {
            companyAmount = 0;
            guestAmount = newGrand;
          }

          await tx.invoice.update({
            where: { id: activeBooking.invoice.id },
            data: {
              foodCharges: newFoodCharges,
              subtotal: newSubtotal,
              cgst,
              sgst,
              totalTax: roomTax,
              grandTotal: newGrand,
              companyAmount,
              guestAmount,
              pendingAmount: guestAmount - Number(activeBooking.invoice.amountPaid),
            },
          });
        }
      }
      return updated;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete order' });
  }
});

// PUT /api/orders/:id/cancel
router.put('/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const order = await prisma.order.findUnique({ where: { id: req.params.id as string } });
    if (!order || order.status !== 'ACTIVE') { res.status(400).json({ error: 'Order not active' }); return; }
    
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });

      // Real-time invoice sync is deferred until the order status is updated to COMPLETED.
    });

    await createAuditLog({ action: 'CANCEL_ORDER', entity: 'order', entityId: order.id, details: reason, userId: req.user!.id });
    res.json({ message: 'Order cancelled' });
  } catch { res.status(500).json({ error: 'Failed to cancel order' }); }
});

export default router;
