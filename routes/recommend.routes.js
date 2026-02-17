const express = require("express");
const router = express.Router();
const db = require("../DB/mysql");

// ===============================
// HYBRID RECOMMENDATION ROUTE
// ===============================

router.get("/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {

    const [products] = await db.query(
      "SELECT id, name, category, tags FROM products LIMIT 200"
    );

    const [userOrders] = await db.query(
      `
      SELECT oi.product_id
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.user_id = ?
      `,
      [userId]
    );

    const purchasedIds = userOrders.map(p => p.product_id);

    if (purchasedIds.length === 0) {
      const [popular] = await db.query(`
        SELECT p.*, COUNT(oi.product_id) as sales
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.product_id
        GROUP BY p.id
        ORDER BY sales DESC
        LIMIT 10
      `);

      return res.json(popular);
    }

    const [allOrders] = await db.query(`
      SELECT o.user_id, oi.product_id
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
    `);

    const userProductMap = {};
    allOrders.forEach(row => {
      if (!userProductMap[row.user_id]) {
        userProductMap[row.user_id] = [];
      }
      userProductMap[row.user_id].push(row.product_id);
    });

    const scores = {};

    for (let otherUser in userProductMap) {
      const productsOfOther = userProductMap[otherUser];

      const intersection = productsOfOther.filter(p =>
        purchasedIds.includes(p)
      );

      if (intersection.length > 0) {
        productsOfOther.forEach(p => {
          if (!purchasedIds.includes(p)) {
            scores[p] = (scores[p] || 0) + intersection.length;
          }
        });
      }
    }

    const purchasedProducts = products.filter(p =>
      purchasedIds.includes(p.id)
    );

    const categorySet = new Set(purchasedProducts.map(p => p.category));
    const tagSet = new Set(
      purchasedProducts.flatMap(p =>
        p.tags ? p.tags.split(",") : []
      )
    );

    products.forEach(product => {
      if (purchasedIds.includes(product.id)) return;

      let contentScore = 0;

      if (categorySet.has(product.category)) {
        contentScore += 2;
      }

      if (product.tags) {
        product.tags.split(",").forEach(tag => {
          if (tagSet.has(tag)) contentScore += 1;
        });
      }

      scores[product.id] =
        (scores[product.id] || 0) * 0.5 + contentScore * 0.3;
    });

    const [popularData] = await db.query(`
      SELECT product_id, COUNT(*) as sales
      FROM order_items
      GROUP BY product_id
    `);

    const popularityMap = {};
    popularData.forEach(p => {
      popularityMap[p.product_id] = p.sales;
    });

    Object.keys(scores).forEach(id => {
     scores[id] =
  scores[id] + (popularityMap[id] || 0) * 0.2;

    });

    const recommendedIds = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(item => parseInt(item[0]));

    const recommendedProducts = products.filter(p =>
      recommendedIds.includes(p.id)
    );

    res.json(recommendedProducts);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Recommendation failed" });
  }
});

module.exports = router;
