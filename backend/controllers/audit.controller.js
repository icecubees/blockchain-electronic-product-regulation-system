const db = require("../models");
const { Op } = db.Sequelize;

function normalizeStringQuery(value) {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function parsePositiveInteger(value, fallbackValue, max = 100) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallbackValue;
  }

  return Math.min(parsed, max);
}

function buildDateRange(dateFrom, dateTo) {
  const from = normalizeStringQuery(dateFrom);
  const to = normalizeStringQuery(dateTo);
  if (!from && !to) {
    return null;
  }

  const range = {};
  if (from) {
    const start = new Date(`${from}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime())) {
      range[Op.gte] = start;
    }
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999Z`);
    if (!Number.isNaN(end.getTime())) {
      range[Op.lte] = end;
    }
  }

  return Object.getOwnPropertySymbols(range).length > 0 ? range : null;
}

exports.getAuditLogs = async (req, res) => {
  try {
    const where = {};
    const keyword = normalizeStringQuery(req.query.keyword);
    const operatorKeyword = normalizeStringQuery(req.query.operatorKeyword);
    const targetId = normalizeStringQuery(req.query.targetId);
    const createdAtRange = buildDateRange(req.query.dateFrom, req.query.dateTo);
    const page = parsePositiveInteger(req.query.page, 1, 100000);
    const pageSize = parsePositiveInteger(req.query.pageSize || req.query.limit, 20, 100);
    const usePaginatedResponse = [
      "page",
      "pageSize",
      "keyword",
      "targetId",
      "operatorKeyword",
      "dateFrom",
      "dateTo",
      "targetType",
      "action",
      "result",
      "operatorId",
    ].some((key) => req.query[key] !== undefined);

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
    if (targetId) {
      where.targetId = targetId;
    }
    if (createdAtRange) {
      where.createdAt = createdAtRange;
    }

    const andConditions = [];
    if (operatorKeyword) {
      andConditions.push({
        [Op.or]: [
          { operatorUsername: { [Op.like]: `%${operatorKeyword}%` } },
          { operatorRole: { [Op.like]: `%${operatorKeyword}%` } },
        ],
      });
    }
    if (keyword) {
      andConditions.push({
        [Op.or]: [
          { action: { [Op.like]: `%${keyword}%` } },
          { targetType: { [Op.like]: `%${keyword}%` } },
          { targetId: { [Op.like]: `%${keyword}%` } },
          { operatorUsername: { [Op.like]: `%${keyword}%` } },
          { operatorRole: { [Op.like]: `%${keyword}%` } },
          { details: { [Op.like]: `%${keyword}%` } },
          { txHash: { [Op.like]: `%${keyword}%` } },
          { ipfsHash: { [Op.like]: `%${keyword}%` } },
        ],
      });
    }
    if (andConditions.length > 0) {
      where[Op.and] = andConditions;
    }

    const query = {
      where,
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
    const logs = await db.auditLog.findAll(query);

    if (!usePaginatedResponse) {
      return res.send(logs);
    }

    const total = await db.auditLog.count({ where });

    return res.send({
      items: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
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
