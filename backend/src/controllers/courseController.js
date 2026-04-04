// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — COURSE CONTROLLER
// Serves protected course content and tracks user progress.
// All routes require authentication + purchase verification.
// ═══════════════════════════════════════════════════════════

const prisma = require('../lib/prisma');

// ─── Course Content Map ──────────────────────────────────
// In production, this would come from a CMS or database.
// For now, it's structured data matching the 7-day program.
const COURSE_MODULES = [
  {
    id: 'day-1',
    title: 'The Awakening Audit',
    subtitle: 'Day 1',
    description: 'Identify and dismantle the unconscious patterns, beliefs, and identity constructs that are silently governing your decisions.',
    order: 1,
    lessons: [
      { id: 'lesson-1-1', title: 'The Identity Audit', duration: '45 min', type: 'video' },
      { id: 'lesson-1-2', title: 'Mapping Your Invisible Cage', duration: '30 min', type: 'exercise' }
    ],
  },
  {
    id: 'day-2',
    title: 'Behavioral Rewiring',
    subtitle: 'Day 2',
    description: 'With the old architecture cleared, deliberately design your new identity. Install new belief systems and decision frameworks.',
    order: 2,
    lessons: [
      { id: 'lesson-2-1', title: 'The Identity Blueprint', duration: '60 min', type: 'video' },
      { id: 'lesson-2-2', title: 'Decision Architecture Framework', duration: '45 min', type: 'exercise' }
    ],
  },
  {
    id: 'day-3',
    title: 'Environment Architecture',
    subtitle: 'Day 3',
    description: 'Replace raw willpower with an environment that makes discipline automatic.',
    order: 3,
    lessons: [
      { id: 'lesson-3-1', title: 'Installing New Behavioral Protocols', duration: '50 min', type: 'video' },
      { id: 'lesson-3-2', title: 'The Environment Design Lab', duration: '35 min', type: 'exercise' }
    ],
  },
  {
    id: 'day-4',
    title: 'State Transition Mastery',
    subtitle: 'Day 4',
    description: 'Protect your attention. Master the state transitions required to drop into deep, needle-moving work instantly.',
    order: 4,
    lessons: [
      { id: 'lesson-4-1', title: 'The Momentum Engine', duration: '55 min', type: 'video' },
      { id: 'lesson-4-2', title: 'Flow State Triggers', duration: '40 min', type: 'exercise' }
    ],
  },
  {
    id: 'day-5',
    title: 'Domain Domination',
    subtitle: 'Day 5',
    description: 'Apply your new operating system to health, wealth, relationships, and creative output.',
    order: 5,
    lessons: [
      { id: 'lesson-5-1', title: 'Health & Wealth Architecture', duration: '60 min', type: 'video' },
      { id: 'lesson-5-2', title: 'The Compound Effect Challenge', duration: '30 min', type: 'exercise' }
    ],
  },
  {
    id: 'day-6',
    title: 'Anti-Regression Firewall',
    subtitle: 'Day 6',
    description: 'Lock in the transformation. Build the firewall against regression.',
    order: 6,
    lessons: [
      { id: 'lesson-6-1', title: 'The Anti-Regression Firewall', duration: '50 min', type: 'video' },
      { id: 'lesson-6-2', title: 'Building Your Personal Doctrine', duration: '60 min', type: 'exercise' }
    ],
  },
  {
    id: 'day-7',
    title: 'The Continuous Evolution',
    subtitle: 'Day 7',
    description: 'Calculate your exact trajectory. Leave the program not with motivation, but with an unshakable system for continuous evolution.',
    order: 7,
    lessons: [
      { id: 'lesson-7-1', title: 'Your Operating Manual (Final Project)', duration: '90 min', type: 'exercise' },
      { id: 'lesson-7-2', title: 'The Threshold Ceremony', duration: '30 min', type: 'video' }
    ],
  },
];

/**
 * GET /api/course/modules
 *
 * Returns all course modules with the authenticated user's
 * progress merged in. Each lesson includes a "completed"
 * flag based on the user's CourseProgress records.
 */
async function getModules(req, res) {
  try {
    const userId = req.user.id;

    // ─── Fetch user's progress records ────────────────
    const progress = await prisma.courseProgress.findMany({
      where: { userId, completed: true },
      select: {
        moduleId: true,
        lessonId: true,
        completedAt: true,
      },
    });

    // Build a Set for O(1) lookup of completed lessons
    const completedSet = new Set(
      progress.map((p) => `${p.moduleId}:${p.lessonId}`)
    );

    // ─── Merge progress into the module structure ─────
    const modulesWithProgress = COURSE_MODULES.map((module) => {
      const lessons = module.lessons.map((lesson) => ({
        ...lesson,
        completed: completedSet.has(`${module.id}:${lesson.id}`),
      }));

      const completedCount = lessons.filter((l) => l.completed).length;

      return {
        ...module,
        lessons,
        progress: {
          completed: completedCount,
          total: lessons.length,
          percentage: Math.round((completedCount / lessons.length) * 100),
        },
      };
    });

    // ─── Overall course progress ──────────────────────
    const totalLessons = COURSE_MODULES.reduce((sum, m) => sum + m.lessons.length, 0);
    const totalCompleted = progress.length;

    return res.status(200).json({
      success: true,
      data: {
        modules: modulesWithProgress,
        overallProgress: {
          completed: totalCompleted,
          total: totalLessons,
          percentage: Math.round((totalCompleted / totalLessons) * 100),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not fetch course content.',
    });
  }
}

/**
 * POST /api/course/progress
 *
 * Marks a specific lesson as completed for the authenticated user.
 *
 * Request body:
 *   - moduleId: string (e.g. 'phase-1')
 *   - lessonId: string (e.g. 'lesson-1-1')
 */
async function updateProgress(req, res) {
  try {
    const userId = req.user.id;
    const { moduleId, lessonId } = req.body;

    // ─── Validate input ───────────────────────────────
    if (!moduleId || !lessonId) {
      return res.status(400).json({
        success: false,
        error: 'moduleId and lessonId are required.',
      });
    }

    // Verify the module and lesson exist in our course
    const moduleExists = COURSE_MODULES.find((m) => m.id === moduleId);
    if (!moduleExists) {
      return res.status(404).json({
        success: false,
        error: `Module "${moduleId}" not found.`,
      });
    }

    const lessonExists = moduleExists.lessons.find((l) => l.id === lessonId);
    if (!lessonExists) {
      return res.status(404).json({
        success: false,
        error: `Lesson "${lessonId}" not found in module "${moduleId}".`,
      });
    }

    // ─── Upsert progress record ───────────────────────
    // Uses the unique constraint on [userId, moduleId, lessonId]
    const record = await prisma.courseProgress.upsert({
      where: {
        userId_moduleId_lessonId: {
          userId,
          moduleId,
          lessonId,
        },
      },
      update: {
        completed: true,
        completedAt: new Date(),
      },
      create: {
        userId,
        moduleId,
        lessonId,
        completed: true,
        completedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Lesson "${lessonExists.title}" marked as completed.`,
      data: { progress: record },
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not update progress.',
    });
  }
}

module.exports = { getModules, updateProgress };
