// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — DATABASE SEED
// Creates the initial admin account.
// Run with: npm run db:seed
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─── Create Admin Account ─────────────────────────────
  const adminEmail = 'admin@thethresholdprogram.in';
  const adminPassword = 'ThresholdAdmin2026!';

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const admin = await prisma.adminUser.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Shray',
      },
    });

    console.log(`   ✅ Admin created: ${admin.email}`);
    console.log(`   🔑 Password: ${adminPassword}`);
    console.log(`   ⚠️  Change this password in production!`);
  } else {
    console.log(`   ℹ️  Admin already exists: ${adminEmail}`);
  }

  console.log('✅ Seed complete.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
