// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — PRISMA CLIENT SINGLETON
// Ensures a single PrismaClient instance is reused across
// the entire application. Prevents connection pool exhaustion
// in development (nodemon restarts) and production.
// ═══════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');

/**
 * Global singleton for PrismaClient.
 *
 * In development, nodemon restarts create new PrismaClient
 * instances on every reload, eventually exhausting the
 * database connection pool. Storing the client on `globalThis`
 * survives module cache clears.
 *
 * In production, the module cache alone is sufficient, but
 * the globalThis pattern is a harmless safeguard.
 */
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

module.exports = prisma;
