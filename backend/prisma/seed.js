// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — DATABASE SEED SCRIPT
// Populates the database with an admin user for initial setup.
// Run: npm run db:seed
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Use a dedicated PrismaClient for seeding (not the app singleton)
// since this runs as a standalone script, not within the server
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── Create Admin User ─────────────────────────────────
  const adminPassword = await bcrypt.hash('admin-change-me-immediately', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@thethresholdprogram.com' },
    update: {},
    create: {
      email: 'admin@thethresholdprogram.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'Threshold',
      role: 'ADMIN',
      hasPurchased: true,
      accessLevel: 'FULL_PROGRAM',
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // ─── Create a test user (development only) ─────────────
  if (process.env.NODE_ENV !== 'production') {
    const testPassword = await bcrypt.hash('test12345678', 12);

    const testUser = await prisma.user.upsert({
      where: { email: 'test@thethresholdprogram.com' },
      update: {},
      create: {
        email: 'test@thethresholdprogram.com',
        passwordHash: testPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        hasPurchased: false,
        accessLevel: 'FREE',
      },
    });

    console.log(`✅ Test user created: ${testUser.email} (password: test12345678)`);
  }

  console.log('\n🌱 Seeding complete!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
