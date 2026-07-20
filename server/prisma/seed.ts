import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Default Permissions Matrix ─────────────────────────
// Each permission code maps to the roles that should have it by default.
// MD always has all permissions (enforced in middleware), so we don't need to list MD here,
// but we include it for visibility in the admin UI.

const PERMISSIONS: Array<{
  code: string;
  name: string;
  module: string;
  description: string;
  defaultRoles: UserRole[];
}> = [
    // Dashboard
    { code: 'dashboard.view', name: 'View Dashboard', module: 'dashboard', description: 'Access the main dashboard', defaultRoles: ['MD', 'ACCOUNT_MANAGER', 'OPERATIONAL_MANAGER', 'RESTAURANT_MANAGER', 'RECEPTIONIST'] },

    // Rooms
    { code: 'room.view', name: 'View Rooms', module: 'room', description: 'View room list and statuses', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'room.manage', name: 'Manage Rooms', module: 'room', description: 'Create, edit, block/unblock rooms', defaultRoles: ['MD', 'OPERATIONAL_MANAGER'] },

    // Bookings
    { code: 'booking.view', name: 'View Bookings', module: 'booking', description: 'View all bookings', defaultRoles: ['MD', 'ACCOUNT_MANAGER', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'booking.create', name: 'Create Bookings', module: 'booking', description: 'Create new bookings and check-ins', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'booking.checkin', name: 'Check-In Guests', module: 'booking', description: 'Check in advance bookings', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'booking.checkout', name: 'Check-Out Guests', module: 'booking', description: 'Check out guests', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'booking.extend', name: 'Extend Stay', module: 'booking', description: 'Extend guest stay dates', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'booking.transfer', name: 'Room Transfer', module: 'booking', description: 'Transfer guest to different room', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'booking.cancel', name: 'Cancel Bookings (Direct)', module: 'booking', description: 'Cancel bookings without approval', defaultRoles: ['MD', 'OPERATIONAL_MANAGER'] },
    { code: 'booking.cancel.request', name: 'Request Cancellation', module: 'booking', description: 'Submit cancellation request for approval', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'booking.cancel.approve', name: 'Approve Cancellations', module: 'booking', description: 'Approve or reject cancellation requests', defaultRoles: ['MD', 'OPERATIONAL_MANAGER'] },

    // Guests
    { code: 'guest.view', name: 'View Guests', module: 'guest', description: 'View guest directory', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },

    // Corporate
    { code: 'corporate.view', name: 'View Corporate Ledger', module: 'corporate', description: 'View company accounts', defaultRoles: ['MD', 'ACCOUNT_MANAGER', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'corporate.manage', name: 'Manage Corporate Accounts', module: 'corporate', description: 'Create/edit companies, record payments', defaultRoles: ['MD', 'ACCOUNT_MANAGER'] },

    // Tariff
    { code: 'tariff.edit', name: 'Edit Room Tariffs', module: 'tariff', description: 'Modify room type base prices', defaultRoles: ['MD'] },

    // POS & Orders
    { code: 'pos.access', name: 'Access Restaurant POS', module: 'pos', description: 'Use the POS terminal', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RESTAURANT_MANAGER', 'RECEPTIONIST'] },
    { code: 'order.view', name: 'View Orders', module: 'order', description: 'View order history', defaultRoles: ['MD', 'ACCOUNT_MANAGER', 'OPERATIONAL_MANAGER', 'RESTAURANT_MANAGER', 'RECEPTIONIST'] },
    { code: 'order.manage', name: 'Manage Orders', module: 'order', description: 'Create, cancel, complete orders', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RESTAURANT_MANAGER', 'RECEPTIONIST'] },

    // Menu
    { code: 'menu.manage', name: 'Manage Menu', module: 'menu', description: 'Add/edit menu categories and items', defaultRoles: ['MD', 'RESTAURANT_MANAGER'] },

    // Expenses
    { code: 'expense.view', name: 'View Expenses', module: 'expense', description: 'View expense records and reports', defaultRoles: ['MD', 'ACCOUNT_MANAGER', 'RESTAURANT_MANAGER'] },
    { code: 'expense.manage', name: 'Manage Expenses', module: 'expense', description: 'Create, edit, delete expenses', defaultRoles: ['MD', 'ACCOUNT_MANAGER'] },

    // Reports
    { code: 'report.view', name: 'View Reports', module: 'report', description: 'Access financial reports', defaultRoles: ['MD', 'ACCOUNT_MANAGER'] },

    // Banquets
    { code: 'banquet.view', name: 'View Banquets', module: 'banquet', description: 'View banquet halls and bookings', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'banquet.manage', name: 'Manage Banquets', module: 'banquet', description: 'Create/manage banquet bookings and halls', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },

    // Night Audit
    { code: 'nightaudit.view', name: 'View Night Audit', module: 'nightaudit', description: 'View audit status and history', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },
    { code: 'nightaudit.run', name: 'Run Night Audit', module: 'nightaudit', description: 'Execute night audit process', defaultRoles: ['MD', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },

    // Staff
    { code: 'staff.manage', name: 'Manage Staff', module: 'staff', description: 'Create/edit user accounts', defaultRoles: ['MD'] },

    // Settings
    { code: 'settings.manage', name: 'Manage Settings', module: 'settings', description: 'Modify system settings, room types, tax config', defaultRoles: ['MD'] },

    // Audit Logs
    { code: 'audit.view', name: 'View Activity Log', module: 'audit', description: 'View system activity/audit trail', defaultRoles: ['MD'] },

    // Payments
    { code: 'payment.manage', name: 'Manage Payments', module: 'payment', description: 'Record and manage payments', defaultRoles: ['MD', 'ACCOUNT_MANAGER', 'OPERATIONAL_MANAGER', 'RECEPTIONIST'] },

    // Cancellation notifications
    { code: 'cancellation.notify', name: 'Receive Cancellation Notifications', module: 'cancellation', description: 'See pending cancellation requests', defaultRoles: ['MD', 'OPERATIONAL_MANAGER'] },

    // Permissions management
    { code: 'permission.manage', name: 'Manage Permissions', module: 'permission', description: 'Grant or revoke role permissions', defaultRoles: ['MD'] },
  ];

async function seed() {
  console.log('🌱 Seeding database...');

  // ─── 1. Create Users ──────────────────────────────────

  const pw = async (plain: string) => bcrypt.hash(plain, 10);

  const users = [
    { name: 'godivatech', email: 'md@godivarooms.com', password: await pw('123456'), role: 'MD' as UserRole },
    { name: 'Accounts', email: 'accounts@godivarooms.com', password: await pw('123456'), role: 'ACCOUNT_MANAGER' as UserRole },
    { name: 'Operations Manager', email: 'operations@godivarooms.com', password: await pw('123456'), role: 'OPERATIONAL_MANAGER' as UserRole },
    { name: 'Restaurant Manager', email: 'restaurant@godivarooms.com', password: await pw('123456'), role: 'RESTAURANT_MANAGER' as UserRole },
    { name: 'Receptionist 1', email: 'reception1@godivarooms.com', password: await pw('123456'), role: 'RECEPTIONIST' as UserRole },
    { name: 'Receptionist 2', email: 'reception2@godivarooms.com', password: await pw('123456'), role: 'RECEPTIONIST' as UserRole },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, name: u.name, password: u.password },
      create: u,
    });
  }

  // ─── 2. Room Types ────────────────────────────────────

  const standard = await prisma.roomType.upsert({ where: { name: 'Standard' }, update: {}, create: { name: 'Standard', basePrice: 1500, description: 'Standard room with basic amenities' } });
  const deluxe = await prisma.roomType.upsert({ where: { name: 'Deluxe' }, update: {}, create: { name: 'Deluxe', basePrice: 2500, description: 'Deluxe room with AC and TV' } });
  const premium = await prisma.roomType.upsert({ where: { name: 'Premium' }, update: {}, create: { name: 'Premium', basePrice: 3500, description: 'Premium room with balcony' } });
  const suite = await prisma.roomType.upsert({ where: { name: 'Suite' }, update: {}, create: { name: 'Suite', basePrice: 5000, description: 'Luxury suite with living area' } });

  // ─── 3. Create 49 Rooms ───────────────────────────────

  const types = [standard, deluxe, premium, suite];
  const roomsToCreate = [];
  for (let floor = 1; floor <= 4; floor++) {
    const count = floor <= 3 ? 14 : 7;
    for (let r = 1; r <= count; r++) {
      const num = `${floor}${String(r).padStart(2, '0')}`;
      const typeIndex = floor === 4 ? 3 : floor - 1;
      roomsToCreate.push({ roomNumber: num, floor, roomTypeId: types[typeIndex].id });
    }
  }

  for (const room of roomsToCreate) {
    await prisma.room.upsert({
      where: { roomNumber: room.roomNumber },
      update: {},
      create: room,
    });
  }

  // ─── 4. Menu Categories & Items ───────────────────────

  const starters = await prisma.menuCategory.upsert({ where: { name: 'Starters' }, update: {}, create: { name: 'Starters', sortOrder: 1 } });
  const mainCourse = await prisma.menuCategory.upsert({ where: { name: 'Main Course' }, update: {}, create: { name: 'Main Course', sortOrder: 2 } });
  const beverages = await prisma.menuCategory.upsert({ where: { name: 'Beverages' }, update: {}, create: { name: 'Beverages', sortOrder: 3 } });
  const desserts = await prisma.menuCategory.upsert({ where: { name: 'Desserts' }, update: {}, create: { name: 'Desserts', sortOrder: 4 } });

  const menuItems = [
    { name: 'Paneer Tikka', price: 280, categoryId: starters.id, isVeg: true },
    { name: 'Chicken 65', price: 320, categoryId: starters.id, isVeg: false },
    { name: 'Veg Spring Roll', price: 220, categoryId: starters.id, isVeg: true },
    { name: 'Fish Fry', price: 350, categoryId: starters.id, isVeg: false },
    { name: 'Butter Chicken', price: 380, categoryId: mainCourse.id, isVeg: false },
    { name: 'Paneer Butter Masala', price: 320, categoryId: mainCourse.id, isVeg: true },
    { name: 'Biryani (Chicken)', price: 350, categoryId: mainCourse.id, isVeg: false },
    { name: 'Biryani (Veg)', price: 280, categoryId: mainCourse.id, isVeg: true },
    { name: 'Dal Tadka', price: 220, categoryId: mainCourse.id, isVeg: true },
    { name: 'Naan', price: 60, categoryId: mainCourse.id, isVeg: true },
    { name: 'Fresh Lime Soda', price: 80, categoryId: beverages.id, isVeg: true },
    { name: 'Masala Chai', price: 50, categoryId: beverages.id, isVeg: true },
    { name: 'Cold Coffee', price: 150, categoryId: beverages.id, isVeg: true },
    { name: 'Mango Lassi', price: 120, categoryId: beverages.id, isVeg: true },
    { name: 'Gulab Jamun', price: 120, categoryId: desserts.id, isVeg: true },
    { name: 'Ice Cream', price: 150, categoryId: desserts.id, isVeg: true },
  ];

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name, categoryId: item.categoryId } });
    if (!existing) {
      await prisma.menuItem.create({ data: item });
    }
  }

  // ─── 5. Tax Config (5% total: 2.5% CGST + 2.5% SGST) ─

  await prisma.taxConfig.upsert({ where: { name: 'CGST' }, update: { rate: 2.5 }, create: { name: 'CGST', rate: 2.5 } });
  await prisma.taxConfig.upsert({ where: { name: 'SGST' }, update: { rate: 2.5 }, create: { name: 'SGST', rate: 2.5 } });

  // ─── 6. System Config ─────────────────────────────────

  const today = new Date().toISOString().split('T')[0];
  await prisma.systemConfig.upsert({
    where: { key: 'BUSINESS_DATE' },
    update: {},
    create: { key: 'BUSINESS_DATE', value: today },
  });

  // ─── 7. Corporate Accounts ────────────────────────────

  const companies = [
    { name: 'Tata Consultancy Services (TCS)', gstin: '33AAACT1234A1Z1', address: 'TCS House, Raveline Street, Fort, Mumbai', state: 'Tamil Nadu', creditLimit: 150000.00, outstandingBalance: 0.00, email: 'travel.desk@tcs.com', phone: '022-67789999' },
    { name: 'Google India Pvt Ltd', gstin: '36AAFCD5678B2Z2', address: 'Signature Towers, Sector 30, Gurugram, Haryana', state: 'Karnataka', creditLimit: 300000.00, outstandingBalance: 0.00, email: 'corp-lodging@google.com', phone: '080-67218000' },
    { name: 'Infosys Limited', gstin: '29AAACI4567C3Z3', address: 'Electronics City, Hosur Road, Bengaluru', state: 'Karnataka', creditLimit: 100000.00, outstandingBalance: 0.00, email: 'accommodation@infosys.com', phone: '080-28520261' },
  ];

  for (const comp of companies) {
    await prisma.company.upsert({ where: { name: comp.name }, update: {}, create: comp });
  }

  // ─── 7.5 Banquet Halls ────────────────────────────────

  const halls = [
    { name: 'Grand Ballroom', maxCapacity: 500, baseRental: 50000, description: 'Luxury ballroom for grand events' },
    { name: 'Royal Hall', maxCapacity: 200, baseRental: 25000, description: 'Elegant hall for medium-sized gatherings' },
    { name: 'Crystal Room', maxCapacity: 100, baseRental: 15000, description: 'Sophisticated space for corporate events or small gatherings' },
  ];

  for (const hall of halls) {
    await prisma.banquetHall.upsert({
      where: { name: hall.name },
      update: { maxCapacity: hall.maxCapacity, baseRental: hall.baseRental, description: hall.description },
      create: hall,
    });
  }

  // ─── 8. Permissions & Role-Permission Mappings ────────

  for (const perm of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module, description: perm.description },
      create: { code: perm.code, name: perm.name, module: perm.module, description: perm.description },
    });

    // Create role-permission mappings
    for (const role of perm.defaultRoles) {
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: permission.id } },
        update: {},
        create: { role, permissionId: permission.id },
      });
    }
  }

  // ─── Done ─────────────────────────────────────────────

  console.log('✅ Seed complete!');
  console.log('');
  console.log('📧 MD:                 md@godivarooms.com / 123456');
  console.log('📧 Account Manager:    accounts@godivarooms.com / 123456');
  console.log('📧 Operations Manager: operations@godivarooms.com / 123456');
  console.log('📧 Restaurant Manager: restaurant@godivarooms.com / 123456');
  console.log('📧 Receptionist 1:     reception1@godivarooms.com / 123456');
  console.log('📧 Receptionist 2:     reception2@godivarooms.com / 123456');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
