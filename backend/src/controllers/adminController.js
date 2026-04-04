// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — ADMIN CONTROLLER
// Admin-only operations: user management, order oversight,
// revenue analytics, and system diagnostics.
// All routes require requireAuth + requireAdmin middleware.
// ═══════════════════════════════════════════════════════════

const prisma = require('../lib/prisma');

/**
 * GET /api/admin/users
 *
 * Returns a paginated list of all users with their
 * purchase status and order count.
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 20, max 100)
 *   - search: string (email search)
 *   - role: 'USER' | 'ADMIN' (filter by role)
 */
async function listUsers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();
    const roleFilter = req.query.role?.toUpperCase();

    // ─── Build dynamic where clause ─────────────────────
    const where = {};

    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    if (roleFilter && ['USER', 'ADMIN'].includes(roleFilter)) {
      where.role = roleFilter;
    }

    // ─── Fetch users with order count ───────────────────
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          accessLevel: true,
          hasPurchased: true,
          createdAt: true,
          _count: {
            select: { orders: true, progress: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Admin - List users error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not fetch users.',
    });
  }
}

/**
 * GET /api/admin/users/:id
 *
 * Returns detailed info about a specific user, including
 * their full order history and course progress.
 */
async function getUserDetail(req, res) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        accessLevel: true,
        hasPurchased: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            stripeSessionId: true,
            stripePaymentIntentId: true,
            amount: true,
            currency: true,
            status: true,
            productType: true,
            createdAt: true,
          },
        },
        progress: {
          where: { completed: true },
          select: {
            moduleId: true,
            lessonId: true,
            completedAt: true,
          },
          orderBy: { completedAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Admin - Get user detail error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not fetch user details.',
    });
  }
}

/**
 * PATCH /api/admin/users/:id/access
 *
 * Manually grant or revoke a user's access.
 * Useful for comps, refund overrides, or manual enrollment.
 *
 * Request body:
 *   - accessLevel: 'FREE' | 'FULL_PROGRAM' | 'SESSION_ONLY'
 *   - hasPurchased: boolean
 */
async function updateUserAccess(req, res) {
  try {
    const { id } = req.params;
    const { accessLevel, hasPurchased } = req.body;

    // ─── Validate input ─────────────────────────────────
    const validLevels = ['FREE', 'FULL_PROGRAM', 'SESSION_ONLY'];
    if (accessLevel && !validLevels.includes(accessLevel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid accessLevel. Must be one of: ${validLevels.join(', ')}`,
      });
    }

    // ─── Check user exists ──────────────────────────────
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    // ─── Build update data ──────────────────────────────
    const updateData = {};
    if (accessLevel !== undefined) updateData.accessLevel = accessLevel;
    if (hasPurchased !== undefined) updateData.hasPurchased = Boolean(hasPurchased);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        accessLevel: true,
        hasPurchased: true,
      },
    });

    console.log(`🔧 Admin updated access for ${user.email}: ${JSON.stringify(updateData)}`);

    return res.status(200).json({
      success: true,
      message: `Access updated for ${user.email}.`,
      data: { user },
    });
  } catch (error) {
    console.error('Admin - Update access error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not update user access.',
    });
  }
}

/**
 * GET /api/admin/orders
 *
 * Returns a paginated list of all orders across all users.
 *
 * Query params:
 *   - page, limit: pagination
 *   - status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
 */
async function listOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status?.toUpperCase();

    const where = {};
    if (statusFilter && ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'].includes(statusFilter)) {
      where.status = statusFilter;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Admin - List orders error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not fetch orders.',
    });
  }
}

/**
 * GET /api/admin/stats
 *
 * Returns revenue statistics and key business metrics.
 * Aggregates data across all completed orders.
 */
async function getStats(req, res) {
  try {
    // ─── Run all queries in parallel ─────────────────────
    const [
      totalUsers,
      purchasedUsers,
      ordersByStatus,
      revenueByProduct,
      revenueByCurrency,
      recentOrders,
      userGrowth,
    ] = await Promise.all([
      // Total registered users
      prisma.user.count(),

      // Users who purchased
      prisma.user.count({ where: { hasPurchased: true } }),

      // Orders grouped by status
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // Revenue grouped by product type (completed only)
      prisma.order.groupBy({
        by: ['productType'],
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Revenue grouped by currency (completed only)
      prisma.order.groupBy({
        by: ['currency'],
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Last 10 orders
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true } },
        },
      }),

      // Users created in the last 30 days (daily counts)
      prisma.$queryRaw`
        SELECT DATE(\"createdAt\") as date, COUNT(*)::int as count
        FROM users
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    // ─── Compute total revenue (all currencies to cents) ─
    const totalRevenue = revenueByCurrency.reduce((acc, item) => {
      acc[item.currency] = {
        amount: item._sum.amount || 0,
        orders: item._count.id,
      };
      return acc;
    }, {});

    // ─── Format order status distribution ─────────────────
    const orderStatusMap = ordersByStatus.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          purchasedUsers,
          conversionRate: totalUsers > 0
            ? `${((purchasedUsers / totalUsers) * 100).toFixed(1)}%`
            : '0%',
        },
        orders: {
          byStatus: orderStatusMap,
          total: Object.values(orderStatusMap).reduce((a, b) => a + b, 0),
        },
        revenue: {
          byCurrency: totalRevenue,
          byProduct: revenueByProduct.map((item) => ({
            product: item.productType,
            totalAmount: item._sum.amount || 0,
            orderCount: item._count.id,
          })),
        },
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          email: o.user.email,
          amount: o.amount,
          currency: o.currency,
          status: o.status,
          productType: o.productType,
          createdAt: o.createdAt,
        })),
        userGrowth,
      },
    });
  } catch (error) {
    console.error('Admin - Stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not generate statistics.',
    });
  }
}

module.exports = { listUsers, getUserDetail, updateUserAccess, listOrders, getStats };
