const express = require("express");

module.exports = (db) => {

  const router = express.Router();

  router.get("/:userId", (req, res) => {
    const userId = req.params.userId;

    // 1️⃣ Get products
    db.query(
      "SELECT id, title, rating_rate, rating_count, image, price, category FROM products LIMIT 200",
      (err, products) => {

        if (err) {
          console.error(err);
          return res.status(500).json({ error: "Database error" });
        }

        // 2️⃣ Get user purchases
        db.query(
          `
          SELECT oi.product_id
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.user_id = ?
          `,
          [userId],
          (err2, userOrders) => {

            if (err2) {
              console.error(err2);
              return res.status(500).json({ error: "Database error" });
            }

            const purchasedIds = userOrders.map(p => p.product_id);

            // 🔥 Cold start → popular
            if (purchasedIds.length === 0) {
              db.query(`
                SELECT p.id, p.title, p.rating_count,p.rating_rate, p.image, p.price, p.category,
                       COUNT(oi.product_id) AS sales
                FROM products p
                LEFT JOIN order_items oi ON p.id = oi.product_id
                GROUP BY p.id, p.title, p.image, p.rating_count, p.rating_rate, p.price, p.category
                ORDER BY sales DESC
                LIMIT 8
              `, (err3, popular) => {

                if (err3) {
                  console.error(err3);
                  return res.status(500).json({ error: "Database error" });
                }

                return res.json(popular);
              });

              return;
            }
  // 3️⃣ Get all orders for collaborative filtering
            db.query(`
              SELECT o.user_id, oi.product_id
              FROM orders o
              JOIN order_items oi ON o.id = oi.order_id
            `, (err4, allOrders) => {

              if (err4) {
                console.error(err4);
                return res.status(500).json({ error: "Database error" });
              }

              const userProductMap = {};
              allOrders.forEach(row => {
                if (!userProductMap[row.user_id]) {
                  userProductMap[row.user_id] = [];
                }
                userProductMap[row.user_id].push(row.product_id);
              });

              const scores = {};

              // Collaborative filtering
              for (let otherUser in userProductMap) {
                const otherProducts = userProductMap[otherUser];

                const intersection = otherProducts.filter(p =>
                  purchasedIds.includes(p)
                );

                if (intersection.length > 0) {
                  otherProducts.forEach(p => {
                    if (!purchasedIds.includes(p)) {
                      scores[p] = (scores[p] || 0) + intersection.length;
                    }
                  });
                }
              }

              // Content-based (category)
              const purchasedProducts = products.filter(p =>
                purchasedIds.includes(p.id)
              );

              const categorySet = new Set(
                purchasedProducts.map(p => p.category)
              );

              products.forEach(product => {
                if (purchasedIds.includes(product.id)) return;

                let contentScore = 0;

                if (categorySet.has(product.category)) {
                  contentScore += 2;
                }

                scores[product.id] =
                  (scores[product.id] || 0) * 0.5 + contentScore * 0.3;
              });

              // Popularity boost
              db.query(`
                SELECT product_id, COUNT(*) AS sales
                FROM order_items
                GROUP BY product_id
              `, (err5, popularData) => {

                if (err5) {
                  console.error(err5);
                  return res.status(500).json({ error: "Database error" });
                }

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
                  .slice(0, 8)
                  .map(item => parseInt(item[0]));

                const recommendedProducts = products.filter(p =>
                  recommendedIds.includes(p.id)
                );

                res.json(recommendedProducts);
              });
            });
          }
        );
      }
    );
  });

  return router;
};
