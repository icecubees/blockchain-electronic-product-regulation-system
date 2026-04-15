const db = require("../models");
const { Op } = db.Sequelize;

exports.getAuditLogs = async (req, res) => {
  try {
    const where = {};

    if (req.query.action) {
      where.action = req.query.action;
    }
    if (req.query.operatorId) {
      where.operatorId = req.query.operatorId;
    }
    if (req.query.result) {
      where.result = req.query.result;
    }
    if (req.query.targetType) {
      where.targetType = req.query.targetType;
    }

    const logs = await db.auditLog.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: Math.min(parseInt(req.query.limit || "100", 10), 200),
    });

    res.send(logs);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

function buildDateBuckets(days) {
  const buckets = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - index);

    const key = current.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: `${current.getMonth() + 1}/${current.getDate()}`,
      purchases: 0,
      audits: 0,
      disputes: 0,
      shipments: 0,
      riskFlags: 0,
      recalls: 0,
      reviewBlocks: 0,
    });
  }

  return buckets;
}

exports.getAuditStats = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || "7", 10), 3), 30);
    const buckets = buildDateBuckets(days);
    const startDate = new Date(`${buckets[0].key}T00:00:00.000Z`);

    const [
      recentLogs,
      activeProducts,
      pendingProducts,
      openComplaints,
      blacklistedSellers,
      shippingOrders,
      recalledProducts,
      usedOrRefurbishedActiveProducts,
      productsMissingCcc,
      batteryComplaintCount,
      recalledSellerRows,
      productsWithHighRiskTags,
      complaintTypeRows,
    ] = await Promise.all([
        db.auditLog.findAll({
          where: {
            createdAt: {
              [Op.gte]: startDate,
            },
          },
          attributes: ["action", "createdAt"],
          order: [["createdAt", "ASC"]],
        }),
        db.product.count({
          where: {
            auditStatus: 1,
            stock: {
              [Op.gt]: 0,
            },
          },
        }),
        db.product.count({
          where: {
            auditStatus: 0,
          },
        }),
        db.order.count({
          where: {
            status: 3,
          },
        }),
        db.user.count({
          where: {
            role: "seller",
            isBlacklisted: true,
          },
        }),
        db.order.count({
          where: {
            status: 0,
            shippingStatus: "shipped",
          },
        }),
        db.product.count({
          where: {
            recallStatus: true,
          },
        }),
        db.product.count({
          where: {
            auditStatus: 1,
            stock: {
              [Op.gt]: 0,
            },
            [Op.or]: [{ isUsed: true }, { isRefurbished: true }],
          },
        }),
        db.product.count({
          where: {
            auditStatus: 1,
            stock: {
              [Op.gt]: 0,
            },
            [Op.or]: [{ cccNumber: null }, { cccNumber: "" }],
          },
        }),
        db.order.count({
          where: {
            complaintReason: {
              [Op.like]: "%battery%",
            },
          },
        }),
        db.product.findAll({
          where: {
            recallStatus: true,
          },
          attributes: ["sellerId"],
          group: ["sellerId"],
        }),
        db.product.count({
          where: {
            [Op.or]: [
              { recallStatus: true },
              { batterySafetyPassed: false },
              { chargerSafetyPassed: false },
              {
                [Op.and]: [{ isRefurbished: true }, { repairHistoryDeclared: false }],
              },
            ],
          },
        }),
        db.order.findAll({
          where: {
            complaintType: {
              [Op.ne]: null,
            },
          },
          attributes: [
            "complaintType",
            [db.Sequelize.fn("COUNT", db.Sequelize.col("complaintType")), "count"],
          ],
          group: ["complaintType"],
        }),
      ]);

    const recalledSellerIds = recalledSellerRows
      .map((row) => row.sellerId)
      .filter((sellerId) => sellerId !== null && sellerId !== undefined);

    const riskySellersCount = await db.user.count({
      where: {
        role: "seller",
        [Op.or]: [
          { isBlacklisted: true },
          ...(recalledSellerIds.length > 0 ? [{ id: { [Op.in]: recalledSellerIds } }] : []),
        ],
      },
    });

    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const actionBreakdownMap = new Map();

    recentLogs.forEach((log) => {
      const bucketKey = new Date(log.createdAt).toISOString().slice(0, 10);
      const bucket = bucketMap.get(bucketKey);
      if (!bucket) return;

      switch (log.action) {
        case "PRODUCT_PURCHASED":
          bucket.purchases += 1;
          break;
        case "PRODUCT_AUDITED":
          bucket.audits += 1;
          break;
        case "COMPLAINT_RAISED":
          bucket.disputes += 1;
          break;
        case "ORDER_SHIPPED":
          bucket.shipments += 1;
          break;
        case "SELLER_BLACKLISTED":
          bucket.riskFlags += 1;
          break;
        case "PRODUCT_RECALL_FLAGGED":
          bucket.recalls += 1;
          break;
        case "PRODUCT_REVIEW_BLOCKED":
          bucket.reviewBlocks += 1;
          break;
        default:
          break;
      }

      actionBreakdownMap.set(log.action, (actionBreakdownMap.get(log.action) || 0) + 1);
    });

    const actionBreakdown = Array.from(actionBreakdownMap.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([action, count]) => ({ action, count }));

    const complaintTypeBreakdown = complaintTypeRows
      .map((row) => ({
        complaintType: row.complaintType,
        count: Number(row.get ? row.get("count") : row.count || 0),
      }))
      .sort((left, right) => right.count - left.count);

    return res.send({
      summary: {
        activeProducts,
        pendingProducts,
        openComplaints,
        blacklistedSellers,
        shippingOrders,
        recalledProducts,
        usedOrRefurbishedActiveProducts,
        productsMissingCcc,
        batteryComplaintCount,
        riskySellersCount,
        productsWithHighRiskTags,
      },
      trends: buckets,
      actionBreakdown,
      complaintTypeBreakdown,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};
