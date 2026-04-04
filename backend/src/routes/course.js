// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — COURSE ROUTES
// GET  /api/course/modules
// POST /api/course/progress
// Both routes require authentication AND purchase verification.
// ═══════════════════════════════════════════════════════════

const express = require('express');
const { getModules, updateProgress } = require('../controllers/courseController');
const { requireAuth, requirePurchased } = require('../middleware/auth');

const router = express.Router();

// All course routes require authentication + active purchase
router.get('/modules', requireAuth, requirePurchased, getModules);
router.post('/progress', requireAuth, requirePurchased, updateProgress);

module.exports = router;
