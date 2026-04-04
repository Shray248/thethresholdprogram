// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — EXPRESS SERVER
// Production-ready entry point with security hardening,
// graceful shutdown, and structured logging.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const prisma = require('./lib/prisma');

// Import route modules
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');
const courseRoutes = require('./routes/course');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

// Import webhook handler (needs raw body — mounted separately)
const { handleWebhook } = require('./controllers/paymentController');

const app = express();

// ═══════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════

// Helmet — sets various HTTP security headers
// (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
app.use(helmet());

// CORS — restrict API access to the frontend origin
app.use(cors({
  origin: config.frontendUrl,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // Cache preflight for 24 hours
}));

// Request ID and structured logging
app.use(requestLogger);

// ═══════════════════════════════════════════════════════════
// ⚠️  WEBHOOK ROUTE — MUST COME BEFORE JSON BODY PARSER
// Stripe requires the raw, unparsed body to verify the
// webhook signature. If Express parses it as JSON first,
// the signature check will fail every time.
// ═══════════════════════════════════════════════════════════
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  handleWebhook,
);

// ═══════════════════════════════════════════════════════════
// BODY PARSING (after webhook route)
// ═══════════════════════════════════════════════════════════
app.use(express.json({ limit: '10kb' }));       // Parse JSON bodies, limit size
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// ═══════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════

// Global rate limit — 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again later.',
  },
});

// Strict rate limit for auth routes — 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

// Payment rate limit — 5 checkout sessions per 15 minutes
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many payment attempts. Please try again in 15 minutes.',
  },
});

app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/payments/', paymentLimiter);

// ═══════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/course', courseRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

// ─── Health check ─────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    // Verify database connection is alive
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.env,
      database: 'connected',
      uptime: `${Math.floor(process.uptime())}s`,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: config.env === 'development' ? error.message : 'Service unavailable',
    });
  }
});

// ─── 404 handler for unknown routes ───────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// ═══════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER (must be last)
// ═══════════════════════════════════════════════════════════
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════
// START SERVER + GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════
const server = app.listen(config.port, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║                                                   ║
  ║     THE THRESHOLD PROGRAM — API SERVER            ║
  ║                                                   ║
  ║     Environment:  ${config.env.padEnd(30)}║
  ║     Port:         ${String(config.port).padEnd(30)}║
  ║     Frontend:     ${config.frontendUrl.padEnd(30)}║
  ║                                                   ║
  ║     Routes:                                       ║
  ║       POST /api/auth/register                     ║
  ║       POST /api/auth/login                        ║
  ║       GET  /api/auth/me                           ║
  ║       POST /api/payments/create-checkout-session   ║
  ║       POST /api/payments/webhook                  ║
  ║       GET  /api/course/modules                    ║
  ║       POST /api/course/progress                   ║
  ║       PUT  /api/user/profile                      ║
  ║       PUT  /api/user/password                     ║
  ║       GET  /api/user/orders                       ║
  ║       GET  /api/user/verify-payment/:id           ║
  ║       DEL  /api/user/account                      ║
  ║       GET  /api/admin/stats                       ║
  ║       GET  /api/admin/users                       ║
  ║       GET  /api/admin/orders                      ║
  ║       GET  /api/health                            ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ───────────────────────────────────
// When the process receives SIGTERM (e.g. from Docker,
// Kubernetes, or systemd), we:
// 1. Stop accepting new connections
// 2. Wait for in-flight requests to complete
// 3. Disconnect from the database
// 4. Exit cleanly
function gracefulShutdown(signal) {
  console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('   ✓ HTTP server closed (no new connections)');

    try {
      await prisma.$disconnect();
      console.log('   ✓ Database connection closed');
    } catch (err) {
      console.error('   ✗ Error disconnecting from database:', err);
    }

    console.log('   ✓ Shutdown complete. Goodbye.\n');
    process.exit(0);
  });

  // Force kill after 30 seconds if shutdown hangs
  setTimeout(() => {
    console.error('   ✗ Forced shutdown after 30s timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Unhandled rejection / exception safety nets ─────────
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Promise Rejection:', reason);
  // Don't crash — log and continue
});

process.on('uncaughtException', (error) => {
  console.error('💀 Uncaught Exception:', error);
  // This is serious — shut down gracefully
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

module.exports = app;
