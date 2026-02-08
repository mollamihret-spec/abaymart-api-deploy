// ===== IMPORTS =====
const mysql = require("mysql2");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const path = require("path");
const adminAuth = require("./middleware/adminAuth");

dotenv.config();

// ===== APP INIT (ONLY ONCE) =====
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ===== STRIPE (NO SERVER, JUST ROUTES) =====
console.log("Stripe key:", process.env.STRIPE_KEY);
const stripe = require("stripe")(process.env.STRIPE_KEY);

app.post("/payment/create", async (req, res) => {
  const total = Number(req.query.total);

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: "usd",
    });

    res.status(201).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== MYSQL CONNECTION =====
const mysqlConnection = mysql.createConnection({
  user:  process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host:  process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,

});

mysqlConnection.connect((err) => {
  if (err) console.log("DB Connection Error:", err);
  else console.log("Connected to MySQL database");
});

const dbTestRoutes = require("./routes/dbTest.routes");
app.use("/api/db-test", dbTestRoutes);

const aiChatRoutes = require("./routes/aiChat.routes");
app.use("/api/ai-chat", aiChatRoutes);


// ===== ROUTES (UNCHANGED) =====
app.get("/", (req, res) => {
  res.send("Server is now running...");
});

app.get("/install", (req, res) => {
  const createProducts = `
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      category VARCHAR(100),
      image VARCHAR(255),
      rating_rate DECIMAL(3,1),
      rating_count INT
    )
  `;

  const createOrders = `
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createOrderItems = `
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `;

  mysqlConnection.query(createProducts);
  mysqlConnection.query(createOrders);
  mysqlConnection.query(createOrderItems);

  res.send("Tables created successfully!");
});




app.post("/add-products", adminAuth, (req, res) => {
  const { title, description, price, category, image, rate, count } = req.body;

  const rating_rate = parseFloat(rate) || 0;
  const rating_count = parseInt(count) || 0;
  const price_num = parseFloat(price) || 0;

  const query = `
    INSERT INTO products
    (title, description, price, category, image, rating_rate, rating_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  mysqlConnection.query(
    query,
    [title, description, price_num, category, image, rating_rate, rating_count],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error", error: err });
      }
      res.json({ id: result.insertId, message: "Product added" });
    }
  );
});


app.get("/products", (req, res) => {
  const query = "SELECT * FROM products";
  mysqlConnection.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });

    const formatted = results.map((p) => ({
      ...p,
      rating: {
        rate: p.rating_rate || 0,
        count: p.rating_count || 0,
      },
    }));

    res.json(formatted);
  });
});


app.get("/products/:id", (req, res) => {
  const productId = req.params.id;
  const query = "SELECT * FROM products WHERE id = ?";

  mysqlConnection.query(query, [productId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    if (!results.length) return res.status(404).json({ message: "Product not found" });

    const p = results[0];
    res.json({
      ...p,
      rating: { rate: p.rating_rate || 0, count: p.rating_count || 0 },
    });
  });
});


app.get("/products/category/:categoryName", (req, res) => {
  const categoryName = req.params.categoryName;
  const query = "SELECT * FROM products WHERE category = ?";

  mysqlConnection.query(query, [categoryName], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });

    const formatted = results.map((p) => ({
      ...p,
      rating: { rate: p.rating_rate || 0, count: p.rating_count || 0 },
    }));

    res.json(formatted);
  });
});


app.put("/products/:id", adminAuth, (req, res) => {
  const productId = req.params.id;
  const { title, description, price, category, image, rate, count } = req.body;

  const rating_rate = parseFloat(rate) || 0;
  const rating_count = parseInt(count) || 0;
  const price_num = parseFloat(price) || 0;

  const query = `
    UPDATE products
    SET title = ?, description = ?, price = ?, category = ?, image = ?, rating_rate = ?, rating_count = ?
    WHERE id = ?
  `;

  mysqlConnection.query(
    query,
    [title, description, price_num, category, image, rating_rate, rating_count, productId],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Database error", error: err });
      if (result.affectedRows === 0) return res.status(404).json({ message: "Product not found" });

      res.json({ message: "Product updated successfully" });
    }
  );
});


app.delete("/products/:id", adminAuth, (req, res) => {
  const query = "DELETE FROM products WHERE id = ?";
  mysqlConnection.query(query, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Database error", error: err });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product deleted successfully" });
  });
});


app.post("/orders", (req, res) => {
  const { user_id, basket, total, status } = req.body;

  if (!user_id || !basket || basket.length === 0) {
    return res.status(400).json({ message: "Invalid order data" });
  }

  const orderQuery = "INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)";
  mysqlConnection.query(orderQuery, [user_id, total, status || "pending"], (err, result) => {
    if (err) return res.status(500).json({ message: "Error creating order", error: err });

    const orderId = result.insertId;

    const itemsQuery = "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?";
    const values = basket.map((item) => [orderId, item.product_id, item.quantity, item.price]);

    mysqlConnection.query(itemsQuery, [values], (err2) => {
      if (err2) return res.status(500).json({ message: "Error adding order items", error: err2 });
      res.json({ message: "Order placed successfully", orderId });
    });
  });
});


app.get("/orders/user/:userId", (req, res) => {
  const userId = req.params.userId;
  const query = `
    SELECT 
      o.id AS order_id,
      o.total,
      o.status,
      oi.quantity,
      oi.price AS item_price,
      p.id AS product_id,
      p.title,
      p.description,
      p.image,
      p.rating_rate,
      p.rating_count
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
  `;

  mysqlConnection.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Error fetching orders", error: err });


    const ordersMap = {};
    results.forEach((row) => {
      if (!ordersMap[row.order_id]) {
        ordersMap[row.order_id] = { id: row.order_id, total: row.total, status: row.status, items: [] };
      }
      ordersMap[row.order_id].items.push({
        product_id: row.product_id,
        title: row.title,
        description: row.description,
        image: row.image,
        price: row.item_price,
        quantity: row.quantity,
        rating: { rate: row.rating_rate, count: row.rating_count },
      });
    });

    res.json(Object.values(ordersMap));
  });
});


const PORT = process.env.DB_PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
