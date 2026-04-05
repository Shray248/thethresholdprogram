// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — AUTH ROUTES
// POST /api/auth/admin-login  → Admin login
// GET  /api/auth/me           → Admin profile (protected)
// ═══════════════════════════════════════════════════════════

const express = require('express');
const { adminLogin, getProfile } = require('../controllers/authController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Public route — admin login
router.post('/admin-login', adminLogin);

// Protected route — admin JWT required
router.get('/me', requireAdmin, getProfile);

module.exports = router;
