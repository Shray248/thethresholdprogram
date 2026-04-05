// ═══════════════════════════════════════════════════════════
// THE THRESHOLD PROGRAM — ADMIN CONTROLLER
// Admin-only operations: order management, revenue analytics.
// Simplified for direct-purchase model (no user accounts).
// ═══════════════════════════════════════════════════════════

const prisma = require('../lib/prisma');

/**
 * GET /api/admin/orders
 *
 * Returns a paginated list of all orders.
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 20, max 100)
 *   - status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
 *   - search: string (search by buyer email or phone)
 */
async function listOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status?.toUpperCase();
    const search = req.query.search?.trim();

    const where = {};

    if (statusFilter && ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'].includes(statusFilter)) {
      where.status = statusFilter;
    }

    if (search) {
      where.OR = [
        { buyerEmail: { contains: search } },
        { buyerPhone: { contains: search } },
        { buyerName: { contains: search } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        orders: orders.map(o => ({
          id: o.id,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          buyerPhone: o.buyerPhone,
          buyerInstagram: o.buyerInstagram,
          currentSituation: o.currentSituation,
          investmentCapacity: o.investmentCapacity,
          amount: o.amount,
          amountFormatted: `₹${(o.amount / 100).toLocaleString('en-IN')}`,
          currency: o.currency,
          status: o.status,
          razorpayOrderId: o.razorpayOrderId,
          razorpayPaymentId: o.razorpayPaymentId,
          failureReason: o.failureReason,
          createdAt: o.createdAt,
        })),
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
 * GET /api/admin/orders/:id
 *
 * Returns full detail of a specific order.
 */
async function getOrderDetail(req, res) {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...order,
        amountFormatted: `₹${(order.amount / 100).toLocaleString('en-IN')}`,
      },
    });
  } catch (error) {
    console.error('Admin - Get order detail error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not fetch order details.',
    });
  }
}

/**
 * PATCH /api/admin/orders/:id/status
 *
 * Update order status manually (e.g. mark as refunded).
 */
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found.',
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: status.toUpperCase() },
    });

    console.log(`🔧 Admin updated order ${id} status to ${status.toUpperCase()}`);

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status.toUpperCase()}.`,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Admin - Update order status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Could not update order status.',
    });
  }
}

/**
 * GET /api/admin/stats
 *
 * Returns revenue statistics and key business metrics.
 */
async function getStats(req, res) {
  try {
    const [
      ordersByStatus,
      totalRevenue,
      recentOrders,
      totalOrders,
    ] = await Promise.all([
      // Orders grouped by status
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // Total revenue (completed only)
      prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // Last 10 orders
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),

      // Total order count
      prisma.order.count(),
    ]);

    // Format order status distribution
    const orderStatusMap = ordersByStatus.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    const completedRevenue = totalRevenue._sum.amount || 0;
    const completedCount = totalRevenue._count.id || 0;

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalOrders,
          completedOrders: completedCount,
          totalRevenue: completedRevenue,
          totalRevenueFormatted: `₹${(completedRevenue / 100).toLocaleString('en-IN')}`,
        },
        orders: {
          byStatus: orderStatusMap,
          total: totalOrders,
        },
        recentOrders: recentOrders.map(o => ({
          id: o.id,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          buyerPhone: o.buyerPhone,
          buyerInstagram: o.buyerInstagram,
          amount: o.amount,
          amountFormatted: `₹${(o.amount / 100).toLocaleString('en-IN')}`,
          status: o.status,
          createdAt: o.createdAt,
        })),
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

module.exports = { listOrders, getOrderDetail, updateOrderStatus, getStats };
