import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@godivarooms.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@godivarooms.com', password: adminPassword, role: 'ADMIN' },
  });

  // Create reception user
  const receptionPassword = await bcrypt.hash('reception123', 10);
  await prisma.user.upsert({
    where: { email: 'reception@godivarooms.com' },
    update: {},
    create: { name: 'Front Desk', email: 'reception@godivarooms.com', password: receptionPassword, role: 'RECEPTION' },
  });

  // Create restaurant user
  const restaurantPassword = await bcrypt.hash('restaurant123', 10);
  await prisma.user.upsert({
    where: { email: 'restaurant@godivarooms.com' },
    update: {},
    create: { name: 'Restaurant Staff', email: 'restaurant@godivarooms.com', password: restaurantPassword, role: 'RESTAURANT' },
  });

  // Room types
  const deluxe = await prisma.roomType.upsert({ where: { name: 'Deluxe' }, update: {}, create: { name: 'Deluxe', basePrice: 2500, description: 'Deluxe room with AC and TV' } });
  const premium = await prisma.roomType.upsert({ where: { name: 'Premium' }, update: {}, create: { name: 'Premium', basePrice: 3500, description: 'Premium room with balcony' } });
  const suite = await prisma.roomType.upsert({ where: { name: 'Suite' }, update: {}, create: { name: 'Suite', basePrice: 5000, description: 'Luxury suite with living area' } });
  const standard = await prisma.roomType.upsert({ where: { name: 'Standard' }, update: {}, create: { name: 'Standard', basePrice: 1500, description: 'Standard room with basic amenities' } });

  // Create 49 rooms
  const types = [standard, deluxe, premium, suite];
  const roomsToCreate = [];
  for (let floor = 1; floor <= 4; floor++) {
    const count = floor <= 3 ? 14 : 7;
    for (let r = 1; r <= count; r++) {
      const num = `${floor}${String(r).padStart(2, '0')}`;
      const typeIndex = floor === 4 ? 3 : floor - 1; // Floor 4 = suites
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

  // Menu categories and items
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

  // Tax config
  await prisma.taxConfig.upsert({ where: { name: 'CGST' }, update: {}, create: { name: 'CGST', rate: 6 } });
  await prisma.taxConfig.upsert({ where: { name: 'SGST' }, update: {}, create: { name: 'SGST', rate: 6 } });

  // System config — Business Date for Night Audit
  const today = new Date().toISOString().split('T')[0]; // e.g. "2026-05-29"
  await prisma.systemConfig.upsert({
    where: { key: 'BUSINESS_DATE' },
    update: {},
    create: { key: 'BUSINESS_DATE', value: today },
  });

  // Create sample corporate accounts
  const companies = [
    {
      name: 'Tata Consultancy Services (TCS)',
      gstin: '33AAACT1234A1Z1',
      address: 'TCS House, Raveline Street, Fort, Mumbai',
      state: 'Tamil Nadu', // Local state
      creditLimit: 150000.00,
      outstandingBalance: 0.00,
      email: 'travel.desk@tcs.com',
      phone: '022-67789999',
    },
    {
      name: 'Google India Pvt Ltd',
      gstin: '36AAFCD5678B2Z2',
      address: 'Signature Towers, Sector 30, Gurugram, Haryana',
      state: 'Karnataka', // Out of state
      creditLimit: 300000.00,
      outstandingBalance: 0.00,
      email: 'corp-lodging@google.com',
      phone: '080-67218000',
    },
    {
      name: 'Infosys Limited',
      gstin: '29AAACI4567C3Z3',
      address: 'Electronics City, Hosur Road, Bengaluru',
      state: 'Karnataka',
      creditLimit: 100000.00,
      outstandingBalance: 0.00,
      email: 'accommodation@infosys.com',
      phone: '080-28520261',
    }
  ];

  for (const comp of companies) {
    await prisma.company.upsert({
      where: { name: comp.name },
      update: {},
      create: {
        name: comp.name,
        gstin: comp.gstin,
        address: comp.address,
        state: comp.state,
        creditLimit: comp.creditLimit,
        outstandingBalance: comp.outstandingBalance,
        email: comp.email,
        phone: comp.phone,
      }
    });
  }

  console.log('✅ Seed complete!');
  console.log('📧 Admin: admin@godivarooms.com / admin123');
  console.log('📧 Reception: reception@godivarooms.com / reception123');
  console.log('📧 Restaurant: restaurant@godivarooms.com / restaurant123');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
