const express = require("express");
const { queryGroq } = require("../helpers/groq.js");
const db = require("../DB/mysql.js");

const router = express.Router();

router.post("/", async (req, res) => {
  const { question } = req.body;

  if (!question) return res.status(400).json({ error: "Question is required" });

  try {
    // 1️⃣ Fetch products from MySQL
    const [products] = await db.query(
      "SELECT id, title, description, price, category FROM products LIMIT 50"
    );

    // 2️⃣ Create prompt for Groq
  const prompt = `
You are an intelligent shopping assistant for an e-commerce website.

User question:
"${question}"

Available products (real data from database, prices in USD):
${JSON.stringify(products)}

Instructions:
- Answer the user's question naturally
- If the question implies a budget, respect it
- If the question implies a category, focus on that category
- Recommend relevant products when appropriate
- Do NOT invent products or prices
- Do NOT mention "$0" unless a product is free
- If no products match, say so politely
- Keep answers helpful and concise
`;


    // 3️⃣ Call Groq
    const answer = await queryGroq(prompt);

    // 4️⃣ Send response to frontend
    res.json({ success: true, answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
