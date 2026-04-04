// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — GLOBAL ERROR HANDLER
// Catches all unhandled errors and returns clean responses.
// In production, never leak stack traces to the client.
// ═══════════════════════════════════════════════════════════

const config = require('../config');

/**
 * Global error-handling middleware.
 * Express identifies this as an error handler because it
 * has 4 parameters (err, req, res, next).
 */
function errorHandler(err, req, res, _next) {
  // Log the full error internally — always
  console.error(`\n❌ [${new Date().toISOString()}] ERROR:`, {
    message: err.message,
    stack: config.env === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Determine the status code
  const statusCode = err.statusCode || err.status || 500;

  // Build the response — hide details in production
  const response = {
    success: false,
    error: statusCode === 500 && config.env === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal Server Error',
  };

  // Include stack trace in development only
  if (config.env === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
