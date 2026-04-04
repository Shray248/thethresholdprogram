// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — AUTH ROUTES
// POST /api/auth/register
// POST /api/auth/login
// GET  /api/auth/me
// ═══════════════════════════════════════════════════════════

const express = require('express');
const { register, login, getProfile } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public routes — no authentication required
router.post('/register', register);
router.post('/login', login);

// Protected route — JWT required
router.get('/me', requireAuth, getProfile);

module.exports = router;
