// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — REQUEST LOGGER MIDDLEWARE
// Structured HTTP request logging for debugging and
// production monitoring. Logs method, path, status code,
// response time, and user info (if authenticated).
// ═══════════════════════════════════════════════════════════

const config = require('../config');

/**
 * Generates a short unique request ID for tracing.
 * Uses a simple counter + timestamp approach — sufficient
 * for single-instance deployments. For distributed systems,
 * use a library like uuid or cuid.
 */
let requestCounter = 0;
function generateRequestId() {
  requestCounter = (requestCounter + 1) % 999999;
  return `req_${Date.now().toString(36)}_${requestCounter.toString(36).padStart(4, '0')}`;
}

/**
 * requestLogger — Logs every incoming HTTP request.
 *
 * Attaches a unique requestId to each request for tracing.
 * Measures response time using process.hrtime for nanosecond
 * precision. Redacts sensitive headers like Authorization.
 */
function requestLogger(req, res, next) {
  // Skip logging for health checks in production (they're noisy)
  if (config.env === 'production' && req.path === '/api/health') {
    return next();
  }

  const requestId = generateRequestId();
  req.requestId = requestId;

  const startTime = process.hrtime.bigint();

  // ─── Log on response finish ──────────────────────────
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6; // Convert ns to ms

    const logEntry = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${durationMs.toFixed(2)}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent']?.substring(0, 100),
    };

    // Attach user info if available (set by auth middleware)
    if (req.user) {
      logEntry.userId = req.user.id;
      logEntry.userEmail = req.user.email;
    }

    // Color-code by status in development
    const statusCode = res.statusCode;
    if (config.env === 'development') {
      const color =
        statusCode >= 500 ? '\x1b[31m' :  // Red
        statusCode >= 400 ? '\x1b[33m' :  // Yellow
        statusCode >= 300 ? '\x1b[36m' :  // Cyan
        '\x1b[32m';                        // Green
      const reset = '\x1b[0m';

      console.log(
        `${color}${logEntry.method.padEnd(7)}${reset} ${logEntry.path} → ${color}${statusCode}${reset} (${logEntry.duration})${logEntry.userId ? ` [user:${logEntry.userId.substring(0, 8)}…]` : ''}`
      );
    } else {
      // Structured JSON logging for production (parseable by log aggregators)
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}

module.exports = requestLogger;
