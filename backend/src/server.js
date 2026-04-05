// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — EXPRESS SERVER
// Direct-purchase model. No user accounts needed for buyers.
// Admin dashboard for order management & analytics.
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
const adminRoutes = require('./routes/admin');

// Import webhook handler (needs raw body — mounted separately)
const { handleWebhook } = require('./controllers/paymentController');

const app = express();

// 👇 RAILWAY KE LIYE PROXY TRUST ENABLE KIYA (Rate limiter errors theek karne ke liye) 👇
app.set('trust proxy', true);

// ═══════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════

app.use(helmet());

// 👇 ULTIMATE CORS FIX (Sabhi devices aur phones ko allow karne ke liye) 👇
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile browsers strict mode)
    if (!origin) return callback(null, true);
    // Allow all origins for public checkout access
    return callback(null, true); 
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200 // Purane mobile browsers ke liye zaroori (204 pe crash hote hain)
}));

app.use(requestLogger);

// ═══════════════════════════════════════════════════════════
// ⚠️  WEBHOOK ROUTE — MUST COME BEFORE JSON BODY PARSER
// Razorpay requires the raw, unparsed body to verify the
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
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ═══════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════

// Global rate limit — 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again later.',
  },
});

// Payment rate limit — 10 checkout sessions per 15 minutes
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many payment attempts. Please try again in 15 minutes.',
  },
});

// Admin auth rate limit — 10 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.',
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
app.use('/api/admin', adminRoutes);

// ─── Health check ─────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
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
  ║     Direct Purchase Model                         ║
  ║                                                   ║
  ║     Environment:  ${config.env.padEnd(30)}║
  ║     Port:         ${String(config.port).padEnd(30)}║
  ║     Frontend:     ${config.frontendUrl.padEnd(30)}║
  ║                                                   ║
  ║     Routes:                                       ║
  ║       POST /api/payments/create-order             ║
  ║       POST /api/payments/verify                   ║
  ║       POST /api/payments/webhook                  ║
  ║       POST /api/auth/admin-login                  ║
  ║       GET  /api/auth/me                           ║
  ║       GET  /api/admin/stats                       ║
  ║       GET  /api/admin/orders                      ║
  ║       GET  /api/admin/orders/:id                  ║
  ║       PATCH /api/admin/orders/:id/status          ║
  ║       GET  /api/health                            ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
  `);
});

// ─── Graceful Shutdown ───────────────────────────────────
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

  setTimeout(() => {
    console.error('   ✗ Forced shutdown after 30s timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💀 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

module.exports = app;
