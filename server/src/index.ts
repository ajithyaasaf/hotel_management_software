import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeCounters } from './utils/helpers';

dotenv.config();

import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import guestRoutes from './routes/guests';
import bookingRoutes from './routes/bookings';
import orderRoutes from './routes/orders';
import invoiceRoutes from './routes/invoices';
import paymentRoutes from './routes/payments';
import menuRoutes from './routes/menu';
import userRoutes from './routes/users';
import reportRoutes from './routes/reports';
import expenseRoutes from './routes/expenses';
import groupBookingRoutes from './routes/groupBookings';
import nightAuditRoutes from './routes/nightAudit';
import companyRoutes from './routes/companies';
import banquetRoutes from './routes/banquets';
import { Server } from 'http';
import { never } from 'zod';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/', (_req, res) => { res.status(200).json({ status: 'ok', message: 'Godiva Rooms API is running' }); });
app.get('/api/health', (_req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }); });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/group-bookings', groupBookingRoutes);
app.use('/api/night-audit', nightAuditRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/banquets', banquetRoutes);

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await initializeCounters();
  app.listen(PORT, () => {
    console.log(`🏨 Godiva Rooms server running on port ${PORT}`);
  });
}

start().catch(console.error);

export default app;